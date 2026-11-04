# Luz de mi Camino

> «Lámpara es á mis pies tu palabra, y lumbrera á mi camino». — Salmos 119:105 (RV 1909)

Una app para memorizar versículos bíblicos o cualquier cita. No necesitas una cuenta. Tus versículos se guardan en tu dispositivo.

Es la versión en español de [light2Path](https://github.com/ricayaka7/light2Path). Cada app tiene su propio código y sus propios datos.

## Cómo usarla

Sírvela desde una carpeta (no abras `index.html` directamente), para que funcionen la búsqueda y el modo sin conexión:

```sh
python3 -m http.server 8000
# luego visita http://localhost:8000
```

## Traducciones

- **Reina-Valera 1909** (predeterminada): no necesita clave. Se obtiene de [getBible.net](https://getbible.net). Escribe referencias como `Juan 3:16`, `Sal 23`, `1 Co 13:4-7` o `Fil 4:13`. Se aceptan abreviaturas y nombres sin acentos.
- **ESV, KJV, WEB, ASV** (en inglés): la ESV necesita una clave gratuita de la API de Crossway, que se configura en **Ajustes**. Para estas traducciones, escribe el libro en inglés (`John 3:16`).
- **Solo para pegar**: RVR1960, RVR1995, RVC, RVA, NVI, LBLA, NBLA, NTV, DHH, TLA, PDT, BTX, NBV, y en inglés NIV, NASB, NKJV, NLT, CSB y otras. Se pueden pegar y etiquetar, pero no buscar.
- **Ninguna**: para citas o cualquier texto propio.

La Reina-Valera 1909 usa la ortografía de su época, por ejemplo «á» como preposición. En el modo **Escríbelo** no importan los acentos.

## Funciones

- **Mis versículos**: en una barra lateral en pantallas anchas, y en la pantalla de inicio en el teléfono.
- **Agregar**: toca **+ Agregar** y escribe una referencia (`Juan 3:16`, `Salmo 23 RVR1960`) o pega un versículo o una cita en una sola caja, y toca **Continuar**. La app busca el texto, o separa del texto pegado la referencia y la versión, y muestra el formulario completo para que lo revises. Lo que no pudo encontrar queda marcado para que lo completes.
- **Un versículo por línea**: los pasajes se guardan con cada versículo en su propia línea numerada. Al pegar un pasaje, la app lo divide sola: usa los números de versículo del texto si los hay (`16`, `[16]`, `¹⁶`), y si no, compara las palabras con el pasaje de la Reina-Valera 1909 (o de la ESV o la WEB para textos en inglés). **Dividir en versículos** hace lo mismo con versículos ya guardados. Los números no forman parte de la práctica.
- **Versión y referencia en lo pegado**: si el texto pegado nombra su versión o su referencia (`Juan 3:16 NVI`, `(RVR1960)`), pasan a sus propios campos, y se quitan las líneas de derechos de autor y los enlaces.
- **Modos de práctica**:
  - **Recordar**: ves la referencia, recitas el pasaje y luego lo revelas.
  - **Desvanecer**: ocultas más palabras con el control deslizante.
  - **Primeras letras**: solo se ve la primera letra de cada palabra.
  - **Escríbelo**: lo escribes de memoria y recibes una puntuación.
  - **Ordenar**: pones las frases mezcladas en orden.
  - **Dilo**: dices el pasaje de memoria al micrófono y recibes una puntuación palabra por palabra.
  - **Escucha y repite**: oyes el pasaje frase por frase y dices cada una en la pausa.
  - **Escuchar**: lee el pasaje en voz alta.
- **Voz**: activa **Ayuda por voz** en Ajustes y la app lee en voz alta las instrucciones, las puntuaciones y los mensajes, empieza en los modos de voz y usa botones más grandes. En **+ Agregar**, toca **Decir la referencia** para agregar un versículo hablando (`primera de Juan tres dieciséis`). Escuchar usa el reconocimiento de voz del navegador (Chrome, Edge, Safari; no Firefox), y Chrome y Edge envían el audio a sus fabricantes.
- **Guía de usuario**: el botón **?** de la barra superior abre la ayuda, en español.
- **Repaso espaciado**: después de practicar, califícate con *Otra vez / Difícil / Bien / Fácil* (teclas 1–4). La app programa el próximo repaso.
- **Copias de seguridad**: exporta o importa tus versículos desde la pantalla de inicio.

## Archivos

- `index.html`: estructura de la página
- `strings.js`: todos los textos de la interfaz, en español
- `app.js`: lógica de la app (almacenamiento, repaso, búsqueda, modos de práctica)
- `styles.css`: estilos (modo claro y oscuro según el sistema)
- `sw.js`: funcionamiento sin conexión
- `manifest.webmanifest`, `icons/`: nombre e icono en la pantalla de inicio
