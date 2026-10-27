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
- **ESV, KJV, WEB** (en inglés): la ESV necesita una clave gratuita de la API de Crossway, que se configura en **Ajustes**. Para estas traducciones, escribe el libro en inglés (`John 3:16`).
- **Ninguna**: para citas o cualquier texto propio.

La Reina-Valera 1909 usa la ortografía de su época, por ejemplo «á» como preposición. En el modo **Escríbelo** no importan los acentos.

## Funciones

- **Mis versículos**: en una barra lateral en pantallas anchas, y en la pantalla de inicio en el teléfono.
- **Modos de práctica**:
  - **Recordar**: ves la referencia, recitas el pasaje y luego lo revelas.
  - **Desvanecer**: ocultas más palabras con el control deslizante.
  - **Primeras letras**: solo se ve la primera letra de cada palabra.
  - **Escríbelo**: lo escribes de memoria y recibes una puntuación.
  - **Ordenar**: pones las frases mezcladas en orden.
  - **Escuchar**: lee el pasaje en voz alta.
- **Repaso espaciado**: después de practicar, califícate con *Otra vez / Difícil / Bien / Fácil* (teclas 1–4). La app programa el próximo repaso.
- **Copias de seguridad**: exporta o importa tus versículos desde la pantalla de inicio.

## Archivos

- `index.html`: estructura de la página
- `strings.js`: todos los textos de la interfaz, en español
- `app.js`: lógica de la app (almacenamiento, repaso, búsqueda, modos de práctica)
- `styles.css`: estilos (modo claro y oscuro según el sistema)
- `sw.js`: funcionamiento sin conexión
- `manifest.webmanifest`, `icons/`: nombre e icono en la pantalla de inicio
