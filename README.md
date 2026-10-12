# Pulso · tablero en vivo

![Licencia: todos los derechos reservados](https://img.shields.io/badge/licencia-todos%20los%20derechos%20reservados-b91c1c) ![No es open source](https://img.shields.io/badge/open%20source-no-b91c1c)

> [!CAUTION]
> **© 2026 Gonzalo Nicolás Bravo — IO Consulting. Todos los derechos reservados.**
>
> Este repositorio es público **solo** para publicar la demo con GitHub Pages. **No es software libre ni de código abierto.** No tenés permiso para copiar, clonar, modificar, redistribuir ni reutilizar este código o sus partes en otros proyectos, personales o comerciales, ni para usarlo en el entrenamiento de modelos de IA. El uso no autorizado infringe la Ley 11.723 de Propiedad Intelectual (Argentina). Condiciones completas en [`LICENSE`](LICENSE). Para pedir permisos: contacto@ioconsulting.com.ar.
>
> **All rights reserved.** This repository is public **only** to serve a GitHub Pages demo. **It is not free or open source software.** You may not copy, clone, modify, redistribute or reuse this code or any part of it in other projects, personal or commercial, or use it to train AI models. Unauthorized use infringes copyright. Full terms in [`LICENSE`](LICENSE). To request permission: contacto@ioconsulting.com.ar.


Demo de **IO Consulting**: toda la información de un negocio en una sola pantalla activa, sincronizada y fácil de leer.

El problema que resuelve: los datos del negocio están repartidos entre el sistema de gestión, la pasarela de cobros, la tienda online, el banco y varias planillas. Para saber cómo va el día alguien tiene que abrir cinco pantallas y armar el número a mano. Pulso junta esas fuentes, se actualiza solo y avisa cuando un dato está demorado.

> Los datos son simulados. Cada panel indica de qué sistema vendría su información en una implementación real.

## Cómo verla

No necesita instalación ni build. Desde la carpeta del repo:

```bash
python -m http.server 5178
```

Y abrir <http://localhost:5178>. También funciona en cualquier hosting estático (GitHub Pages, Netlify, un bucket).

## Qué muestra

| Panel | Para qué sirve |
|---|---|
| Número principal + avance contra objetivo | Cómo va el período y si está por encima o por debajo de lo esperable *a esta altura* (según la curva real de demanda, no lineal). |
| 4 indicadores | Cantidad, ticket promedio y dos indicadores con umbral (en objetivo / atención / crítico, siempre con ícono y texto). |
| Evolución vs. período anterior | Con marcas de eventos del negocio (una promo, una lista de precios nueva). |
| Fuentes conectadas | Cada sistema, su estado y hace cuánto sincronizó. Una fuente falla a propósito para mostrar cómo se comporta el tablero. |
| Alertas | Umbrales cruzados, fuentes caídas y operaciones fuera de lo común. |
| Canales, ranking y mapa de calor | Dónde se vende, qué se vende y cuándo hay más demanda. |
| Actividad en vivo | Las operaciones a medida que entran. |

Trae tres negocios de ejemplo (distribuidora mayorista, cadena de tiendas, servicios con turnos) para mostrar que la misma estructura se adapta a cada cliente.

## Ideas tomadas de Grafana

- **Cursor compartido:** al recorrer cualquier gráfico temporal, todos marcan el mismo instante (también con teclado).
- **Filtros globales en la URL:** negocio, sucursal, período y frecuencia. Un enlace reproduce la vista exacta.
- **Actualización configurable**, pausa y refresco manual. Se detiene sola si la pestaña no está visible.
- **Umbrales y anotaciones** sobre los gráficos.
- **Modo pantalla (kiosco)** para una TV de oficina: `K` o `?pantalla=1`.
- **Ver datos / Ampliar** en cada panel: la tabla detrás de cada gráfico es también la alternativa accesible.

## Movimiento e interacción

El movimiento está para explicar, no para decorar: cada animación cuenta algo del dato.

- **Hub de fuentes:** cada sistema envía un haz de luz al núcleo cuando sincroniza. Si una fuente falla, su línea queda punteada en ámbar y deja de emitir. Es la idea de "unificar" hecha visible.
- **Números que ruedan:** los indicadores cambian dígito por dígito, como un odómetro; sólo se mueve la cifra que cambió.
- **Presentación de los gráficos:** las líneas se dibujan, las barras crecen en cascada y el mapa de calor se enciende desde el centro.
- **Foco de luz:** el borde de cada panel sigue al cursor.
- **Paleta de comandos:** `Ctrl+K` (o `/`) para saltar a un negocio, sucursal, período o acción.
- **Cambio de tema:** el tema nuevo se abre en círculo desde el botón.

Motor: [Anime.js v4](https://animejs.com), incluido en `vendor/` para que la demo funcione sin internet. Es código de terceros: conserva su propia licencia MIT (`vendor/anime.LICENSE.md`) y es la única parte del repositorio que no está bajo "todos los derechos reservados". Se carga como mejora progresiva: si no está disponible, o si la persona pidió menos movimiento en su sistema, todo aparece directamente en su estado final. Sólo se animan `transform`, `opacity` y el trazo de los SVG.

Los patrones (haces animados, contador de dígitos, foco de luz, paleta de comandos) están inspirados en librerías de componentes para React como Kokonut UI, beUI y Cult UI, pero están escritos a medida en JavaScript puro para no sumar React ni un proceso de build.

## Atajos

| Tecla | Acción |
|---|---|
| `Ctrl` + `K` o `/` | Paleta de comandos |
| `P` | Pausar o reanudar |
| `K` | Modo pantalla |
| `1`–`4` | Hoy · 7 · 30 · 90 días |
| `←` `→` | Recorrer un gráfico con foco |
| `V` | Ampliar el panel bajo el cursor |
| `Esc` | Cerrar o salir |

## Parámetros de URL

| Parámetro | Valores |
|---|---|
| `negocio` | `distribucion`, `retail`, `servicios` |
| `sucursal` | id de la zona / tienda / sede |
| `periodo` | `hoy`, `7d`, `30d`, `90d` |
| `refresco` | milisegundos (`0` = manual) |
| `pantalla` | `1` abre en modo pantalla |
| `hora` | `real` usa el reloj verdadero. Sin este parámetro, fuera del horario hábil la demo arranca en un día hábil a las 11:40 para que nunca se vea vacía. |

## Estructura

```
index.html   estructura de la página y diálogos
styles.css   tokens de diseño (oscuro por defecto, claro opcional) y componentes
data.js      datos simulados y configuración de cada negocio
charts.js    gráficos SVG propios + bus de sincronización + tooltip
motion.js    coreografía con Anime.js (mejora progresiva)
vendor/      Anime.js 4.5.0 y su licencia MIT
CREDITS.md   piezas de terceros, con autor y licencia
app.js       estado, ciclo en vivo, paneles, filtros, atajos
```

## Adaptarlo a un cliente

1. **Negocio:** en `data.js`, `VERTICALS` define nombres, indicadores, umbrales, canales, fuentes y textos. Un cliente nuevo es un bloque nuevo.
2. **Datos reales:** `build()` es el único punto de entrada de datos. Devuelve series alineadas por tiempo; reemplazarlo por llamadas a las APIs del cliente (o a un backend intermedio) no requiere tocar los paneles.
3. **Fuentes:** el estado de cada fuente (`sources` en `app.js`) pasa a venir del registro de sincronizaciones real.

Se construye solo lo que el cliente necesita: no todos los paneles aplican a todos los negocios.

## Criterios de diseño

- Oscuro como predeterminado, claro disponible desde la barra superior.
- Paleta de series validada para daltonismo y contraste en ambos modos; los colores de estado nunca van solos (siempre ícono + texto).
- Números con formato argentino, cifras tabulares en tablas y ejes.
- El tramo en curso (hora o día sin terminar) se dibuja atenuado para que no parezca una caída.
- Respeta `prefers-reduced-motion`, foco visible en todo, navegación por teclado y textos para lectores de pantalla.
- Responsivo de 320 px a 2560 px, sin scroll horizontal. Validado en 12 tamaños (teléfonos de 320 a 430 px, teléfono apaisado, tablet y escritorio de 1024 a 2560 px): sin textos cortados, sin controles superpuestos, objetivos táctiles de 34 px o más, y la barra superior deja de quedar fija cuando la pantalla es baja.
- En el teléfono el encabezado se reordena en cuatro filas y la tabla muestra sólo las columnas que deciden (el resto queda en "Ver datos").

Las piezas tomadas de terceros (motor de animación, loader de arranque, interruptor de tema) están listadas con autor y licencia en [`CREDITS.md`](CREDITS.md).
