/* ==========================================================================
   Pulso — coreografía con Anime.js v4
   Mejora progresiva: si la librería no carga (por ejemplo al abrir el archivo
   con doble clic) o la persona pidió menos movimiento, todo sigue funcionando
   y simplemente aparece en su estado final.
   Regla: sólo se animan transform, opacity y el trazo de los SVG.
   ========================================================================== */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let A = null;

  const ready = import("./vendor/anime.esm.min.js")
    .then((m) => { A = m; document.documentElement.classList.add("has-anime"); return true; })
    .catch(() => false);

  const on = () => !!A && !reduce.matches && !document.hidden;

  /** Deja los elementos en su estado final, sin estilos en línea que pisen al CSS. */
  function settle(els) {
    els.forEach((el) => {
      el.style.opacity = "";
      el.style.transform = "";
      el.removeAttribute("stroke-dasharray");
      el.removeAttribute("stroke-dashoffset");
      el.style.strokeDasharray = "";
      el.style.strokeDashoffset = "";
    });
  }

  /** Corre una animación con red de seguridad: si el navegador no pinta, igual termina bien. */
  function run(els, build, maxMs) {
    els = [...els];
    if (!els.length) return;
    let done = false;
    const finish = () => { if (!done) { done = true; settle(els); } };
    try { build(els, finish); } catch (e) { finish(); return; }
    setTimeout(finish, maxMs);
  }

  const Motion = {
    ready,
    get active() { return on(); },

    /** Entrada del tablero: los paneles suben en cascada. */
    enterPanels(panels) {
      if (!on()) return false;
      run(panels, (els, finish) => {
        A.animate(els, {
          opacity: [0, 1], y: [22, 0], scale: [0.97, 1],
          duration: 820, delay: A.stagger(48), ease: "outExpo",
          onComplete: finish,
        });
      }, 2200);
      return true;
    },

    /** Un gráfico se presenta: las líneas se dibujan, las barras crecen, el área aparece. */
    chartIntro(root, opts = {}) {
      if (!on()) return;
      const dur = opts.short ? 800 : 1150;
      const lines = [...root.querySelectorAll("path.series:not(.series--partial)")];
      const late = [...root.querySelectorAll(".area, .end-dot, .series--partial, .t-end, .annot-mark, .annot-line, .threshold, .threshold-label")];
      const bars = [...root.querySelectorAll(".bar")];
      if (lines.length) {
        run(lines, (els, finish) => {
          A.animate(A.svg.createDrawable(els), {
            draw: ["0 0", "0 1"], duration: dur, delay: A.stagger(160), ease: "inOutQuart",
            onComplete: finish,
          });
        }, dur + 900);
      }
      if (late.length) {
        run(late, (els, finish) => {
          A.animate(els, { opacity: [0, 1], duration: 520, delay: dur * 0.62, ease: "outQuad", onComplete: finish });
        }, dur + 900);
      }
      if (bars.length) {
        run(bars, (els, finish) => {
          A.animate(els, {
            scaleY: [0, 1], duration: 720, delay: A.stagger(Math.max(6, Math.min(26, 420 / els.length))), ease: "outExpo",
            onComplete: finish,
          });
        }, 2200);
      }
    },

    /** Mapa de calor: las celdas se encienden desde el centro. */
    heatIn(cells, cols, rows) {
      if (!on()) return;
      run(cells, (els, finish) => {
        A.animate(els, {
          opacity: [0, 1], scale: [0.4, 1], duration: 520,
          delay: A.stagger(16, { grid: [cols, rows], from: "center" }), ease: "outExpo",
          onComplete: finish,
        });
      }, 2600);
    },

    /** Filas (tabla, alertas, actividad, fuentes) en cascada corta. */
    rowsIn(rows, baseDelay = 0) {
      if (!on()) return;
      run(rows, (els, finish) => {
        A.animate(els, {
          opacity: [0, 1], x: [-10, 0], duration: 460,
          delay: A.stagger(34, { start: baseDelay }), ease: "outExpo",
          onComplete: finish,
        });
      }, 2400);
    },

    /** Un sistema sincroniza: un haz viaja por su línea hasta el núcleo, y el núcleo late. */
    beam(comet, ring, node) {
      if (!on() || !comet) return;
      comet.style.opacity = "1";
      A.animate(comet, {
        strokeDashoffset: [0.22, -1], duration: 950, ease: "inOutSine",
        onComplete: () => { comet.style.opacity = "0"; },
      });
      setTimeout(() => { comet.style.opacity = "0"; }, 1300);
      if (node) A.animate(node, { scale: [{ to: 1.14, duration: 180 }, { to: 1, duration: 300 }], ease: "outQuad", onComplete: () => { node.style.transform = ""; } });
      if (ring) {
        A.animate(ring, {
          scale: [1, 1.9], opacity: [0.55, 0], duration: 760, delay: 720, ease: "outExpo",
          onComplete: () => { ring.style.opacity = ""; ring.style.transform = ""; },
        });
      }
    },

    /** El isotipo se vuelve a trazar con cada actualización: el pulso del tablero. */
    logoBeat(path) {
      if (!on() || !path) return;
      run([path], (els, finish) => {
        A.animate(A.svg.createDrawable(els), { draw: ["0 0", "0 1"], duration: 900, ease: "inOutQuart", onComplete: finish });
      }, 1500);
    },
  };

  window.PulsoMotion = Motion;
})();
