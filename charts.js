/* ==========================================================================
   Pulso — gráficos SVG livianos
   Idea tomada de Grafana: cursor compartido. Todos los gráficos temporales
   escuchan el mismo bus (Sync) y marcan el mismo instante a la vez.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Bus de sincronización ---------- */
  const Sync = {
    idx: null,
    source: null,
    subs: new Set(),
    set(idx, source) {
      if (idx === this.idx && source === this.source) return;
      this.idx = idx;
      this.source = source;
      this.subs.forEach((fn) => fn(idx, source));
    },
  };

  /* ---------- Tooltip único ---------- */
  const Tooltip = {
    get el() { return document.getElementById("tooltip"); },
    show(html, anchor) {
      const el = this.el;
      el.innerHTML = html;
      el.hidden = false;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = anchor.x + 16;
      if (left + r.width > vw - 8) left = anchor.x - r.width - 16;
      left = Math.max(8, left);
      let top = anchor.y - r.height / 2;
      top = Math.max(8, Math.min(vh - r.height - 8, top));
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      el.style.left = "0"; el.style.top = "0";
    },
    hide() { this.el.hidden = true; },
  };

  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let uid = 0;

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function niceTicks(max, count) {
    if (!(max > 0)) return { max: 1, ticks: [0, 1] };
    const step = niceStep(max / count);
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return { max: top, ticks };
  }
  function lastNonNull(a) { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; }

  function linePath(values, xi, y) {
    let d = "", pen = false;
    values.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += (pen ? "L" : "M") + xi(i).toFixed(1) + "," + y(v).toFixed(1);
      pen = true;
    });
    return d;
  }
  function areaPath(values, xi, y, base) {
    let d = "", seg = [];
    const flush = () => {
      if (seg.length > 1) {
        d += "M" + xi(seg[0]).toFixed(1) + "," + base;
        seg.forEach((i) => { d += "L" + xi(i).toFixed(1) + "," + y(values[i]).toFixed(1); });
        d += "L" + xi(seg[seg.length - 1]).toFixed(1) + "," + base + "Z";
      }
      seg = [];
    };
    values.forEach((v, i) => { if (v == null) flush(); else seg.push(i); });
    flush();
    return d;
  }
  /** Columna con extremo de datos redondeado (4px) y base recta. */
  function colPath(x, w, yTop, base) {
    const r = Math.min(4, w / 2, Math.max(0, base - yTop));
    return `M${x},${base}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${base}Z`;
  }

  /* ==========================================================================
     TimeChart: líneas o columnas sobre el eje de tiempo compartido
     ========================================================================== */
  class TimeChart {
    constructor(container, opts) {
      this.c = container;
      this.opts = opts;
      this.id = ++uid;
      container.classList.add("chart");
      container.tabIndex = 0;
      container.setAttribute("role", "img");
      this.ro = new ResizeObserver(() => this.render());
      this.ro.observe(container);
      this.onSync = (idx, src) => this.showHover(idx, src === this);
      Sync.subs.add(this.onSync);
      this.bind();
      this.render();
    }

    update(opts) { this.opts = opts; this.render(); }
    destroy() { this.ro.disconnect(); Sync.subs.delete(this.onSync); }

    bind() {
      const c = this.c;
      c.addEventListener("pointermove", (ev) => {
        if (!this.g) return;
        const r = c.getBoundingClientRect();
        const px = ev.clientX - r.left;
        const { left, band, n } = this.g;
        const i = Math.max(0, Math.min(n - 1, Math.floor((px - left) / band)));
        this.pointer = { x: ev.clientX, y: ev.clientY };
        Sync.set(i, this);
        this.placeTooltip();
      });
      c.addEventListener("pointerleave", () => { this.pointer = null; Sync.set(null, null); });
      c.addEventListener("focus", () => {
        if (!this.g) return;
        this.pointer = null;
        Sync.set(Math.max(0, this.opts.lastIdx ?? this.g.n - 1), this);
      });
      c.addEventListener("blur", () => { if (Sync.source === this) Sync.set(null, null); });
      c.addEventListener("keydown", (ev) => {
        if (!this.g || Sync.source !== this) return;
        let i = Sync.idx ?? 0;
        if (ev.key === "ArrowLeft") i--;
        else if (ev.key === "ArrowRight") i++;
        else if (ev.key === "Home") i = 0;
        else if (ev.key === "End") i = this.opts.lastIdx ?? this.g.n - 1;
        else if (ev.key === "Escape") { Sync.set(null, null); return; }
        else return;
        ev.preventDefault();
        Sync.set(Math.max(0, Math.min(this.g.n - 1, i)), this);
      });
    }

    render() {
      const c = this.c, o = this.opts;
      const W = c.clientWidth, H = c.clientHeight;
      if (!W || !H) return;
      const n = o.x.length;
      const all = [];
      o.series.forEach((s) => s.values.forEach((v) => { if (v != null) all.push(v); }));
      if (o.threshold) all.push(o.threshold.value);
      const { max: yMax, ticks } = niceTicks(Math.max(...all, 0) * 1.06, H < 200 ? 2 : 3);

      const tickLabels = ticks.map((t) => o.fmtAxis(t));
      const left = Math.max(...tickLabels.map((s) => s.length)) * 6.6 + 12;
      const right = o.endLabel ? 74 : 8;
      const top = o.annotations && o.annotations.length ? 20 : 10;
      const bottom = 24;
      const band = (W - left - right) / n;
      const base = H - bottom;
      const xi = (i) => left + (i + 0.5) * band;
      const y = (v) => top + (1 - v / yMax) * (base - top);
      this.g = { left, band, n, xi, y, base, top, W, H };

      let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>`;
      o.series.forEach((ser, k) => {
        if (ser.area) s += `<linearGradient id="g${this.id}-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${ser.color};stop-opacity:.16"/><stop offset="1" style="stop-color:${ser.color};stop-opacity:0"/></linearGradient>`;
      });
      s += `</defs>`;

      // Grilla horizontal recesiva + etiquetas de eje
      ticks.forEach((t, k) => {
        const yy = Math.round(y(t)) + 0.5;
        s += `<line class="${k === 0 ? "base-line" : "grid-line"}" x1="${left}" x2="${W - right}" y1="${yy}" y2="${yy}"/>`;
        s += `<text x="${left - 8}" y="${yy + 3.5}" text-anchor="end">${esc(tickLabels[k])}</text>`;
      });

      // Etiquetas de tiempo: sólo las que entran sin pisarse
      const minGap = 62;
      const every = Math.max(1, Math.ceil(minGap / band));
      for (let i = 0; i < n; i += every) {
        const lx = xi(i);
        if (lx < left + 10 || lx > W - right - 10) continue;
        s += `<text x="${lx.toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(o.fmtX(o.x[i], i))}</text>`;
      }

      // Umbral (estilo "thresholds" de Grafana)
      if (o.threshold) {
        const ty = Math.round(y(o.threshold.value)) + 0.5;
        s += `<line class="threshold" x1="${left}" x2="${W - right}" y1="${ty}" y2="${ty}" style="stroke:var(--warn);opacity:.75"/>`;
        s += `<text class="threshold-label" x="${W - right}" y="${ty - 5}" text-anchor="end" style="fill:var(--ink-3)">${esc(o.threshold.label)}</text>`;
      }

      // Anotaciones: eventos de negocio sobre la línea de tiempo
      let lastAx = -Infinity;
      (o.annotations || []).forEach((a) => {
        const ax = Math.round(xi(a.idx)) + 0.5;
        if (ax - lastAx < 14) return; // marcas pegadas no se leen: queda la primera, el tooltip las nombra
        lastAx = ax;
        s += `<line class="annot-line" x1="${ax}" x2="${ax}" y1="${top - 4}" y2="${base}"/>`;
        s += `<path class="annot-mark" data-annot="${a.idx}" d="M${ax - 5},${top - 14}h10l-5,7z"/>`;
      });

      // Series
      o.series.forEach((ser, k) => {
        if (o.kind === "column") {
          const w = Math.max(2, Math.min(24, band - 2));
          ser.values.forEach((v, i) => {
            if (v == null) return;
            const bx = xi(i) - w / 2;
            s += `<path class="bar${i === o.partialIdx ? " bar--partial" : ""}" data-i="${i}" d="${colPath(+bx.toFixed(1), +w.toFixed(1), Math.min(base - 1, y(v)), base)}" style="fill:${ser.color}"/>`;
          });
        } else {
          // El tramo en curso (hora o día sin terminar) se dibuja atenuado: no es una caída real
          const p = o.partialIdx;
          const cut = p != null && p > 0 && ser.values[p] != null && ser.values[p - 1] != null && !ser.muted;
          const solid = cut ? ser.values.map((v, i) => (i === p ? null : v)) : ser.values;
          if (ser.area) s += `<path d="${areaPath(solid, xi, y, base)}" style="fill:url(#g${this.id}-${k})"/>`;
          s += `<path class="series${ser.muted ? " series--muted" : ""}" d="${linePath(solid, xi, y)}" style="stroke:${ser.color}"/>`;
          if (cut) s += `<path class="series series--partial" d="M${xi(p - 1).toFixed(1)},${y(ser.values[p - 1]).toFixed(1)}L${xi(p).toFixed(1)},${y(ser.values[p]).toFixed(1)}" style="stroke:${ser.color}"/>`;
        }
      });

      // Punto final con pulso: "este dato acaba de llegar"
      o.series.forEach((ser) => {
        if (!ser.endDot || o.kind === "column") return;
        const li = lastNonNull(ser.values);
        if (li < 0) return;
        const ex = xi(li), ey = y(ser.values[li]);
        if (o.live) s += `<circle class="pulse" cx="${ex}" cy="${ey}" r="4" style="stroke:${ser.color}"/>`;
        s += `<circle class="end-dot" cx="${ex}" cy="${ey}" r="4.5" style="fill:${ser.color}"/>`;
        if (o.endLabel && ser === o.series[o.series.length - 1]) {
          s += `<text class="t-end" x="${ex + 10}" y="${ey + 4}">${esc(o.fmtAxis(ser.values[li]))}</text>`;
        }
      });

      // Capa de hover
      s += `<line class="cross" x1="0" x2="0" y1="${top - 4}" y2="${base}"/>`;
      o.series.forEach((ser, k) => { s += `<circle class="hdot" data-k="${k}" r="4.5" cx="0" cy="0" style="fill:${ser.color}"/>`; });
      s += `</svg>`;

      c.innerHTML = s;
      c.setAttribute("aria-label", o.ariaLabel || "");
      this.cross = c.querySelector(".cross");
      this.hdots = [...c.querySelectorAll(".hdot")];
      this.bars = o.kind === "column" ? [...c.querySelectorAll(".bar")] : [];
      this.annots = [...c.querySelectorAll(".annot-mark")];
      if (Sync.idx != null) this.showHover(Sync.idx, Sync.source === this);
    }

    showHover(idx, isSource) {
      if (!this.g || !this.cross) return;
      const o = this.opts, g = this.g;
      const on = idx != null && idx < g.n;
      this.c.classList.toggle("has-hover", on && o.kind === "column");
      this.cross.classList.toggle("on", on);
      this.annots.forEach((a) => a.classList.toggle("is-active", on && +a.dataset.annot === idx));
      if (!on) {
        this.hdots.forEach((d) => d.classList.remove("on"));
        this.bars.forEach((b) => b.classList.remove("on"));
        if (isSource || Sync.source == null) Tooltip.hide();
        return;
      }
      const x = Math.round(g.xi(idx)) + 0.5;
      this.cross.setAttribute("x1", x);
      this.cross.setAttribute("x2", x);
      o.series.forEach((ser, k) => {
        const d = this.hdots[k];
        const v = ser.values[idx];
        if (v == null || o.kind === "column") { d.classList.remove("on"); return; }
        d.setAttribute("cx", g.xi(idx));
        d.setAttribute("cy", g.y(v));
        d.classList.add("on");
      });
      this.bars.forEach((b) => b.classList.toggle("on", +b.dataset.i === idx));
      if (isSource) this.placeTooltip();
    }

    placeTooltip() {
      const idx = Sync.idx;
      if (idx == null || Sync.source !== this) return;
      const o = this.opts, g = this.g;
      let html = `<div class="tooltip__title">${esc(o.fmtXFull(o.x[idx], idx))}${idx === o.partialIdx ? " · en curso" : ""}</div>`;
      o.series.slice().reverse().forEach((ser) => {
        const v = ser.values[idx];
        const key = o.kind === "column" ? "legend__key legend__key--bar" : "legend__key";
        html += `<div class="tooltip__row"><span class="${key}" style="background:${ser.color}"></span><span class="tooltip__name">${esc(ser.name)}</span><span class="tooltip__val">${v == null ? "—" : esc(o.fmtVal(v))}</span></div>`;
      });
      const a = (o.annotations || []).find((q) => q.idx === idx);
      if (a) html += `<div class="tooltip__note"><svg viewBox="0 0 24 24"><path d="M5 21V4h11l-2 4 2 4H5"/></svg><span>${esc(a.text)}</span></div>`;
      const r = this.c.getBoundingClientRect();
      const anchor = this.pointer || { x: r.left + g.xi(idx), y: r.top + r.height / 2 };
      Tooltip.show(html, { x: anchor.x, y: r.top + g.top + (g.base - g.top) / 2 });
    }
  }

  /* ==========================================================================
     Spark: mini tendencia para indicadores, también sincronizada
     ========================================================================== */
  class Spark {
    constructor(container, opts) {
      this.c = container;
      this.opts = opts;
      this.id = ++uid;
      this.ro = new ResizeObserver(() => this.render());
      this.ro.observe(container);
      this.onSync = (idx) => this.showHover(idx);
      Sync.subs.add(this.onSync);
      this.render();
    }
    update(opts) { this.opts = opts; this.render(); }
    render() {
      const c = this.c, o = this.opts;
      const W = c.clientWidth, H = c.clientHeight;
      if (!W || !H) return;
      // En una mini tendencia importa la forma: los huecos internos se unen
      const first = o.values.findIndex((v) => v != null);
      const lastI = lastNonNull(o.values);
      const vals = o.values.slice();
      for (let i = first + 1, prev = first; i <= lastI && first >= 0; i++) {
        if (vals[i] != null) {
          for (let j = prev + 1; j < i; j++) vals[j] = vals[prev] + ((vals[i] - vals[prev]) * (j - prev)) / (i - prev);
          prev = i;
        }
      }
      const nums = vals.filter((v) => v != null);
      if (!nums.length) { c.innerHTML = ""; return; }
      let lo = Math.min(...nums), hi = Math.max(...nums);
      if (o.zero) lo = 0;
      if (hi === lo) hi = lo + 1;
      const pad = 3;
      const n = vals.length;
      const xi = (i) => pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
      const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2);
      this.g = { xi, y };
      const li = lastNonNull(vals);
      const color = o.color || "var(--s1)";
      let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><linearGradient id="sg${this.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${color};stop-opacity:.18"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/></linearGradient></defs>`;
      s += `<path d="${areaPath(vals, xi, y, H)}" style="fill:url(#sg${this.id})"/>`;
      s += `<path class="series" d="${linePath(vals, xi, y)}" style="stroke:${color};stroke-width:1.75"/>`;
      if (li >= 0) s += `<circle class="end-dot" cx="${xi(li)}" cy="${y(vals[li])}" r="3.5" style="fill:${color}"/>`;
      s += `<circle class="hdot" r="3.5" cx="0" cy="0" style="fill:${color}"/></svg>`;
      c.innerHTML = s;
      c.classList.add("spark");
      this.dot = c.querySelector(".hdot");
      if (Sync.idx != null) this.showHover(Sync.idx);
    }
    showHover(idx) {
      if (!this.dot || !this.opts.synced) return;
      const v = idx == null ? null : this.opts.values[idx];
      if (v == null) { this.dot.classList.remove("on"); return; }
      this.dot.setAttribute("cx", this.g.xi(idx));
      this.dot.setAttribute("cy", this.g.y(v));
      this.dot.classList.add("on");
    }
  }

  /** Sparkline estática en string (para celdas de tabla). */
  function sparkSVG(values, w, h, color) {
    const nums = values.filter((v) => v != null);
    if (!nums.length) return "";
    const lo = Math.min(...nums), hi = Math.max(...nums) || 1;
    const n = values.length;
    const xi = (i) => 1 + (i / Math.max(1, n - 1)) * (w - 2);
    const y = (v) => 2 + (1 - (v - lo) / (hi - lo || 1)) * (h - 4);
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${linePath(values, xi, y)}" fill="none" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" style="stroke:${color}"/></svg>`;
  }

  window.PulsoCharts = { Sync, Tooltip, TimeChart, Spark, sparkSVG, esc };
})();
