# Créditos de terceros

El código de Pulso es propio de IO Consulting (ver `LICENSE`). Las piezas de esta lista vienen de proyectos de
terceros con licencia abierta y conservan su licencia original.

| Pieza | Dónde está | Origen | Autor | Licencia |
|---|---|---|---|---|
| Motor de animación | `vendor/anime.esm.min.js` | [Anime.js v4.5.0](https://github.com/juliangarnier/anime) | Julian Garnier | MIT (`vendor/anime.LICENSE.md`) |
| Loader de arranque con forma de pulso | `index.html` (`#boot`), `styles.css` (`.boot`) | [Uiverse Galaxy](https://github.com/uiverse-io/galaxy) · `loaders/milley69_chilly-swan-51.html` | milley69 | MIT |
| Interruptor de tema (la luna y el sol giran y se reemplazan) | `styles.css` (`#btn-theme`) | [Uiverse Galaxy](https://github.com/uiverse-io/galaxy) · `Toggle-switches/Creatlydev_massive-quail-70.html` | Creatlydev | MIT |

Las dos piezas de Uiverse se adaptaron: clases renombradas, colores pasados a los tokens del proyecto y soporte
de `prefers-reduced-motion`.

## Inspiración sin código copiado

Estos patrones se escribieron desde cero para este proyecto, tomando sólo la idea:

- Haces animados entre nodos (Kokonut UI, Magic UI)
- Contador con dígitos que ruedan (beUI, Cult UI)
- Foco de luz que sigue al cursor (Cult UI, Motion Primitives)
- Paleta de comandos (beUI)
- Tablero con cursor compartido, filtros en la URL y modo kiosco (Grafana)

No se usó material de fuentes pagas ni de repositorios que republican contenido pago.
