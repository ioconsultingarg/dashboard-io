/* ==========================================================================
   Pulso — capa de datos simulada
   Determinística: el mismo negocio, sucursal y hora siempre dan el mismo número,
   así cambiar de período no "inventa" datos nuevos. Lo único aleatorio son los
   eventos en vivo, que se suman encima.
   Para conectar datos reales se reemplaza este archivo por llamadas a las APIs.
   ========================================================================== */
(function () {
  "use strict";

  const HOUR = 3600e3;
  const DAY = 24 * HOUR;

  /* ---------- Ruido determinístico ---------- */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rand01(seed) {
    let t = (seed + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Ruido centrado, aproximadamente normal, en [-1, 1]. */
  function n3(a, b) {
    const s = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0;
    return (rand01(s) + rand01(s + 1) + rand01(s + 2)) / 1.5 - 1;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function weighted(items, weightOf) {
    const total = items.reduce((a, it) => a + weightOf(it), 0);
    let r = Math.random() * total;
    for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }

  /* ---------- Negocios de ejemplo ---------- */
  const VERTICALS = {
    distribucion: {
      label: "Distribuidora mayorista",
      company: "Distribuidora del Litoral",
      dashName: "Operación comercial",
      branchLabel: "Zona",
      branches: [["norte", "Zona Norte", 0.26], ["centro", "Centro", 0.31], ["sur", "Zona Sur", 0.19], ["oeste", "Zona Oeste", 0.14], ["interior", "Interior", 0.1]],
      dailyBase: 52e6,
      avgTicket: 385e3,
      peaks: [[10, 1.6, 1], [15, 1.9, 0.7]],
      dow: [0.08, 1.18, 1.02, 1, 1.04, 0.98, 0.42],
      openHours: [7, 19],
      hero: { label: "Facturación", sources: ["erp", "pagos"] },
      count: { label: "Pedidos", unit: "pedidos", sources: ["preventa", "b2b"] },
      avg: { label: "Pedido promedio", sources: ["erp"] },
      k3: { label: "Margen bruto", unit: "pct", base: 20.4, spread: 1.3, target: 20, good: "up", warn: 20, crit: 18.5, sources: ["erp"] },
      k4: { label: "Cobranza vencida", unit: "money", base: 18.4e6, spread: 0.12, good: "down", warn: 17e6, crit: 22e6, sources: ["banco", "erp"] },
      second: { kind: "cash", title: "Cobrado vs. facturado", unit: "money", sources: ["pagos", "banco"] },
      channelsTitle: "Facturación por canal",
      channels: [["Preventa", 0.46], ["Portal B2B", 0.22], ["Televenta", 0.21], ["Mostrador", 0.11]],
      table: {
        title: "Productos más vendidos", itemLabel: "Producto", stockLabel: "Cobertura", stockUnit: "días", stockWarn: 10, stockCrit: 5,
        items: [["Aceite de girasol 1,5 L", 3900, 0.15, 4], ["Yerba mate 1 kg", 5200, 0.14, 21], ["Harina 000 1 kg", 1100, 0.11, 16], ["Gaseosa cola 2,25 L", 2900, 0.1, 9], ["Arroz largo fino 1 kg", 1800, 0.09, 28], ["Fideos secos 500 g", 1300, 0.08, 33], ["Azúcar 1 kg", 1500, 0.07, 12], ["Lavandina 1 L", 950, 0.05, 40]],
      },
      sources: [
        { id: "erp", name: "Sistema de gestión (ERP)", short: "ERP", desc: "Facturación, márgenes y clientes", icon: "db", every: 20 },
        { id: "pagos", name: "Pasarela de cobros", short: "Cobros", desc: "Tarjetas, QR y transferencias", icon: "card", every: 5 },
        { id: "preventa", name: "App de preventa", short: "Preventa", desc: "Pedidos de vendedores en calle", icon: "phone", every: 8 },
        { id: "b2b", name: "Portal B2B", short: "B2B", desc: "Pedidos online de comercios", icon: "cart", every: 6 },
        { id: "banco", name: "Banco", short: "Banco", desc: "Extractos y conciliación", icon: "bank", every: 45 },
        { id: "planilla", name: "Planilla de depósito", short: "Planilla", desc: "Conteos y cobertura de stock", icon: "sheet", every: 30, flaky: true },
      ],
      staleSource: "planilla",
      clients: ["Almacén San Martín", "Autoservicio La Esquina", "Supermercado El Sol", "Maxikiosco Avenida", "Despensa Doña Rosa", "Minimercado Belgrano", "Almacén Los Pinos", "Autoservicio Don Pepe"],
      feed: [
        { w: 0.78, icon: "cart", adds: true, title: (e) => `Pedido #${e.no} · ${e.client}`, sub: (e) => `${e.channel} · ${e.branchName}` },
        { w: 0.22, icon: "card", adds: false, title: (e) => `Cobro acreditado · ${e.client}`, sub: () => "Transferencia · conciliado con banco" },
      ],
      alerts: [
        { sev: "crit", text: "3 clientes superaron su límite de crédito", src: "ERP · Banco", ago: 7 },
        { sev: "warn", text: "Aceite de girasol 1,5 L: quedan 4 días de cobertura", src: "Planilla de depósito", ago: 18 },
        { sev: "info", text: "Proveedor actualizó su lista de precios (+3,2 % promedio)", src: "ERP", ago: 52 },
      ],
      annotations: [[0.3, "Inicio de la promo “Semana del almacén”"], [0.72, "Entró en vigencia la nueva lista de precios"]],
    },

    retail: {
      label: "Cadena de tiendas",
      company: "Casa Nativa · Hogar",
      dashName: "Ventas en tiendas",
      branchLabel: "Tienda",
      branches: [["palermo", "Palermo", 0.31], ["caballito", "Caballito", 0.24], ["nunez", "Núñez", 0.25], ["quilmes", "Quilmes", 0.2]],
      dailyBase: 24e6,
      avgTicket: 31e3,
      peaks: [[12.5, 1.5, 0.75], [18.5, 1.7, 1]],
      dow: [1.05, 0.86, 0.9, 0.92, 1, 1.18, 1.38],
      openHours: [9, 21],
      hero: { label: "Ventas", sources: ["pos", "online"] },
      count: { label: "Tickets", unit: "tickets", sources: ["pos"] },
      avg: { label: "Ticket promedio", sources: ["pos"] },
      k3: { label: "Conversión", unit: "pct", base: 24.1, spread: 1.5, target: 24, good: "up", warn: 23, crit: 21, sources: ["visitas", "pos"] },
      k4: { label: "Quiebres de stock", unit: "int", base: 12, spread: 0.28, good: "down", warn: 10, crit: 18, sources: ["erp"] },
      second: { kind: "visits", title: "Visitas vs. tickets", unit: "int", sources: ["visitas", "pos"] },
      channelsTitle: "Ventas por canal",
      channels: [["Tienda física", 0.58], ["Tienda online", 0.22], ["Retiro en tienda", 0.12], ["Apps de delivery", 0.08]],
      table: {
        title: "Productos más vendidos", itemLabel: "Producto", stockLabel: "Stock", stockUnit: "u.", stockWarn: 25, stockCrit: 10,
        items: [["Juego de sábanas 2 plazas", 42000, 0.14, 8], ["Toallón de algodón", 15500, 0.12, 140], ["Set de ollas x5", 89000, 0.11, 22], ["Vajilla 18 piezas", 64000, 0.1, 31], ["Almohada viscoelástica", 38000, 0.09, 57], ["Cortina blackout", 47000, 0.07, 18], ["Lámpara LED de pie", 52000, 0.06, 44], ["Organizador de placard", 21000, 0.05, 96]],
      },
      sources: [
        { id: "pos", name: "Cajas de las tiendas", short: "Cajas", desc: "Ventas y tickets en tiempo real", icon: "store", every: 4 },
        { id: "online", name: "Tienda online", short: "Web", desc: "Pedidos y retiros en tienda", icon: "cart", every: 6 },
        { id: "pagos", name: "Pasarela de pagos", short: "Pagos", desc: "Tarjetas, QR y cuotas", icon: "card", every: 5 },
        { id: "erp", name: "ERP · stock", short: "ERP", desc: "Inventario y reposición", icon: "db", every: 25 },
        { id: "visitas", name: "Contador de visitas", short: "Visitas", desc: "Sensores en la entrada", icon: "people", every: 10 },
        { id: "planilla", name: "Planilla de reposición", short: "Planilla", desc: "Pedidos a proveedores", icon: "sheet", every: 30, flaky: true },
      ],
      staleSource: "planilla",
      clients: ["Tienda física", "Tienda online"],
      feed: [
        { w: 0.7, icon: "bag", adds: true, title: (e) => `Venta · ticket #${e.prefix}-${e.no}`, sub: (e) => `${e.branchName} · ${e.channel}` },
        { w: 0.3, icon: "cart", adds: true, title: (e) => `Pedido online #W-${e.no}`, sub: (e) => `Retira en ${e.branchName}` },
      ],
      alerts: [
        { sev: "crit", text: "Juego de sábanas 2 plazas: 8 unidades entre todas las tiendas", src: "ERP · stock", ago: 11 },
        { sev: "warn", text: "Palermo: la conversión viene 3 puntos debajo de su promedio semanal", src: "Contador de visitas · Cajas", ago: 24 },
        { sev: "info", text: "Llegó la reposición de vajilla a Caballito", src: "ERP · stock", ago: 46 },
      ],
      annotations: [[0.38, "Arrancó el envío gratis en la tienda online"], [0.8, "Cambio de vidriera en Palermo"]],
    },

    servicios: {
      label: "Servicios con turnos",
      company: "Vital · Centros de bienestar",
      dashName: "Agenda y facturación",
      branchLabel: "Sede",
      branches: [["centro", "Sede Centro", 0.38], ["norte", "Sede Norte", 0.34], ["sur", "Sede Sur", 0.28]],
      dailyBase: 7.2e6,
      avgTicket: 46e3,
      peaks: [[10.5, 1.6, 0.85], [18, 1.8, 1]],
      dow: [0.1, 1.05, 1.1, 1.08, 1.12, 1.02, 0.68],
      openHours: [8, 21],
      hero: { label: "Facturación", sources: ["facturacion", "pagos"] },
      count: { label: "Turnos atendidos", unit: "turnos", sources: ["agenda"] },
      avg: { label: "Valor por turno", sources: ["facturacion"] },
      k3: { label: "Ocupación de agenda", unit: "pct", base: 81, spread: 4, target: 80, good: "up", warn: 78, crit: 70, sources: ["agenda"] },
      k4: { label: "Ausentismo", unit: "pct", base: 9.4, spread: 1.6, good: "down", warn: 10, crit: 14, sources: ["agenda", "crm"] },
      second: { kind: "wait", title: "Espera promedio en recepción", unit: "min", threshold: 15, sources: ["agenda"] },
      channelsTitle: "Facturación por canal",
      channels: [["Turno presencial", 0.38], ["Reserva online", 0.29], ["Abonos mensuales", 0.21], ["Convenios con empresas", 0.12]],
      table: {
        title: "Servicios más pedidos", itemLabel: "Servicio", stockLabel: "Agenda libre 7 días", stockUnit: "%", stockWarn: 15, stockCrit: 6,
        items: [["Masaje descontracturante", 38000, 0.19, 12], ["Clase de pilates reformer", 22000, 0.17, 5], ["Limpieza facial profunda", 45000, 0.14, 21], ["Drenaje linfático", 41000, 0.12, 18], ["Sesión de kinesiología", 35000, 0.11, 9], ["Depilación definitiva", 52000, 0.1, 34], ["Yoga grupal", 15000, 0.09, 27], ["Reflexología", 33000, 0.08, 40]],
      },
      sources: [
        { id: "agenda", name: "Sistema de turnos", short: "Turnos", desc: "Reservas, asistencias y esperas", icon: "calendar", every: 5 },
        { id: "facturacion", name: "Facturación electrónica", short: "Facturas", desc: "Comprobantes emitidos", icon: "receipt", every: 15 },
        { id: "pagos", name: "Pasarela de pagos", short: "Pagos", desc: "Señas, abonos y cobros", icon: "card", every: 6 },
        { id: "crm", name: "WhatsApp y CRM", short: "CRM", desc: "Confirmaciones y recordatorios", icon: "chat", every: 10 },
        { id: "encuestas", name: "Encuestas", short: "Encuestas", desc: "Satisfacción post-atención", icon: "star", every: 60 },
        { id: "planilla", name: "Planilla de profesionales", short: "Planilla", desc: "Disponibilidad y licencias", icon: "sheet", every: 30, flaky: true },
      ],
      staleSource: "planilla",
      clients: [],
      feed: [
        { w: 0.68, icon: "check", adds: true, title: (e) => `Turno atendido · ${e.item}`, sub: (e) => `${e.branchName} · ${e.channel}` },
        { w: 0.32, icon: "calendar", adds: false, title: (e) => `Nuevo turno · ${e.item}`, sub: (e) => `${e.when} · ${e.branchName}` },
      ],
      alerts: [
        { sev: "warn", text: "Sede Norte: 4 ausencias sin aviso en lo que va del día", src: "Sistema de turnos", ago: 9 },
        { sev: "crit", text: "Pilates reformer sin turnos libres los próximos 3 días", src: "Sistema de turnos", ago: 21 },
        { sev: "info", text: "92 % de los recordatorios de mañana ya están confirmados", src: "WhatsApp y CRM", ago: 38 },
      ],
      annotations: [[0.34, "Campaña de recordatorios por WhatsApp"], [0.76, "Se sumó una profesional en Sede Sur"]],
    },
  };

  // Precálculos por negocio
  Object.entries(VERTICALS).forEach(([key, V], vi) => {
    V.key = key;
    V.salt = hashStr(key);
    const raw = [];
    for (let h = 0; h < 24; h++) {
      const hr = h + 0.5;
      const inside = hr >= V.openHours[0] - 0.5 && hr <= V.openHours[1] + 0.5;
      const g = V.peaks.reduce((a, [m, s, w]) => a + w * Math.exp(-((hr - m) ** 2) / (2 * s * s)), 0);
      raw.push(inside ? g + 0.08 : 0.004);
    }
    const z = raw.reduce((a, b) => a + b, 0);
    V.shape = raw.map((x) => x / z);
    V.shapeMax = Math.max(...V.shape);
    V.branchShare = Object.fromEntries(V.branches.map(([k, , s]) => [k, s]));
    V.branchName = Object.fromEntries(V.branches.map(([k, n]) => [k, n]));
  });

  /* ---------- Períodos ---------- */
  const RANGES = {
    hoy: { label: "Hoy", bucket: HOUR, n: 24, compare: "vs. mismo día de la semana pasada", compareShort: "vs. hace 7 días", prevLabel: "Semana pasada", startOffset: 0 },
    "7d": { label: "7 días", bucket: 3 * HOUR, n: 56, compare: "vs. 7 días anteriores", compareShort: "vs. 7 días ant.", prevLabel: "Semana anterior", startOffset: 6 },
    "30d": { label: "30 días", bucket: DAY, n: 30, compare: "vs. 30 días anteriores", compareShort: "vs. 30 días ant.", prevLabel: "Período anterior", startOffset: 29 },
    "90d": { label: "90 días", bucket: DAY, n: 90, compare: "vs. 90 días anteriores", compareShort: "vs. 90 días ant.", prevLabel: "Período anterior", startOffset: 89 },
  };

  function dayStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

  /* ---------- Generación ---------- */
  const NOW0 = Date.now();
  const hourCache = new Map();

  function hourBase(V, branch, hourTs) {
    const key = V.key + "|" + branch + "|" + hourTs;
    let v = hourCache.get(key);
    if (v !== undefined) return v;
    const d = new Date(hourTs);
    const hi = Math.floor(hourTs / HOUR);
    const share = branch === "all" ? 1 : V.branchShare[branch];
    const bsalt = branch === "all" ? 0 : hashStr(branch);
    const trend = 1 + 0.12 * ((hourTs - NOW0) / (365 * DAY));
    const dayNoise = 1 + 0.07 * n3(Math.floor(hi / 24), V.salt + 7 + bsalt);
    const hourNoise = 1 + 0.15 * n3(hi, V.salt + bsalt);
    const rev = V.dailyBase * V.dow[d.getDay()] * V.shape[d.getHours()] * trend * share * dayNoise * hourNoise;
    const cnt = (rev / V.avgTicket) * (1 + 0.07 * n3(hi, V.salt + 3 + bsalt));
    v = { rev, cnt, hr: d.getHours() };
    if (hourCache.size > 60000) hourCache.clear();
    hourCache.set(key, v);
    return v;
  }

  /** Suma ingresos y cantidades de un tramo [t0, t1) hasta "now". */
  function sumRange(V, branch, t0, t1, now, events) {
    if (t0 >= now) return null;
    let rev = 0, cnt = 0;
    for (let t = t0; t < t1 && t < now; t += HOUR) {
      const b = hourBase(V, branch, t);
      const frac = Math.min(1, (now - t) / HOUR);
      rev += b.rev * frac;
      cnt += b.cnt * frac;
    }
    if (events) {
      for (const e of events) {
        if (e.ts >= t0 && e.ts < t1 && e.adds && (branch === "all" || e.branch === branch)) { rev += e.amount; cnt += 1; }
      }
    }
    return { rev, cnt };
  }

  function metricAt(V, spec, key, branch, extra) {
    const bsalt = branch === "all" ? 0 : hashStr(branch);
    // Deriva lenta (por día) + ruido chico por hora: así una tendencia se lee como tendencia
    const salt = V.salt + 11 + bsalt + (extra || 0);
    const day = Math.floor(key / 24), f = (key % 24) / 24;
    const slow = n3(day, salt) * (1 - f) + n3(day + 1, salt) * f;
    const z = 0.8 * slow + 0.25 * n3(key, salt + 1);
    if (spec.unit === "pct") return spec.base + spec.spread * z;
    if (spec.unit === "int") return Math.max(0, Math.round(spec.base * (1 + spec.spread * z)));
    return spec.base * (1 + spec.spread * z);
  }

  /**
   * Arma todo lo que necesita el tablero para una vista.
   * Devuelve series alineadas por índice: así todos los gráficos comparten el mismo eje de tiempo.
   */
  function build(vKey, branch, rangeKey, now, events) {
    const V = VERTICALS[vKey];
    const R = RANGES[rangeKey];
    const start = dayStart(now) - R.startOffset * DAY;
    // "Hoy" se compara con el mismo día de la semana anterior (time shift de 7 días)
    const shift = rangeKey === "hoy" ? 7 * DAY : R.n * R.bucket;

    const x = [], rev = [], cnt = [], prevRev = [], prevCnt = [], k3 = [], k4 = [], k3p = [], k4p = [];
    let lastIdx = -1;
    for (let i = 0; i < R.n; i++) {
      const t0 = start + i * R.bucket, t1 = t0 + R.bucket;
      x.push(t0);
      const cur = sumRange(V, branch, t0, t1, now, events);
      // El período anterior siempre se muestra completo como referencia
      const prev = sumRange(V, branch, t0 - shift, t1 - shift, Infinity, null);
      prevRev.push(prev.rev); prevCnt.push(prev.cnt);
      const key = Math.floor(t0 / HOUR);
      const keyPrev = Math.floor((t0 - shift) / HOUR);
      k3p.push(metricAt(V, V.k3, keyPrev, branch));
      k4p.push(metricAt(V, V.k4, keyPrev, branch, 5));
      if (cur) {
        lastIdx = i;
        rev.push(cur.rev); cnt.push(Math.round(cur.cnt));
        k3.push(metricAt(V, V.k3, key, branch));
        k4.push(metricAt(V, V.k4, key, branch, 5));
      } else {
        rev.push(null); cnt.push(null); k3.push(null); k4.push(null);
      }
    }

    // Comparación justa: el anterior hasta el mismo punto del tramo actual
    const lastStart = start + lastIdx * R.bucket;
    const frac = Math.min(1, (now - lastStart) / R.bucket);
    const sum = (a, n) => a.slice(0, n).reduce((s, v) => s + (v || 0), 0);
    const totalRev = sum(rev, lastIdx + 1);
    const totalCnt = sum(cnt, lastIdx + 1);
    const prevTotalRev = sum(prevRev, lastIdx) + prevRev[lastIdx] * frac;
    const prevTotalCnt = sum(prevCnt, lastIdx) + prevCnt[lastIdx] * frac;
    const mean = (a, n) => { const v = a.slice(0, n).filter((q) => q != null); return v.reduce((s, q) => s + q, 0) / (v.length || 1); };

    // Objetivo del período: lo esperable según la curva de demanda (día de semana y hora) + 4 %.
    // "Esperado a esta hora" usa la misma curva, así un domingo flojo no parece un mal resultado.
    const share = branch === "all" ? 1 : V.branchShare[branch];
    let expAll = 0, expSoFar = 0;
    const end = start + R.n * R.bucket;
    for (let t = start; t < end; t += HOUR) {
      const dd = new Date(t);
      const e = V.dailyBase * V.dow[dd.getDay()] * V.shape[dd.getHours()] * share;
      expAll += e;
      if (t < now) expSoFar += e * Math.min(1, (now - t) / HOUR);
    }
    const goal = expAll * 1.04;
    const expectedFrac = expAll ? expSoFar / expAll : 0;
    // Con muy pocas operaciones el promedio es ruido: no se grafica
    const avgPerBucket = rev.map((r, i) => (r != null && cnt[i] >= 3 ? r / cnt[i] : null));

    /* Segundo gráfico, según el negocio */
    let second;
    if (V.second.kind === "cash") {
      const cob = rev.map((r, i) => (r == null ? null : r * (0.9 + 0.08 * n3(Math.floor(x[i] / HOUR), V.salt + 21))));
      second = { series: [{ key: "fact", name: "Facturado", values: rev, color: "var(--s-muted)", muted: true }, { key: "cob", name: "Cobrado", values: cob, color: "var(--s3)", area: true }] };
    } else if (V.second.kind === "visits") {
      const vis = cnt.map((c, i) => (c == null ? null : Math.round(c / (k3[i] / 100))));
      second = { series: [{ key: "vis", name: "Visitas", values: vis, color: "var(--s2)" }, { key: "tic", name: "Tickets", values: cnt, color: "var(--s1)", area: true }] };
    } else {
      const wait = x.map((t0, i) => {
        if (rev[i] == null) return null;
        const hrs = [];
        for (let t = t0; t < t0 + R.bucket && t < now; t += HOUR) hrs.push(new Date(t).getHours());
        const open = hrs.filter((h) => h >= V.openHours[0] && h < V.openHours[1]);
        if (!open.length) return null;
        const load = open.reduce((a, h) => a + V.shape[h] / V.shapeMax, 0) / open.length;
        return Math.max(3, 6 + 10 * load + 2.2 * n3(Math.floor(t0 / HOUR), V.salt + 31));
      });
      second = { series: [{ key: "wait", name: "Espera promedio", values: wait, color: "var(--s3)", area: true }], threshold: { value: V.second.threshold, label: `Objetivo ${V.second.threshold} min` } };
    }

    /* Canales */
    const rk = hashStr(rangeKey + branch);
    let chRaw = V.channels.map(([name, s], i) => ({ name, v: s * (1 + 0.08 * n3(i, rk)) }));
    const chSum = chRaw.reduce((a, c) => a + c.v, 0);
    const channels = chRaw.map((c) => ({ name: c.name, value: (totalRev * c.v) / chSum, share: c.v / chSum }));

    /* Tabla */
    const T = V.table;
    const items = T.items.map(([name, price, s, stock], i) => {
      const k = 1 + 0.12 * n3(i, rk + 1);
      const value = totalRev * s * k;
      const prev = prevTotalRev * s * (1 + 0.14 * n3(i, rk + 2));
      const trend = rev.map((r, j) => (r == null ? null : r * s * (1 + 0.18 * n3(j, rk + i + 9))));
      const stockNow = Math.max(0, Math.round(stock * (1 + 0.1 * n3(i, Math.floor(now / (5 * 60e3))))));
      return { name, value, units: Math.round(value / price), delta: prev ? value / prev - 1 : 0, trend, stock: stockNow };
    }).sort((a, b) => b.value - a.value);

    /* Mapa de calor: últimas 4 semanas, por día de semana y hora */
    const [h0, h1] = V.openHours;
    const heat = [];
    const today0 = dayStart(now);
    for (let dow = 1; dow <= 7; dow++) {
      const d = dow % 7; // lunes primero
      const row = [];
      for (let h = h0; h < h1; h++) {
        let s = 0;
        for (let w = 1; w <= 4; w++) {
          let dayTs = today0 - w * 7 * DAY;
          const delta = (d - new Date(dayTs).getDay() + 7) % 7;
          dayTs += delta * DAY;
          s += hourBase(V, branch, dayTs + h * HOUR).cnt;
        }
        row.push(s / 4);
      }
      heat.push({ dow: d, values: row });
    }

    /* Anotaciones dentro de lo transcurrido */
    // Sólo en tramos con actividad: un evento de negocio a las 3 de la mañana no se cree
    const peak = Math.max(...rev.filter((v) => v != null), 1);
    const active = rev.map((v, i) => (v != null && v > peak * 0.08 ? i : -1)).filter((i) => i >= 0);
    const annotations = V.annotations.map(([at, text]) => ({ idx: active[Math.round(at * (active.length - 1))], text }))
      .filter((a, i, arr) => active.length > 3 && arr.findIndex((b) => b.idx === a.idx) === i);

    return {
      V, R, rangeKey, branch, now, start, x, lastIdx, frac,
      rev, cnt, prevRev, prevCnt, avgPerBucket,
      totals: {
        rev: totalRev, prevRev: prevTotalRev,
        cnt: totalCnt, prevCnt: prevTotalCnt,
        avg: totalCnt ? totalRev / totalCnt : 0, prevAvg: prevTotalCnt ? prevTotalRev / prevTotalCnt : 0,
        k3: mean(k3, lastIdx + 1), prevK3: mean(k3p, lastIdx + 1),
        k4: k4[lastIdx], prevK4: k4p[lastIdx],
        goal, expectedFrac,
      },
      k3, k4, second, channels, items, heat, annotations,
    };
  }

  /* ---------- Eventos en vivo ---------- */
  let seq = 48210 + Math.floor(Math.random() * 900);
  function makeEvent(vKey, branchFilter, ts, historical) {
    const V = VERTICALS[vKey];
    const br = branchFilter && branchFilter !== "all" ? V.branches.find((b) => b[0] === branchFilter) : weighted(V.branches, (b) => b[2]);
    const ch = weighted(V.channels, (c) => c[1]);
    const kind = weighted(V.feed, (f) => f.w);
    const item = weighted(V.table.items, (it) => it[2]);
    const mult = Math.exp(0.45 * (Math.random() + Math.random() + Math.random() - 1.5));
    const amount = Math.round(V.avgTicket * mult / 100) * 100;
    const inDays = 1 + Math.floor(Math.random() * 3);
    const e = {
      id: ++seq, ts, vertical: vKey,
      branch: br[0], branchName: br[1], channel: ch[0],
      amount, adds: kind.adds && !historical,
      icon: kind.icon,
      no: seq, prefix: br[1].slice(0, 1).toUpperCase(),
      client: V.clients.length ? pick(V.clients) : "",
      item: item[0],
      when: `${inDays === 1 ? "Mañana" : `En ${inDays} días`} ${String(9 + Math.floor(Math.random() * 11)).padStart(2, "0")}:${Math.random() < 0.5 ? "00" : "30"} h`,
    };
    e.title = kind.title(e);
    e.sub = kind.sub(e);
    return e;
  }

  window.PulsoData = { VERTICALS, RANGES, HOUR, DAY, build, makeEvent, hashStr, n3 };
})();
