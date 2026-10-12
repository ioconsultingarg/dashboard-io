/* ==========================================================================
   Pulso — orquestación del tablero
   Estado → datos → paneles. Un solo ciclo de actualización para todo,
   así nunca hay dos paneles mostrando momentos distintos.
   ========================================================================== */
(function () {
  "use strict";

  const { VERTICALS, RANGES, HOUR, DAY, build, makeEvent } = window.PulsoData;
  const { Sync, Tooltip, TimeChart, Spark, sparkSVG, esc } = window.PulsoCharts;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const Motion = window.PulsoMotion;

  /* ---------- Reloj de la demo ----------
     Un tablero de negocio un domingo a la noche está quieto, y eso no muestra nada.
     Si no estamos en horario hábil, la demo corre desde el último martes a jueves a
     las 11:40 y avanza en tiempo real. ?hora=real usa el reloj verdadero. */
  const SIM_OFFSET = (() => {
    if (new URLSearchParams(location.search).get("hora") === "real") return 0;
    const real = new Date();
    const mins = real.getHours() * 60 + real.getMinutes();
    if (real.getDay() >= 1 && real.getDay() <= 5 && mins >= 9 * 60 + 30 && mins <= 17 * 60 + 30) return 0;
    const t = new Date(real);
    t.setHours(11, 40, 0, 0);
    while (![2, 3, 4].includes(t.getDay()) || t > real) t.setDate(t.getDate() - 1);
    return real - t;
  })();
  const clockNow = () => Date.now() - SIM_OFFSET;

  /* ---------- Íconos (trazo 1.8, estilo Lucide) ---------- */
  const ICON = {
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.1h8.8a1.5 1.5 0 0 0 1.5-1.1L21 7H6"/>',
    bank: '<path d="M3 10h18L12 4 3 10zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
    store: '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-5.6A8 8 0 1 1 21 12z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    bag: '<path d="M5 8h14l-1 13H6L5 8zM9 8V6a3 3 0 0 1 6 0v2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    plug: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0V7zM12 17v5"/>',
    dots: '<circle cx="5" cy="12" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="19" cy="12" r=".6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 10v10"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    up: '<path d="M7 17L17 7M9 7h8v8"/>',
    down: '<path d="M7 7l10 10M17 9v8H9"/>',
    flat: '<path d="M5 12h14"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    warn: '<path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    crit: '<path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z"/><path d="M12 8v5M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18 3v4h-4M6 21v-4h4"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ""}</svg>`;

  /* ---------- Formato es-AR ---------- */
  const nf = (o) => new Intl.NumberFormat("es-AR", o);
  const F = {
    moneyC: nf({ style: "currency", currency: "ARS", notation: "compact", maximumFractionDigits: 1 }),
    money: nf({ style: "currency", currency: "ARS", maximumFractionDigits: 0 }),
    int: nf({ maximumFractionDigits: 0 }),
    intC: nf({ notation: "compact", maximumFractionDigits: 1 }),
    dec1: nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  };
  const NB = " ";
  function fmt(unit, v, compact = true) {
    if (v == null || Number.isNaN(v)) return "—";
    switch (unit) {
      case "money": return (compact ? F.moneyC : F.money).format(v);
      case "pct": return F.dec1.format(v) + NB + "%";
      case "min": return F.dec1.format(v) + NB + "min";
      case "int": return compact && v >= 10000 ? F.intC.format(v) : F.int.format(Math.round(v));
      default: return compact && v >= 10000 ? F.intC.format(v) : F.int.format(Math.round(v));
    }
  }
  const dShort = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" });
  const dDayMon = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
  const dLong = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const tHMS = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const tHM = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const pad2 = (n) => String(n).padStart(2, "0");
  const clean = (s) => s.replace(/\./g, "");
  function ago(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 5) return "ahora";
    if (s < 60) return `hace ${s}${NB}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `hace ${m}${NB}min`;
    return `hace ${Math.round(m / 60)}${NB}h`;
  }

  /* ---------- Estado (en la URL, como Grafana) ---------- */
  const params = new URLSearchParams(location.search);
  let storedTheme = null;
  try { storedTheme = localStorage.getItem("pulso-theme"); } catch (e) { /* sin almacenamiento */ }
  const state = {
    vertical: VERTICALS[params.get("negocio")] ? params.get("negocio") : "distribucion",
    branch: params.get("sucursal") || "all",
    range: RANGES[params.get("periodo")] ? params.get("periodo") : "hoy",
    refresh: params.has("refresco") ? +params.get("refresco") : 5000,
    paused: false,
    theme: storedTheme === "light" ? "light" : "dark",
    tv: params.get("pantalla") === "1",
  };
  if (!VERTICALS[state.vertical].branches.some((b) => b[0] === state.branch)) state.branch = "all";

  function syncURL() {
    const p = new URLSearchParams();
    p.set("negocio", state.vertical);
    if (state.branch !== "all") p.set("sucursal", state.branch);
    p.set("periodo", state.range);
    p.set("refresco", String(state.refresh));
    if (state.tv) p.set("pantalla", "1");
    history.replaceState(null, "", "?" + p.toString());
  }

  /* ---------- Vida del tablero ---------- */
  let events = [];
  let feed = [];
  let liveAlerts = [];
  let sources = [];
  let data = null;
  let lastUpdate = clockNow();
  let timer = null;
  const charts = {};
  const sparks = {};
  let introNext = false; // true sólo mientras se monta una vista: habilita las presentaciones

  function resetLive() {
    const now = clockNow();
    events = [];
    liveAlerts = [];
    feed = [];
    for (let i = 7; i >= 1; i--) feed.unshift(makeEvent(state.vertical, state.branch, now - i * (25e3 + Math.random() * 50e3), true));
    feed.reverse();
    const V = VERTICALS[state.vertical];
    sources = V.sources.map((s) => ({ ...s, last: now - Math.random() * s.every * 1000, status: "ok", syncing: 0, failAt: s.flaky ? now + 22e3 : 0, retryUntil: 0 }));
  }

  /* ---------- Paneles: estructura ---------- */
  function sourceChips(ids) {
    const map = Object.fromEntries(sources.map((s) => [s.id, s]));
    return ids.map((id) => map[id]).filter(Boolean).map((s) => `<span class="chip" title="${esc(s.name)}">${icon("plug")}${esc(s.short)}</span>`).join("");
  }

  function shell(id, { title, hint = "", srcs = [], legend = "", body = "", menu = true, bodyClass = "" }) {
    const el = document.getElementById(id);
    el.setAttribute("aria-labelledby", id + "-t");
    el.innerHTML = `
      <div class="panel__head">
        <h2 class="panel__title" id="${id}-t">${esc(title)}${hint ? ` <span class="panel__hint">· ${esc(hint)}</span>` : ""}</h2>
        ${legend ? `<div class="legend">${legend}</div>` : ""}
        <div class="panel__tools">
          <span class="slot-badge"></span>
          ${menu ? `<button class="icon-btn panel__menu" type="button" aria-haspopup="menu" aria-expanded="false" data-menu="${id}" title="Opciones del panel">${icon("dots")}<span class="sr-only">Opciones de ${esc(title)}</span></button>` : ""}
        </div>
      </div>
      <div class="panel__body ${bodyClass}">${body}</div>
      <div class="panel__foot">${srcs.length ? sourceChips(srcs) : ""}<span class="slot-foot"></span></div>`;
    return el;
  }

  const legendItem = (name, color, bar) => `<span class="legend__item"><span class="legend__key${bar ? " legend__key--bar" : ""}" style="background:${color}"></span>${esc(name)}</span>`;

  function bucketWord(R) {
    return R.bucket === HOUR ? "hora" : R.bucket === 3 * HOUR ? "franja de 3 h" : "día";
  }

  function mount(animate) {
    Object.values(charts).forEach((c) => c.destroy && c.destroy());
    Object.keys(charts).forEach((k) => delete charts[k]);
    Object.values(sparks).forEach((c) => c.destroy && c.destroy());
    Object.keys(sparks).forEach((k) => delete sparks[k]);
    Sync.set(null, null);

    const V = VERTICALS[state.vertical];
    const R = RANGES[state.range];
    $("#company").textContent = V.company;
    $("#dash-name").textContent = V.dashName;
    document.title = `${V.company} · Pulso`;
    const curLabel = state.range === "hoy" ? "Hoy" : "Período actual";

    // Fila 1
    shell("p-hero", { title: V.hero.label, hint: R.label, srcs: V.hero.sources,
      body: `<div class="hero__row"><div class="stat__value" data-v></div></div>
        <div class="stat__meta" data-meta></div>
        <div class="hero__goal" data-goal></div>
        <div class="stat__spark" data-spark></div>` });
    [["p-k1", V.count], ["p-k2", V.avg], ["p-k3", V.k3], ["p-k4", V.k4]].forEach(([id, cfg]) => {
      shell(id, { title: cfg.label, srcs: cfg.sources,
        body: `<div class="stat"><div class="stat__value" data-v></div><div class="stat__meta" data-meta></div><div class="stat__spark" data-spark></div></div>` });
    });

    // Fila 2
    shell("p-main", { title: `${V.hero.label} por ${bucketWord(R)}`, srcs: V.hero.sources,
      legend: legendItem(curLabel, "var(--s1)") + legendItem(R.prevLabel, "var(--s-muted)"),
      body: `<div data-chart style="height:290px"></div>` });
    shell("p-sources", { title: "Fuentes conectadas", hint: "en una sola pantalla", menu: true });
    buildHub();

    // Fila 3
    shell("p-count", { title: `${V.count.label} por ${bucketWord(R)}`, srcs: V.count.sources, body: `<div data-chart style="height:200px"></div>` });
    const secLegend = V.second.kind === "wait" ? "" : buildSecondLegend(V);
    shell("p-second", { title: V.second.title, srcs: V.second.sources, legend: secLegend, body: `<div data-chart style="height:200px"></div>` });
    shell("p-alerts", { title: "Alertas", srcs: [], body: `<ul class="alerts" data-list></ul>` });

    // Fila 4
    shell("p-channels", { title: V.channelsTitle, hint: R.label, srcs: V.hero.sources, body: `<div class="bars" data-bars></div>` });
    shell("p-table", { title: V.table.title, hint: R.label, srcs: [V.hero.sources[0], V.staleSource], body: `<div class="table-wrap" data-table></div>` });

    // Fila 5
    shell("p-heat", { title: "Demanda por día y hora", hint: "promedio de las últimas 4 semanas", srcs: V.count.sources, body: `<div data-heat></div>` });
    shell("p-feed", { title: "Actividad en vivo", srcs: V.sources.slice(0, 3).map((s) => s.id), bodyClass: "panel__body--scroll", body: `<ul class="feed" data-list></ul>` });

    // Títulos de selects
    $("#branch-label").textContent = V.branchLabel;

    introNext = true;
    update(true);
    introNext = false;

    if (animate && !reduceMotion.matches) {
      // Con Anime.js: cascada con física; sin la librería: la versión en CSS
      if (!Motion.enterPanels($$(".panel"))) {
        $$(".panel").forEach((p, i) => {
          p.style.setProperty("--i", i);
          p.classList.remove("is-entering");
          void p.offsetWidth;
          p.classList.add("is-entering");
          p.addEventListener("animationend", () => p.classList.remove("is-entering"), { once: true });
        });
      }
      Motion.rowsIn($$("#p-table tbody tr"), 420);
      Motion.rowsIn($$("#p-alerts .alert"), 380);
      Motion.rowsIn($$("#p-feed .feed__item"), 460);
      Motion.rowsIn($$("#p-sources .source"), 340);
    }
  }

  function buildSecondLegend(V) {
    if (V.second.kind === "cash") return legendItem("Cobrado", "var(--s3)") + legendItem("Facturado", "var(--s-muted)");
    return legendItem("Tickets", "var(--s1)") + legendItem("Visitas", "var(--s2)");
  }

  /* ---------- Formato de tiempo según período ---------- */
  function timeFormats(R, rangeKey) {
    if (rangeKey === "hoy") return {
      fmtX: (t) => `${new Date(t).getHours()} h`,
      fmtXFull: (t) => { const h = new Date(t).getHours(); return `Hoy · ${pad2(h)}:00 a ${pad2((h + 1) % 24)}:00`; },
    };
    if (rangeKey === "7d") return {
      labelEvery: 8,
      fmtX: (t) => (new Date(t).getHours() === 0 ? clean(dShort.format(t)) : ""),
      fmtXFull: (t) => { const d = new Date(t); return `${clean(dShort.format(d))} ${clean(dDayMon.format(d)).split(" ")[1] || ""} · ${pad2(d.getHours())} a ${pad2(d.getHours() + 3)} h`; },
    };
    return {
      fmtX: (t) => clean(dDayMon.format(t)),
      fmtXFull: (t) => dLong.format(t),
    };
  }

  /* ---------- Estado de umbrales ---------- */
  function statusOf(spec, v) {
    if (v == null) return null;
    if (spec.good === "up") return v >= spec.warn ? "good" : v >= spec.crit ? "warn" : "crit";
    return v <= spec.warn ? "good" : v <= spec.crit ? "warn" : "crit";
  }
  const STATUS_TXT = { good: "En objetivo", warn: "Atención", crit: "Crítico" };
  const STATUS_ICON = { good: "ok", warn: "warn", crit: "crit" };
  const badge = (st) => (st ? `<span class="badge badge--${st}">${icon(STATUS_ICON[st])}${STATUS_TXT[st]}</span>` : "");

  function deltaHTML(cur, prev, unit, goodDir, compareTxt) {
    if (!prev || cur == null) return "";
    let txt, sign;
    if (unit === "pct") {
      const d = cur - prev;
      sign = Math.abs(d) < 0.05 ? 0 : Math.sign(d);
      txt = (d > 0 ? "+" : d < 0 ? "−" : "") + F.dec1.format(Math.abs(d)) + NB + "pp";
    } else {
      const d = cur / prev - 1;
      sign = Math.abs(d) < 0.001 ? 0 : Math.sign(d);
      txt = (d > 0 ? "+" : d < 0 ? "−" : "") + F.dec1.format(Math.abs(d * 100)) + NB + "%";
    }
    const good = sign === 0 ? "flat" : (sign > 0) === (goodDir !== "down") ? "good" : "bad";
    const ic = sign > 0 ? "up" : sign < 0 ? "down" : "flat";
    const word = good === "good" ? "mejor" : good === "bad" ? "peor" : "igual";
    return `<span class="delta delta--${good}" aria-label="${txt} ${compareTxt}, ${word}">${icon(ic)}${txt}</span><span>${esc(compareTxt)}</span>`;
  }

  /* ---------- Números que ruedan, dígito por dígito ----------
     Cada dígito es una columna 0-9 que se desplaza (sólo transform). Cuando cambia
     un valor se mueve únicamente la cifra que cambió, como un odómetro. */
  const DIGITS = "0123456789".split("").map((n) => `<span>${n}</span>`).join("");
  function setNumber(el, value, unit) {
    const text = fmt(unit, value);
    el._v = value;
    const shape = text.replace(/\d/g, "0");
    if (el._shape !== shape) {
      el._shape = shape;
      let di = 0;
      const total = (text.match(/\d/g) || []).length;
      el.classList.add("flow");
      el.innerHTML = `<span class="sr-only" data-sr></span>` + [...text].map((ch) => (/\d/.test(ch)
        ? `<span class="digit" aria-hidden="true"><span class="digit__col" style="--d:0;--i:${total - 1 - di++}">${DIGITS}</span></span>`
        : `<span class="glyph" aria-hidden="true">${esc(ch)}</span>`)).join("");
      void el.offsetWidth; // el primer valor también rueda desde cero
    }
    $("[data-sr]", el).textContent = fmt(unit, value, false);
    const digits = text.match(/\d/g) || [];
    $$(".digit__col", el).forEach((c, i) => c.style.setProperty("--d", digits[i]));
  }

  /* ---------- Actualización de paneles ---------- */
  function update(first) {
    const now = clockNow();
    data = build(state.vertical, state.branch, state.range, now, events);
    const d = data, V = d.V, R = d.R, T = d.totals;
    const tf = timeFormats(R, d.rangeKey);
    const live = !state.paused && state.refresh > 0;
    const staleSrc = sources.find((s) => s.id === V.staleSource);
    const isStale = staleSrc && staleSrc.status === "retry";
    const partialIdx = d.frac < 1 ? d.lastIdx : null;
    // Mini tendencias: sólo tramos completos
    const done = (arr) => (partialIdx == null ? arr : arr.map((v, i) => (i === partialIdx ? null : v)));

    /* Héroe */
    const hero = $("#p-hero");
    setNumber($("[data-v]", hero), T.rev, "money", !first);
    $("[data-meta]", hero).innerHTML = deltaHTML(T.rev, T.prevRev, "money", "up", R.compare);
    const progress = Math.min(1, T.rev / T.goal);
    const elapsed = T.expectedFrac;
    $("[data-goal]", hero).innerHTML = `
      <div class="goal__track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}" aria-label="Avance contra el objetivo del período">
        <div class="goal__fill" style="--p:${introNext ? 0 : progress.toFixed(4)}" data-p="${progress.toFixed(4)}"></div>
        <div class="goal__mark" style="left:calc(${(Math.min(1, elapsed) * 100).toFixed(1)}% - 1px)" title="Dónde debería estar a esta altura"></div>
      </div>
      <div class="goal__labels"><span>${F.int.format(Math.round(progress * 100))}${NB}% del objetivo</span><span>Esperado a esta altura: ${F.int.format(Math.round(elapsed * 100))}${NB}% · meta ${fmt("money", T.goal)}</span></div>`;
    sparkFor("hero", $("[data-spark]", hero), { values: done(d.rev), color: "var(--s1)", zero: true, synced: true });

    /* Indicadores */
    const k1 = $("#p-k1");
    setNumber($("[data-v]", k1), T.cnt, "int", !first);
    $("[data-meta]", k1).innerHTML = deltaHTML(T.cnt, T.prevCnt, "int", "up", R.compareShort);
    sparkFor("k1", $("[data-spark]", k1), { values: done(d.cnt), color: "var(--s1)", zero: true, synced: true });

    const k2 = $("#p-k2");
    setNumber($("[data-v]", k2), T.avg, "money", !first);
    $("[data-meta]", k2).innerHTML = deltaHTML(T.avg, T.prevAvg, "money", "up", R.compareShort);
    sparkFor("k2", $("[data-spark]", k2), { values: done(d.avgPerBucket), color: "var(--s1)", synced: true });

    [["p-k3", V.k3, T.k3, T.prevK3, d.k3, "k3"], ["p-k4", V.k4, T.k4, T.prevK4, d.k4, "k4"]].forEach(([id, spec, cur, prev, series, key]) => {
      const p = $("#" + id);
      setNumber($("[data-v]", p), cur, spec.unit, !first);
      const st = statusOf(spec, cur);
      const tgt = spec.target != null ? ` · objetivo ${fmt(spec.unit, spec.target)}` : "";
      $("[data-meta]", p).innerHTML = badge(st) + (spec.unit === "pct" ? `<span>${esc(tgt.replace(" · ", ""))}</span>` : `<span>${key === "k4" ? "ahora" : ""}</span>`);
      $(".slot-foot", p).innerHTML = "";
      sparkFor(key, $("[data-spark]", p), { values: done(series), color: "var(--s1)", synced: true });
      p.dataset.status = st || "";
    });

    /* Gráfico principal */
    const main = $("#p-main [data-chart]");
    const mainOpts = {
      x: d.x, kind: "line", lastIdx: d.lastIdx, partialIdx, live, endLabel: true,
      series: [
        { key: "prev", name: R.prevLabel, values: d.prevRev, color: "var(--s-muted)", muted: true },
        { key: "cur", name: d.rangeKey === "hoy" ? "Hoy" : "Período actual", values: d.rev, color: "var(--s1)", area: true, endDot: true, glow: true },
      ],
      annotations: d.annotations,
      fmtAxis: (v) => fmt("money", v), fmtVal: (v) => fmt("money", v, false),
      ...tf,
      ariaLabel: `${V.hero.label} por ${bucketWord(R)}. Total ${fmt("money", T.rev, false)}. Usá las flechas para recorrer.`,
    };
    chartFor("main", main, mainOpts);

    /* Cantidades */
    chartFor("count", $("#p-count [data-chart]"), {
      x: d.x, kind: "column", lastIdx: d.lastIdx, partialIdx,
      series: [{ key: "cnt", name: V.count.label, values: d.cnt, color: "var(--s1)" }],
      fmtAxis: (v) => fmt("int", v), fmtVal: (v) => `${fmt("int", v, false)} ${V.count.unit}`, ...tf,
      ariaLabel: `${V.count.label} por ${bucketWord(R)}. Total ${fmt("int", T.cnt, false)}.`,
    });

    /* Segundo gráfico */
    const sec = d.second;
    const unit = V.second.unit;
    chartFor("second", $("#p-second [data-chart]"), {
      x: d.x, kind: "line", lastIdx: d.lastIdx, partialIdx, live,
      series: sec.series.map((s, i) => ({ ...s, endDot: i === sec.series.length - 1 })),
      threshold: sec.threshold,
      fmtAxis: (v) => fmt(unit, v), fmtVal: (v) => fmt(unit, v, false), ...tf,
      ariaLabel: V.second.title,
    });

    /* Fuentes */
    renderSources();

    /* Alertas */
    renderAlerts();

    /* Canales */
    const maxCh = Math.max(...d.channels.map((c) => c.value), 1);
    $("#p-channels [data-bars]").innerHTML = d.channels.map((c) => `
      <div class="bars__row">
        <span class="bars__label">${esc(c.name)}</span>
        <span class="bars__value">${fmt("money", c.value)}<small>${F.int.format(Math.round(c.share * 100))}${NB}%</small></span>
        <div class="bars__track" aria-hidden="true"><div class="bars__fill" style="--p:${introNext ? 0 : (c.value / maxCh).toFixed(4)}" data-p="${(c.value / maxCh).toFixed(4)}"></div></div>
      </div>`).join("");

    /* Tabla */
    const TB = V.table;
    const stockStatus = (v) => (v <= TB.stockCrit ? "crit" : v <= TB.stockWarn ? "warn" : "good");
    const stockTxt = (v) => (TB.stockUnit === "%" ? `${v}${NB}%` : `${F.int.format(v)}${NB}${TB.stockUnit}`);
    const unitsLabel = V.key === "servicios" ? "Turnos" : "Unidades";
    $("#p-table [data-table]").innerHTML = `
      <table class="table">
        <caption class="sr-only">${esc(TB.title)}, ${esc(R.label)}</caption>
        <thead><tr><th scope="col" class="rank">#</th><th scope="col">${esc(TB.itemLabel)}</th><th scope="col" class="num">${esc(V.hero.label)}</th><th scope="col" class="num">${unitsLabel}</th><th scope="col" class="num">Variación</th><th scope="col">Tendencia</th><th scope="col">${esc(TB.stockLabel)}</th></tr></thead>
        <tbody>${d.items.map((it, i) => {
          const pos = it.delta >= 0;
          const st = stockStatus(it.stock);
          return `<tr>
            <td class="rank">${i + 1}</td>
            <td>${esc(it.name)}</td>
            <td class="num">${fmt("money", it.value)}</td>
            <td class="num">${F.int.format(it.units)}</td>
            <td class="num"><span class="delta delta--${pos ? "good" : "bad"}">${icon(pos ? "up" : "down")}${pos ? "+" : "−"}${F.dec1.format(Math.abs(it.delta * 100))}${NB}%</span></td>
            <td class="spark-cell">${sparkSVG(it.trend, 100, 24, "var(--s1)")}</td>
            <td><span class="badge badge--${st}">${icon(STATUS_ICON[st])}${stockTxt(it.stock)}</span></td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;
    $("#p-table .slot-badge").innerHTML = isStale
      ? `<span class="chip chip--stale" title="La planilla no responde: se muestra el último dato conocido">${icon("clock")}Stock ${ago(now - staleSrc.last)}</span>`
      : "";

    /* Mapa de calor */
    renderHeat(d, V);

    // Presentación: las barras parten de cero y crecen en cascada
    if (introNext) {
      const fills = $$("[data-p]");
      void document.body.offsetWidth;
      fills.forEach((f, i) => { f.style.transitionDelay = `${260 + i * 70}ms`; f.style.setProperty("--p", f.dataset.p); });
      Motion.heatIn($$("#p-heat .heat__cell"), V.openHours[1] - V.openHours[0], 7);
    }

    /* Actividad */
    renderFeed(now);

    lastUpdate = now;
    renderStatus();
  }

  function chartFor(key, el, opts) {
    if (charts[key] && charts[key].c === el) charts[key].update(opts);
    else charts[key] = new TimeChart(el, opts);
  }
  function sparkFor(key, el, opts) {
    if (sparks[key] && sparks[key].c === el) sparks[key].update(opts);
    else sparks[key] = new Spark(el, opts);
  }

  /* ---------- Fuentes: un hub que muestra cómo todo llega a un solo lugar ---------- */
  let hubRO = null;
  function buildHub() {
    const body = $("#p-sources .panel__body");
    body.innerHTML = `
      <div class="hub" data-hub>
        <svg class="hub__beams" aria-hidden="true"></svg>
        <ul class="hub__nodes" aria-hidden="true">${sources.map((s) => `
          <li class="hub__node" data-src="${s.id}"><span class="hub__name">${esc(s.short)}</span><span class="hub__icon">${icon(s.icon)}</span></li>`).join("")}
        </ul>
        <div class="hub__core" aria-hidden="true"><span class="hub__ring"></span><svg viewBox="0 0 24 24"><path d="M2 12h4l3-8 4 16 3-8h6"/></svg></div>
        <p class="hub__caption" data-summary></p>
      </div>
      <ul class="sources" data-list>${sources.map((s) => `
        <li class="source" data-src="${s.id}">
          <span class="source__st" data-st></span>
          <span class="source__name">${esc(s.name)}<span class="source__desc"> · ${esc(s.desc)}</span></span>
          <span class="source__ago" data-ago></span>
        </li>`).join("")}
      </ul>`;
    if (hubRO) hubRO.disconnect();
    hubRO = new ResizeObserver(drawBeams);
    hubRO.observe($("[data-hub]", body));
    drawBeams();
  }

  /** Curvas desde cada sistema hasta el núcleo. Se recalculan si cambia el tamaño. */
  function drawBeams() {
    const hub = $("#p-sources [data-hub]");
    if (!hub || !hub.offsetWidth) return;
    const core = $(".hub__core", hub);
    const cx = core.offsetLeft + core.offsetWidth / 2, cy = core.offsetTop - 3;
    const svg = $(".hub__beams", hub);
    svg.setAttribute("viewBox", `0 0 ${hub.offsetWidth} ${hub.offsetHeight}`);
    svg.innerHTML = $$(".hub__node", hub).map((n) => {
      const ic = $(".hub__icon", n);
      const x = ic.offsetLeft + ic.offsetWidth / 2;
      const y = ic.offsetTop + ic.offsetHeight + 3;
      const d = `M${x.toFixed(1)},${y} C${x.toFixed(1)},${(y + (cy - y) * 0.62).toFixed(1)} ${cx},${(y + (cy - y) * 0.38).toFixed(1)} ${cx},${cy}`;
      return `<path class="beam" data-src="${n.dataset.src}" d="${d}"/><path class="beam__comet" data-src="${n.dataset.src}" d="${d}" pathLength="1"/>`;
    }).join("");
    $$("#p-sources .source").forEach((r) => { r._st = null; });
    renderSources();
  }

  function renderSources() {
    const now = clockNow();
    const panel = $("#p-sources");
    if (!$("[data-hub]", panel)) return;
    sources.forEach((s) => {
      const row = $(`.source[data-src="${s.id}"]`, panel);
      const node = $(`.hub__node[data-src="${s.id}"]`, panel);
      if (!row || !node) return;
      const retry = s.status === "retry";
      if (row._st !== s.status) {
        row._st = s.status;
        $("[data-st]", row).innerHTML = retry
          ? `<span class="badge badge--warn">${icon("warn")}<span class="sr-only">Reintentando</span></span>`
          : `<span class="badge badge--good">${icon("ok")}<span class="sr-only">Sincronizada</span></span>`;
        row.classList.toggle("is-retry", retry);
        node.classList.toggle("is-retry", retry);
        const beam = $(`.beam[data-src="${s.id}"]`, panel);
        if (beam) beam.classList.toggle("is-retry", retry);
      }
      $("[data-ago]", row).textContent = (retry ? "Reintentando · " : "") + ago(now - s.last);
      node.classList.toggle("is-syncing", s.syncing > now);
    });
    const ok = sources.filter((s) => s.status === "ok").length;
    $("[data-summary]", panel).innerHTML = `<strong>${ok} de ${sources.length}</strong> fuentes al día · cada sistema sigue funcionando como hoy`;
  }

  /** Un sistema acaba de sincronizar: su haz viaja al núcleo. */
  function pulseSource(s) {
    const panel = $("#p-sources");
    Motion.beam($(`.beam__comet[data-src="${s.id}"]`, panel), $(".hub__ring", panel), $(`.hub__node[data-src="${s.id}"] .hub__icon`, panel));
  }

  function simulateSources(now) {
    let changed = false;
    sources.forEach((s) => {
      if (s.flaky) {
        if (s.status === "ok" && now >= s.failAt) {
          s.status = "retry"; s.retryUntil = now + 28e3; changed = true;
          pushAlert({ sev: "warn", text: `${s.name} no responde. El panel de stock muestra el último dato conocido y lo marca.`, src: "Monitor de fuentes", ts: now, key: "stale-" + s.id });
        } else if (s.status === "retry" && now >= s.retryUntil) {
          s.status = "ok"; s.last = now; s.syncing = now + 900; s.failAt = now + 70e3 + Math.random() * 30e3; changed = true;
          pulseSource(s);
          liveAlerts = liveAlerts.filter((a) => a.key !== "stale-" + s.id);
          pushAlert({ sev: "good", text: `${s.name} volvió a sincronizar. Stock actualizado.`, src: "Monitor de fuentes", ts: now, key: "back-" + s.id });
        }
      }
      if (s.status === "ok" && now - s.last >= s.every * 1000) { s.last = now; s.syncing = now + 900; pulseSource(s); }
    });
    return changed;
  }

  /* ---------- Alertas ---------- */
  function pushAlert(a) {
    liveAlerts = liveAlerts.filter((x) => x.key !== a.key);
    a.isNew = true;
    liveAlerts.unshift(a);
    liveAlerts = liveAlerts.slice(0, 4);
    $("#announcer").textContent = `Alerta: ${a.text}`;
  }

  function renderAlerts() {
    const now = clockNow();
    const V = VERTICALS[state.vertical];
    const T = data.totals;
    const derived = [];
    [["k3", V.k3, T.k3], ["k4", V.k4, T.k4]].forEach(([k, spec, v]) => {
      const st = statusOf(spec, v);
      if (st && st !== "good") {
        const ref = spec.good === "up" ? `debajo de ${fmt(spec.unit, spec.warn)}` : `arriba de ${fmt(spec.unit, spec.warn)}`;
        derived.push({ sev: st, text: `${spec.label} en ${fmt(spec.unit, v)}, ${ref}`, src: "Umbral del tablero", ts: lastUpdate, key: "thr-" + k });
      }
    });
    const base = V.alerts.map((a, i) => ({ ...a, ts: now - a.ago * 60e3, key: "s" + i }));
    const rank = { crit: 0, warn: 1, info: 2, good: 3 };
    const all = [...liveAlerts, ...derived, ...base];
    const shown = all.slice(0, 5);
    const ic = { crit: "crit", warn: "warn", info: "info", good: "ok" };
    const label = { crit: "Crítica", warn: "Atención", info: "Aviso", good: "Resuelta" };
    $("#p-alerts [data-list]").innerHTML = shown.map((a) => `
      <li class="alert alert--${a.sev}${a.isNew ? " is-new" : ""}">
        ${icon(ic[a.sev])}
        <span class="alert__text"><span class="sr-only">${label[a.sev]}: </span>${esc(a.text)}</span>
        <span class="alert__meta">${label[a.sev]} · ${esc(a.src)} · <span data-ts="${a.ts}">${ago(now - a.ts)}</span></span>
      </li>`).join("");
    liveAlerts.forEach((a) => { a.isNew = false; });
    const active = all.filter((a) => a.sev === "crit" || a.sev === "warn").length;
    const worst = all.reduce((w, a) => Math.min(w, rank[a.sev]), 3);
    $("#p-alerts .slot-badge").innerHTML = `<span class="count-pill" title="Alertas activas" aria-label="${active} alertas activas">${active}</span>`;
    $("#p-alerts").dataset.worst = worst;
  }

  /* ---------- Mapa de calor ---------- */
  function renderHeat(d, V) {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const daysLong = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const [h0, h1] = V.openHours;
    const cols = h1 - h0;
    const max = Math.max(...d.heat.flatMap((r) => r.values), 1);
    const q = (v) => Math.min(6, Math.floor((v / max) * 6.999));
    const rows = d.heat.map((r) => `
      <div class="heat__row" style="--cols:${cols}">
        <span class="heat__day">${days[r.dow]}</span>
        ${r.values.map((v, i) => `<button type="button" class="heat__cell q${q(v)}" data-tip="${esc(`${daysLong[r.dow]} · ${pad2(h0 + i)} a ${pad2(h0 + i + 1)} h|${F.int.format(Math.round(v))} ${V.count.unit} por hora`)}" aria-label="${esc(`${daysLong[r.dow]} ${h0 + i} h: ${F.int.format(Math.round(v))} ${V.count.unit} por hora en promedio`)}"></button>`).join("")}
      </div>`).join("");
    const hours = Array.from({ length: cols }, (_, i) => `<span>${(h0 + i) % 2 === 0 ? h0 + i : ""}</span>`).join("");
    $("#p-heat [data-heat]").innerHTML = `<div class="heat">${rows}<div class="heat__hours" style="--cols:${cols}"><span></span>${hours}</div></div>`;
    $("#p-heat .slot-foot").innerHTML = `<span class="heat__legend">Menos <span class="heat__ramp">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<span class="q${i}"></span>`).join("")}</span> Más</span>`;
  }

  /* ---------- Actividad ---------- */
  function renderFeed(now) {
    const list = $("#p-feed [data-list]");
    if (!list) return;
    list.innerHTML = feed.slice(0, 8).map((e) => `
      <li class="feed__item${e.isNew ? " is-new" : ""}">
        <span class="feed__icon">${icon(e.icon)}</span>
        <span class="feed__title">${esc(e.title)}</span>
        <span class="feed__amount">${fmt("money", e.amount, false)}<small data-ts="${e.ts}">${ago(now - e.ts)}</small></span>
        <span class="feed__sub">${esc(e.sub)}</span>
      </li>`).join("");
    feed.forEach((e) => { e.isNew = false; });
  }

  /* ---------- Estado global ---------- */
  function renderStatus() {
    const el = $("#status");
    const txt = $("#status-text");
    const now = clockNow();
    if (state.paused) {
      el.dataset.state = "paused";
      txt.textContent = `Pausado · último dato ${tHMS.format(lastUpdate)}`;
    } else if (state.refresh === 0) {
      el.dataset.state = "manual";
      txt.textContent = `Manual · actualizado ${ago(now - lastUpdate)}`;
    } else {
      el.dataset.state = "live";
      txt.textContent = `En vivo · actualizado ${ago(now - lastUpdate)}`;
    }
  }

  /* ---------- Ciclo en vivo ---------- */
  function tick() {
    const now = clockNow();
    const V = VERTICALS[state.vertical];
    const nEv = 1 + (Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0);
    for (let i = 0; i < nEv; i++) {
      const e = makeEvent(state.vertical, state.branch, now - i * 400, false);
      e.isNew = true;
      events.push(e);
      feed.unshift(e);
      if (e.adds && e.amount > V.avgTicket * 2.1) {
        pushAlert({ sev: "info", text: `Operación grande: ${fmt("money", e.amount, false)} · ${e.title.split(" · ").pop()}`, src: e.branchName, ts: now, key: "big-" + e.id });
      }
    }
    feed = feed.slice(0, 30);
    events = events.filter((e) => now - e.ts < 92 * DAY);
    update(false);
    Motion.logoBeat($(".brand__mark path"));
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    if (!state.paused && state.refresh > 0 && !document.hidden) timer = setInterval(tick, state.refresh);
    renderStatus();
  }

  // Reloj de 1 s: hora, "hace X s", y sincronización de fuentes
  setInterval(() => {
    const now = clockNow();
    $("#clock").textContent = tHMS.format(now);
    if (!state.paused) {
      const changed = simulateSources(now);
      renderSources();
      if (changed) update(false);
    }
    $$("[data-ts]").forEach((n) => { n.textContent = ago(now - +n.dataset.ts); });
    renderStatus();
  }, 1000);

  document.addEventListener("visibilitychange", () => {
    // Pestaña oculta: no gastar ciclos. Al volver, ponerse al día de inmediato.
    if (!document.hidden && !state.paused && state.refresh > 0) tick();
    schedule();
  });

  /* ---------- Controles ---------- */
  const fVertical = $("#f-vertical");
  const fBranch = $("#f-branch");
  const fRefresh = $("#f-refresh");
  const seg = $("#f-range");

  function fillSelects() {
    fVertical.innerHTML = Object.entries(VERTICALS).map(([k, V]) => `<option value="${k}">${esc(V.label)}</option>`).join("");
    fVertical.value = state.vertical;
    const V = VERTICALS[state.vertical];
    fBranch.innerHTML = `<option value="all">Todas</option>` + V.branches.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
    fBranch.value = state.branch;
    if (![...fRefresh.options].some((o) => +o.value === state.refresh)) state.refresh = 5000;
    fRefresh.value = String(state.refresh);
  }

  function setRangeUI() {
    const btns = $$("button", seg);
    btns.forEach((b) => {
      const on = b.dataset.range === state.range;
      b.setAttribute("aria-checked", on);
      b.tabIndex = on ? 0 : -1;
    });
    let thumb = $(".seg__thumb", seg);
    if (!thumb) { thumb = document.createElement("span"); thumb.className = "seg__thumb"; seg.prepend(thumb); }
    const cur = btns.find((b) => b.dataset.range === state.range);
    thumb.style.width = cur.offsetWidth + "px";
    thumb.style.transform = `translateX(${cur.offsetLeft}px)`;
  }

  fVertical.addEventListener("change", () => {
    state.vertical = fVertical.value;
    state.branch = "all";
    fillSelects();
    resetLive();
    syncURL();
    mount(true);
  });
  fBranch.addEventListener("change", () => {
    state.branch = fBranch.value;
    events = [];
    syncURL();
    update(true);
  });
  function setRange(r) {
    if (!RANGES[r] || r === state.range) return;
    state.range = r;
    setRangeUI();
    syncURL();
    mount(false);
  }
  seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setRange(b.dataset.range); });
  seg.addEventListener("keydown", (e) => {
    const keys = Object.keys(RANGES);
    let i = keys.indexOf(state.range);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") i = (i + 1) % keys.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") i = (i - 1 + keys.length) % keys.length;
    else return;
    e.preventDefault();
    setRange(keys[i]);
    $(`button[data-range="${keys[i]}"]`, seg).focus();
  });
  fRefresh.addEventListener("change", () => {
    state.refresh = +fRefresh.value;
    syncURL();
    schedule();
  });
  $("#btn-refresh").addEventListener("click", (e) => {
    const b = e.currentTarget;
    b.classList.remove("is-spinning"); void b.offsetWidth; b.classList.add("is-spinning");
    tick();
  });

  function togglePause(force) {
    state.paused = typeof force === "boolean" ? force : !state.paused;
    $("#btn-pause").setAttribute("aria-pressed", state.paused);
    $("#btn-pause .sr-only").textContent = state.paused ? "Reanudar actualizaciones" : "Pausar actualizaciones";
    if (!state.paused) tick();
    schedule();
    update(false);
  }
  $("#btn-pause").addEventListener("click", () => togglePause());

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    $('meta[name="theme-color"]').setAttribute("content", state.theme === "dark" ? "#0b0b0a" : "#f3f2ee");
  }
  function toggleTheme() {
    let flipped = false;
    const flip = () => {
      if (flipped) return;
      flipped = true;
      state.theme = state.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem("pulso-theme", state.theme); } catch (e) { /* sin almacenamiento */ }
      applyTheme();
    };
    // El tema nuevo se abre en círculo desde el botón (View Transitions); si no hay soporte, cambia directo
    if (!document.startViewTransition || reduceMotion.matches || document.hidden) { flip(); return; }
    const r = $("#btn-theme").getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${r.left + r.width / 2}px`);
    root.style.setProperty("--vt-y", `${r.top + r.height / 2}px`);
    document.startViewTransition(flip);
    setTimeout(flip, 350); // si el navegador no llega a pintar la transición, el tema cambia igual
  }
  $("#btn-theme").addEventListener("click", toggleTheme);

  /* Modo pantalla (kiosco) */
  let idleT = null;
  function setTV(on) {
    state.tv = on;
    document.body.classList.toggle("tv", on);
    syncURL();
    if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!on && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }
  $("#btn-tv").addEventListener("click", () => setTV(true));
  $("#btn-tv-exit").addEventListener("click", () => setTV(false));
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && state.tv) setTV(false); });
  document.addEventListener("pointermove", () => {
    if (!state.tv) return;
    document.body.classList.add("tv-show");
    document.body.classList.remove("tv-idle");
    clearTimeout(idleT);
    idleT = setTimeout(() => { document.body.classList.remove("tv-show"); document.body.classList.add("tv-idle"); }, 2500);
  });

  /* Menú de panel */
  let openMenu = null;
  function closeMenu(focusBack) {
    if (!openMenu) return;
    const btn = openMenu.btn;
    openMenu.el.remove();
    btn.setAttribute("aria-expanded", "false");
    if (focusBack) btn.focus();
    openMenu = null;
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-menu]");
    if (btn) {
      e.stopPropagation();
      const wasSame = openMenu && openMenu.btn === btn;
      closeMenu(false);
      if (wasSame) return;
      const panel = btn.closest(".panel");
      const m = document.createElement("div");
      m.className = "menu";
      m.setAttribute("role", "menu");
      const expanded = panel.classList.contains("is-expanded");
      m.innerHTML = `<button role="menuitem" type="button" data-act="inspect">${icon("table")}Ver datos</button>
        <button role="menuitem" type="button" data-act="expand">${icon("expand")}${expanded ? "Reducir" : "Ampliar"}<kbd>V</kbd></button>`;
      panel.appendChild(m);
      btn.setAttribute("aria-expanded", "true");
      openMenu = { el: m, btn, panel };
      m.querySelector("button").focus();
      m.addEventListener("click", (ev) => {
        const act = ev.target.closest("[data-act]");
        if (!act) return;
        closeMenu(false);
        if (act.dataset.act === "inspect") inspect(panel.id);
        else toggleExpand(panel);
      });
      m.addEventListener("keydown", (ev) => {
        const items = $$("button", m);
        const i = items.indexOf(document.activeElement);
        if (ev.key === "ArrowDown") { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (ev.key === "ArrowUp") { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (ev.key === "Escape") { ev.stopPropagation(); closeMenu(true); }
        else if (ev.key === "Tab") closeMenu(false);
      });
      return;
    }
    if (openMenu && !e.target.closest(".menu")) closeMenu(false);
  });

  /* Panel ampliado */
  let expandedPanel = null;
  function toggleExpand(panel) {
    if (expandedPanel) {
      const p = expandedPanel;
      p.classList.remove("is-expanded");
      $(".scrim")?.remove();
      expandedPanel = null;
      document.body.style.overflow = "";
      $("[data-menu]", p)?.focus();
      if (p === panel) return;
    }
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.addEventListener("click", () => toggleExpand(panel));
    document.body.appendChild(scrim);
    panel.classList.add("is-expanded");
    expandedPanel = panel;
    document.body.style.overflow = "hidden";
    const chartEl = $("[data-chart]", panel);
    if (chartEl) chartEl.style.height = "calc(100vh - 170px)";
    panel.addEventListener("transitionend", () => {}, { once: true });
  }
  // Restaurar alturas al reducir
  new MutationObserver(() => {
    $$(".panel:not(.is-expanded) [data-chart]").forEach((c) => {
      const id = c.closest(".panel").id;
      c.style.height = id === "p-main" ? "290px" : "200px";
    });
  }).observe($("#tablero"), { subtree: true, attributes: true, attributeFilter: ["class"] });

  /* Ver datos (inspección, alternativa accesible a cada gráfico) */
  function inspect(panelId) {
    const d = data, V = d.V, R = d.R;
    const tf = timeFormats(R, d.rangeKey);
    let title = $("#" + panelId + "-t").textContent;
    let cols = [], rows = [];
    const timeRows = (series) => d.x.map((t, i) => [tf.fmtXFull(t, i), ...series.map((s) => s.values[i])]);
    switch (panelId) {
      case "p-hero": case "p-main":
        cols = ["Momento", d.rangeKey === "hoy" ? "Hoy" : "Período actual", R.prevLabel];
        rows = timeRows([{ values: d.rev.map((v) => fmt("money", v, false)) }, { values: d.prevRev.map((v) => fmt("money", v, false)) }]);
        break;
      case "p-k1": case "p-count":
        cols = ["Momento", V.count.label]; rows = timeRows([{ values: d.cnt.map((v) => fmt("int", v, false)) }]); break;
      case "p-k2":
        cols = ["Momento", V.avg.label]; rows = timeRows([{ values: d.avgPerBucket.map((v) => fmt("money", v, false)) }]); break;
      case "p-k3":
        cols = ["Momento", V.k3.label]; rows = timeRows([{ values: d.k3.map((v) => fmt(V.k3.unit, v, false)) }]); break;
      case "p-k4":
        cols = ["Momento", V.k4.label]; rows = timeRows([{ values: d.k4.map((v) => fmt(V.k4.unit, v, false)) }]); break;
      case "p-second":
        cols = ["Momento", ...d.second.series.map((s) => s.name)];
        rows = timeRows(d.second.series.map((s) => ({ values: s.values.map((v) => fmt(V.second.unit, v, false)) })));
        break;
      case "p-channels":
        cols = ["Canal", V.hero.label, "Participación"];
        rows = d.channels.map((c) => [c.name, fmt("money", c.value, false), F.dec1.format(c.share * 100) + NB + "%"]);
        break;
      case "p-table":
        cols = [V.table.itemLabel, V.hero.label, "Cantidad", "Variación", V.table.stockLabel];
        rows = d.items.map((it) => [it.name, fmt("money", it.value, false), F.int.format(it.units), F.dec1.format(it.delta * 100) + NB + "%", String(it.stock)]);
        break;
      case "p-heat": {
        const [h0, h1] = V.openHours;
        const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        cols = ["Día", ...Array.from({ length: h1 - h0 }, (_, i) => `${h0 + i} h`)];
        rows = d.heat.map((r) => [days[r.dow], ...r.values.map((v) => F.int.format(Math.round(v)))]);
        break;
      }
      case "p-sources":
        cols = ["Fuente", "Qué aporta", "Estado", "Última sincronización"];
        rows = sources.map((s) => [s.name, s.desc, s.status === "retry" ? "Reintentando" : "Sincronizada", tHMS.format(s.last)]);
        break;
      case "p-alerts":
        cols = ["Alerta", "Origen"];
        rows = $$("#p-alerts .alert").map((li) => [$(".alert__text", li).textContent, $(".alert__meta", li).textContent]);
        break;
      case "p-feed":
        cols = ["Hora", "Evento", "Detalle", "Importe"];
        rows = feed.map((e) => [tHMS.format(e.ts), e.title, e.sub, fmt("money", e.amount, false)]);
        break;
    }
    $("#inspect-title").textContent = title;
    $("#inspect-sub").textContent = `${V.company} · ${state.branch === "all" ? "Todas las " + V.branchLabel.toLowerCase() + (/[aeiou]$/i.test(V.branchLabel) ? "s" : "es") : V.branchName[state.branch]} · ${R.label} · ${rows.length} filas`;
    $("#inspect-body").innerHTML = `<div class="table-wrap"><table class="table"><thead><tr>${cols.map((c, i) => `<th scope="col"${i ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td${i ? ' class="num"' : ""}>${v == null || v === "—" ? "—" : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    $("#dlg-inspect").showModal();
  }

  $$("dialog").forEach((dl) => {
    dl.addEventListener("click", (e) => { if (e.target === dl || e.target.closest("[data-close]")) dl.close(); });
  });
  $("#btn-help").addEventListener("click", () => $("#dlg-help").showModal());

  /* Tooltip del mapa de calor */
  document.addEventListener("pointerover", (e) => {
    const c = e.target.closest(".heat__cell");
    if (!c) return;
    const [a, b] = c.dataset.tip.split("|");
    const r = c.getBoundingClientRect();
    Tooltip.show(`<div class="tooltip__title">${esc(a)}</div><div class="tooltip__row"><span class="legend__key legend__key--bar ${c.className.match(/q\d/)[0]}"></span><span class="tooltip__val" style="margin-left:0;padding-left:0">${esc(b)}</span></div>`, { x: r.right, y: r.top + r.height / 2 });
  });
  document.addEventListener("pointerout", (e) => { if (e.target.closest(".heat__cell")) Tooltip.hide(); });
  document.addEventListener("focusin", (e) => {
    const c = e.target.closest(".heat__cell");
    if (c) c.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  });
  document.addEventListener("focusout", (e) => { if (e.target.closest(".heat__cell")) Tooltip.hide(); });

  /* ---------- Paleta de comandos (Ctrl+K) ---------- */
  const dlgCmd = $("#dlg-cmd");
  const cmdInput = $("#cmd-input");
  const cmdList = $("#cmd-list");
  let cmdItems = [], cmdShown = [], cmdActive = 0;
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function paletteItems() {
    const V = VERTICALS[state.vertical];
    const items = [];
    Object.entries(VERTICALS).forEach(([k, v]) => {
      if (k !== state.vertical) items.push({ group: "Negocio", label: v.label, hint: v.company, icon: "store", run: () => { fVertical.value = k; fVertical.dispatchEvent(new Event("change")); } });
    });
    [["all", "Todas"], ...V.branches].forEach(([k, n]) => {
      if (k !== state.branch) items.push({ group: V.branchLabel, label: n, icon: "people", run: () => { fBranch.value = k; fBranch.dispatchEvent(new Event("change")); } });
    });
    Object.entries(RANGES).forEach(([k, r], i) => {
      if (k !== state.range) items.push({ group: "Período", label: r.label, kbd: String(i + 1), icon: "calendar", run: () => setRange(k) });
    });
    items.push({ group: "Acción", label: state.paused ? "Reanudar actualizaciones" : "Pausar actualizaciones", kbd: "P", icon: "clock", run: () => togglePause() });
    items.push({ group: "Acción", label: "Actualizar ahora", icon: "sync", run: () => tick() });
    items.push({ group: "Acción", label: "Modo pantalla", hint: "para la TV de la oficina", kbd: "K", icon: "expand", run: () => setTV(true) });
    items.push({ group: "Acción", label: state.theme === "dark" ? "Apariencia clara" : "Apariencia oscura", icon: "star", run: () => toggleTheme() });
    $$(".panel").forEach((p) => {
      const t = $(".panel__title", p);
      if (t) items.push({ group: "Ver datos", label: t.textContent.trim(), icon: "table", run: () => inspect(p.id) });
    });
    return items;
  }

  function renderPalette() {
    const q = norm(cmdInput.value.trim()).split(/\s+/).filter(Boolean);
    cmdShown = cmdItems.filter((it) => { const hay = norm(`${it.group} ${it.label} ${it.hint || ""}`); return q.every((w) => hay.includes(w)); });
    cmdActive = Math.max(0, Math.min(cmdActive, cmdShown.length - 1));
    let last = "";
    cmdList.innerHTML = cmdShown.length ? cmdShown.map((it, i) => {
      const head = it.group !== last ? `<li class="cmd__group" role="presentation">${esc(it.group)}</li>` : "";
      last = it.group;
      return `${head}<li class="cmd__item" id="cmd-${i}" role="option" aria-selected="${i === cmdActive}" data-i="${i}">${icon(it.icon)}<span class="cmd__label">${esc(it.label)}${it.hint ? `<span class="cmd__hint"> · ${esc(it.hint)}</span>` : ""}</span>${it.kbd ? `<kbd>${it.kbd}</kbd>` : ""}</li>`;
    }).join("") : `<li class="cmd__empty" role="presentation">Nada coincide con “${esc(cmdInput.value)}”. Probá con un negocio, un período o “pausar”.</li>`;
    cmdInput.setAttribute("aria-activedescendant", cmdShown.length ? `cmd-${cmdActive}` : "");
    const act = $(`#cmd-${cmdActive}`);
    if (act) act.scrollIntoView({ block: "nearest" });
  }

  function openPalette() {
    if (dlgCmd.open) return;
    $$("dialog[open]").forEach((d) => d.close());
    cmdItems = paletteItems();
    cmdInput.value = "";
    cmdActive = 0;
    renderPalette();
    dlgCmd.showModal();
    cmdInput.focus();
  }
  function runPalette(i) {
    const it = cmdShown[i];
    if (!it) return;
    dlgCmd.close();
    it.run();
  }
  cmdInput.addEventListener("input", () => { cmdActive = 0; renderPalette(); });
  cmdInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); cmdActive = (cmdActive + 1) % Math.max(1, cmdShown.length); renderPalette(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cmdActive = (cmdActive - 1 + cmdShown.length) % Math.max(1, cmdShown.length); renderPalette(); }
    else if (e.key === "Enter") { e.preventDefault(); runPalette(cmdActive); }
  });
  cmdList.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) runPalette(+li.dataset.i); });
  cmdList.addEventListener("pointermove", (e) => {
    const li = e.target.closest("[data-i]");
    if (li && +li.dataset.i !== cmdActive) { cmdActive = +li.dataset.i; $$(".cmd__item", cmdList).forEach((n) => n.setAttribute("aria-selected", +n.dataset.i === cmdActive)); }
  });
  $("#btn-cmd").addEventListener("click", openPalette);

  /* ---------- Foco de luz que sigue al cursor sobre cada panel ---------- */
  if (window.matchMedia("(hover: hover)").matches) {
    $("#tablero").addEventListener("pointermove", (e) => {
      const p = e.target.closest(".panel");
      if (!p) return;
      const r = p.getBoundingClientRect();
      p.style.setProperty("--mx", `${e.clientX - r.left}px`);
      p.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  /* Atajos */
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "select" || tag === "input" || tag === "textarea") return;
    if ($("dialog[open]") && e.key !== "Escape") return;
    const k = e.key.toLowerCase();
    if (k === "escape") {
      if (openMenu) closeMenu(true);
      else if (expandedPanel) toggleExpand(expandedPanel);
      else if (state.tv) setTV(false);
      return;
    }
    if (k === "p") togglePause();
    else if (k === "k") setTV(!state.tv);
    else if (k === "?") $("#dlg-help").showModal();
    else if (k === "/") { e.preventDefault(); openPalette(); }
    else if (k === "v") { const p = e.target.closest?.(".panel") || $(".panel:hover"); if (p) toggleExpand(p); }
    else if (["1", "2", "3", "4"].includes(k)) setRange(Object.keys(RANGES)[+k - 1]);
  });

  window.addEventListener("resize", () => setRangeUI());

  /* ---------- Arranque ---------- */
  applyTheme();
  fillSelects();
  resetLive();
  if (state.tv) document.body.classList.add("tv");
  syncURL();
  const start = () => { setRangeUI(); mount(true); schedule(); };
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const motionReady = Promise.race([Motion.ready, new Promise((r) => setTimeout(r, 900))]);
  Promise.all([fontsReady, motionReady]).then(start, start);
})();
