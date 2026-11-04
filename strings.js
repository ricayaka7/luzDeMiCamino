/* Interface text (Spanish). Verses and references are never translated.
 * Values are strings, or functions when the text depends on a number or name. */

"use strict";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const STRINGS = {
  add: "+ Agregar",
  settings: "Ajustes",
  help: "Ayuda",
  myVerses: "Mis versículos",
  searchShort: "Buscar…",
  searchLong: "Buscar versículos, citas, etiquetas…",

  // Inicio
  welcomeTitle: "Guarda la Palabra de Dios en tu corazón",
  welcomeBody: "Agrega los versículos o citas que quieras memorizar. Practícalos unos minutos al día, y Luz de mi Camino te los volverá a mostrar justo antes de que los olvides.",
  addFirst: "+ Agrega tu primer versículo",
  statDue: "Para hoy",
  statVerses: "Versículos",
  statMastered: "Dominados",
  statStreak: "Días seguidos",
  startReview: (n) => `Empezar repaso · ${n} ${n === 1 ? "pendiente" : "pendientes"}`,
  caughtUp: "Ya estás al día por hoy. Elige cualquier versículo para practicar de todos modos.",
  exportBackup: "Exportar copia de seguridad",
  importBackup: "Importar copia de seguridad",
  imported: (n) => `Se ${n === 1 ? "importó" : "importaron"} ${plural(n, "versículo nuevo", "versículos nuevos")}.`,
  badBackup: "Ese archivo no parece una copia de seguridad de Luz de mi Camino.",
  saveFailed: "No se pudo guardar. Puede que el almacenamiento esté lleno o bloqueado.",

  // Lista de versículos
  noMatches: "Sin resultados.",
  noVerses: "Todavía no hay versículos.",
  addOne: "Agrega uno",
  badgeNew: "Nuevo",
  badgeDue: "Pendiente",
  badgeMastered: "Dominado",
  badgeIn: (d) => `en ${d} d`,

  // Instalar
  installTitle: "📱 Agrégala a tu teléfono",
  installBody: "Instala Luz de mi Camino para que se abra como una app normal, en pantalla completa y sin conexión.",
  installButton: "Instalar app",
  installIOS: `En Safari, toca el botón <b>Compartir</b> <span aria-hidden="true">(□↑)</span> y luego <b>Agregar a inicio</b>.`,
  installOther: `Abre esta página en tu teléfono. En iPhone, usa <b>Compartir → Agregar a inicio</b> en Safari. En Android, abre el menú <b>⋮</b> de Chrome y toca <b>Agregar a la pantalla principal</b>.`,
  dismiss: "Cerrar",

  // Traducciones y búsqueda
  translationRV: "Reina-Valera 1909",
  translationESV: "ESV (inglés)",
  translationKJV: "KJV (inglés)",
  translationWEB: "WEB (inglés)",
  translationASV: "ASV (inglés)",
  translationNone: "Ninguna — una cita o mi propio texto",
  errEsvReach: "No se pudo conectar con la API de la ESV. Revisa tu conexión.",
  errEsvKey: "La API de la ESV rechazó tu clave. Revísala en Ajustes.",
  errEsvStatus: (s) => `La API de la ESV devolvió un error (${s}).`,
  errReach: "No se pudo conectar con el servicio de búsqueda. Revisa tu conexión.",
  errStatus: (s) => `El servicio de búsqueda devolvió un error (${s}).`,
  errNotFound: (ref) => `No se encontró “${ref}”. Prueba con un formato como Juan 3:16.`,
  errNotFoundEnglish: (ref) => `No se encontró “${ref}”. Para las traducciones en inglés, escribe el libro en inglés, por ejemplo John 3:16.`,

  // Agregar: primero una sola caja
  quickLabel: "Referencia, versículo o cita",
  quickPlaceholder: "Escribe una referencia como Juan 3:16 o Salmo 23 RVR1960, o pega un versículo o una cita…",
  continue: "Continuar",
  searching: "Buscando…",
  checkTitle: "Revisa y agrega",
  checkDetails: "Revisa los datos de abajo.",
  fillMarked: "Por favor completa lo marcado.",
  askRef: "— por favor agrégala",
  askText: "— por favor pega el texto o búscalo",
  askTranslation: "— no se indicó, por favor revísala",
  back2: "Atrás",
  splitVerses: "Dividir en versículos",
  splitting: "Dividiendo…",
  pasteNotice: "El texto pegado se queda en tu dispositivo. Tú eres responsable del uso de las traducciones con derechos de autor.",
  foundInEntry: (what) => `Se encontró ${what} en lo que ingresaste.`,
  foundInTranslation: (ref, tr) => `Se encontró ${ref} en ${tr}.`,
  cantLookUp: (tr) => `${tr} no se puede buscar. Pega el texto abajo.`,
  needKeyDraft: `Para buscar en la ESV, agrega tu clave gratuita en <a href="#/settings">Ajustes</a>, o elige Reina-Valera 1909, KJV o WEB abajo y toca Buscar.`,
  foundPaste: (what) => `Se encontró ${what}. `,
  splitInto: (n) => `Se dividió en ${plural(n, "versículo", "versículos")}.`,
  splitMatched: (n, ref, source) => `Se dividió en ${plural(n, "versículo", "versículos")} al comparar ${ref} en ${source}.`,
  splitAlready: "Cada versículo ya está en su propia línea.",
  splitNeedRef: "Escribe primero la referencia arriba, para poder comparar los versículos.",
  splitSingle: (ref) => `${ref} es un solo versículo.`,
  splitNoMatch: (ref) => `No se pudo comparar este texto con ${ref}.`,
  splitNeedKey: "Agrega tu clave de la ESV en Ajustes.",
  voiceCheck: "Hay partes por revisar. Mira las notas en naranja.",
  voiceFound: (ref) => `Se encontró ${ref}.`,
  voiceAdd: "Toca Agregar a mis versículos.",
  voiceHeard: (said) => `Escuché ${said}. Toca Continuar si es correcto.`,

  // Agregar / editar
  editTitle: "Editar",
  addTitle: "Agregar un versículo o cita",
  refLabel: "Referencia o fuente",
  refPlaceholder: "p. ej., Romanos 8:28 o C. S. Lewis",
  translation: "Traducción",
  lookUp: "Buscar",
  lookingUp: "Buscando…",
  text: "Texto",
  textPlaceholder: "Búscalo arriba, o pega o escribe el pasaje…",
  tags: "Etiquetas",
  tagsHint: "— opcional, separadas por comas",
  tagsPlaceholder: "p. ej., fe, ansiedad",
  saveChanges: "Guardar cambios",
  addToVerses: "Agregar a mis versículos",
  cancel: "Cancelar",
  delete: "Eliminar",
  deleteConfirm: "Toca otra vez para eliminar",
  found: (ref, tr) => `Se encontró ${ref} (${tr}).`,
  needKey: `Para buscar en la ESV, agrega tu clave gratuita de la API de la ESV en <a href="#/settings">Ajustes</a>. La Reina-Valera 1909, la KJV y la WEB funcionan sin clave.`,
  saved: "Guardado.",
  added: "Agregado.",
  deleted: "Eliminado.",

  // Ajustes
  defaultTranslation: "Traducción predeterminada",
  esvKeyTitle: "Clave de la API de la ESV (opcional)",
  esvKeyIntro: "Solo la necesitas si quieres buscar versículos en la ESV, en inglés. Es gratuita, de Crossway, la editorial de la ESV, y solo se guarda en este dispositivo.",
  esvStep1: `Regístrate en <a href="https://api.esv.org/account/create-application/" target="_blank" rel="noopener">api.esv.org</a> (el sitio está en inglés).`,
  esvStep2: "Crea una aplicación. Una app personal y no comercial está bien.",
  esvStep3: "Copia la clave de la API y pégala aquí.",
  keyPlaceholder: "Pega tu clave de la API de la ESV",
  testSave: "Probar y guardar",
  testing: "Probando…",
  removeKey: "Quitar clave",
  sourcesNote: "El texto de la Reina-Valera 1909 se obtiene de getBible.net. Los textos KJV, WEB y ASV son de dominio público y se obtienen de bible-api.com.",
  defaultSaved: "Traducción predeterminada guardada.",
  keyFirst: "Primero pega una clave.",
  keySaved: "Clave de la ESV guardada. Ya puedes buscar versículos.",
  keyRemoved: "Clave de la ESV eliminada.",

  // Práctica
  back: "← Mis versículos",
  progress: (a, b) => `${a} de ${b}`,
  edit: "Editar",
  listen: "🔊 Escuchar",
  listenTitle: "Leer en voz alta",
  modes: { recall: "Recordar", fade: "Desvanecer", letters: "Primeras letras", type: "Escríbelo", scramble: "Ordenar", say: "Dilo", repeat: "Escucha y repite" },
  rateQuestion: "¿Qué tan bien lo sabías?",
  ratings: ["Otra vez", "Difícil", "Bien", "Fácil"],
  minutes: (n) => `${n} min`,
  days: (n) => plural(n, "día", "días"),
  months: (n) => plural(n, "mes", "meses"),
  rated: (r, when) => `${r}: próximo repaso en ${when}.`,
  recallPrompt: "Di o repasa mentalmente todo el pasaje de memoria.",
  showText: "Mostrar el texto",
  spaceKey: "(espacio)",
  recallCheck: "Compruébalo y luego califícate abajo.",
  fadeHelp: "Léelo en voz alta y luego desliza a la derecha para ocultar más palabras. Toca un espacio para ver la palabra.",
  showMore: "Mostrar más palabras",
  hideMore: "Ocultar más palabras",
  wordsHidden: "Palabras ocultas",
  lettersHelp: "Solo se muestra la primera letra de cada palabra. Recítalo y toca cualquier palabra en la que te atores.",
  typeHelp: "Escribe el pasaje de memoria. No importan la puntuación, los acentos ni las mayúsculas.",
  typePlaceholder: "Empieza a escribir…",
  check: "Revisar",
  tryAgain: "Intentar otra vez",
  score: (pct, got, total) => `${pct}% — ${got} de ${total} palabras`,
  scrambleHelp: "Toca las partes en el orden correcto.",
  scrambleDone: (m) => `¡Listo! ${m ? plural(m, "error", "errores") + "." : "Perfecto."}`,
  shuffleAgain: "Mezclar otra vez",
  noSpeech: "Este navegador no puede leer en voz alta.",

  // Voz
  voiceHelp: "Ayuda por voz",
  voiceHelpNote: "Lee en voz alta las instrucciones, los resultados y los mensajes, y empieza la práctica en los modos de voz. Actívala si leer te cuesta.",
  voiceOn: "Ayuda por voz activada.",
  voiceOff: "Ayuda por voz desactivada.",
  sayHelp: "Toca el micrófono y di el pasaje de memoria. Vuelve a tocar cuando termines.",
  sayStart: "🎤 Empezar",
  sayStop: "⏹ Detener",
  sayAgain: "🎤 Dilo otra vez",
  listening: "Escuchando…",
  noListen: "Tu navegador no puede escucharte. Prueba con Chrome o Safari, o usa Recordar y dilo en voz alta.",
  gotWords: (got, total) => `Acertaste ${got} de ${total} palabras.`,
  repeatHelp: "Escucha cada frase y repítela en la pausa. Toca Reproducir para empezar.",
  play: "▶ Reproducir",
  pause: "⏸ Pausa",
  playAgain: "▶ Otra vez",
  prevPhrase: "Frase anterior",
  nextPhrase: "Frase siguiente",
  hideWords: "🙈 Ocultar palabras",
  showWords: "Mostrar palabras",
  trySay: "🎤 Probar Dilo",
  sayWhole: "Ahora dilo completo.",
  sayRef: "🎤 Decir la referencia",
  micAllow: "Permite el micrófono para usar la voz.",
  micNone: "No se encontró un micrófono.",
  micNetwork: "Escuchar necesita conexión a internet.",
  micFail: "No se pudo iniciar el micrófono.",
  didntHear: "No te oí. Inténtalo otra vez.",

  // Fin del repaso
  reviewComplete: "Repaso terminado",
  nothingDue: "Nada pendiente",
  reviewedSummary: (n, streak) => `Repasaste ${plural(n, "versículo", "versículos")}. Racha: ${plural(streak, "día", "días")}.`,
  allCaughtUp: "Ya estás al día.",
  backToVerses: "Volver a mis versículos",
};

// La guía de usuario. Actualízala cuando cambie una función.
STRINGS.helpTitle = "Cómo usar Luz de mi Camino";
STRINGS.helpHint = "Toca un tema para abrirlo.";
STRINGS.helpTopics = [
  ["Agregar un versículo o una cita", `
    <p>Toca <b>+ Agregar</b> y escribe lo que tengas en la caja, y luego toca <b>Continuar</b>. Puedes ingresar:</p>
    <ul>
      <li><b>Una referencia</b>, como <i>Juan 3:16</i>, <i>Salmo 23</i> o <i>Romanos 8:28-30 RVR1960</i>. El texto se busca por ti.</li>
      <li><b>Un versículo o pasaje pegado</b>, con o sin su referencia y versión, como <i>Porque de tal manera amó Dios al mundo… (Juan 3:16 NVI)</i>.</li>
      <li><b>Cualquier cita</b> o texto propio.</li>
    </ul>
    <p>La siguiente pantalla muestra lo que se encontró: la referencia, la traducción y el texto. Revísalos y completa lo que esté marcado en naranja. Las etiquetas son opcionales: sirven para agrupar versículos, como <i>fe</i> o <i>ansiedad</i>. Luego toca <b>Agregar a mis versículos</b>. <b>Atrás</b> te lleva a la caja con lo que escribiste.</p>`],
  ["Traducciones", `
    <p>La Reina-Valera 1909, la ESV, la KJV, la WEB y la ASV se pueden buscar. Las demás, como RVR1960, NVI, LBLA, NTV, DHH, NIV o NASB, se pueden pegar y etiquetar, pero no buscar.</p>
    <p>Si lo que pegas no indica su versión, la app supone tu traducción predeterminada y te pide que la revises. Cámbiala en <a href="#/settings">Ajustes</a>.</p>`],
  ["Usar la ESV", `
    <p>La ESV necesita una clave gratuita de Crossway, su editorial:</p>
    <ol>
      <li>Regístrate en <a href="https://api.esv.org/account/create-application/" target="_blank" rel="noopener">api.esv.org</a> (el sitio está en inglés) y crea una aplicación personal y no comercial.</li>
      <li>Copia la clave de la API.</li>
      <li>Abre <a href="#/settings">Ajustes</a>, pega la clave y toca <b>Probar y guardar</b>.</li>
    </ol>
    <p>La clave se queda en tu dispositivo. Sin ella, usa la Reina-Valera 1909, la KJV, la WEB o la ASV.</p>`],
  ["Pasajes y números de versículo", `
    <p>Un pasaje se guarda con cada versículo en su propia línea numerada. Cuando pegas uno, la app lo divide por ti, usando los números de versículo del texto o comparándolo con el mismo pasaje. Si no se dividió, toca <b>Dividir en versículos</b> debajo del texto. Los números de versículo no forman parte de la práctica.</p>`],
  ["Practicar", `
    <p>Toca un versículo para practicarlo. Elige un modo arriba:</p>
    <ul>
      <li><b>Recordar:</b> ves la referencia, dices el pasaje de memoria y luego lo revelas.</li>
      <li><b>Desvanecer:</b> oculta más y más palabras con el control deslizante. Toca una palabra oculta para verla.</li>
      <li><b>Primeras letras:</b> solo se muestra la primera letra de cada palabra.</li>
      <li><b>Escríbelo:</b> lo escribes de memoria y recibes una puntuación palabra por palabra.</li>
      <li><b>Ordenar:</b> pones las frases mezcladas en orden.</li>
      <li><b>Dilo:</b> toca el micrófono y di el pasaje de memoria. Recibes una puntuación palabra por palabra.</li>
      <li><b>Escucha y repite:</b> oyes el pasaje frase por frase y dices cada una en la pausa. Toca <b>Ocultar palabras</b> para practicar solo de oído.</li>
    </ul>
    <p>Toca <b>Escuchar</b> para oír todo el pasaje en voz alta.</p>`],
  ["Ayuda por voz", `
    <p>Para quien lee con dificultad, la app puede hablar y escuchar.</p>
    <ul>
      <li><b>Ayuda por voz:</b> actívala en <a href="#/settings">Ajustes</a>. La app lee en voz alta las instrucciones, las puntuaciones y los mensajes, muestra primero los modos de voz y usa botones más grandes. La práctica empieza en <b>Escucha y repite</b>, y los repasos en <b>Dilo</b>.</li>
      <li><b>Agregar con la voz:</b> en la pantalla <b>+ Agregar</b>, toca <b>Decir la referencia</b> y dila, como <i>primera de Juan tres dieciséis</i> o <i>Salmo veintitrés</i>.</li>
      <li><b>Barra espaciadora:</b> inicia y detiene el micrófono en Dilo, y reproduce o pausa en Escucha y repite.</li>
    </ul>
    <p>Permite el micrófono cuando el navegador te lo pida. Escuchar funciona en Chrome, Edge y Safari, pero no en Firefox. Chrome y Edge envían lo que dices a sus fabricantes para convertirlo en texto, así que se necesita conexión a internet. Donde escuchar no esté disponible, los botones de micrófono se ocultan y Escucha y repite sigue funcionando.</p>`],
  ["Repasos y calificación", `
    <p>Después de practicar, califica qué tan bien lo sabías: <b>Otra vez</b>, <b>Difícil</b>, <b>Bien</b> o <b>Fácil</b>. La app programa el próximo repaso: más pronto para los versículos difíciles y más tarde para los que sabes bien.</p>
    <p>La pantalla de inicio muestra cuántos versículos están pendientes. Toca <b>Empezar repaso</b> para recorrerlos. Un versículo cuenta como <b>Dominado</b> cuando lo sabes lo bastante bien como para esperar 3 semanas entre repasos. Practica un poco cada día para mantener tu racha.</p>`],
  ["Editar y eliminar", `
    <p>Abre un versículo y toca <b>Editar</b> para cambiar su referencia, traducción, texto o etiquetas. <b>Eliminar</b> está en la pantalla de edición. Tócalo dos veces para confirmar.</p>`],
  ["Ponerla en tu teléfono", `
    <ul>
      <li><b>iPhone:</b> en Safari, toca <b>Compartir</b> y luego <b>Agregar a inicio</b>.</li>
      <li><b>Android:</b> en Chrome, toca <b>Instalar app</b>, o abre el menú <b>⋮</b> y elige <b>Agregar a la pantalla principal</b>.</li>
    </ul>
    <p>La app instalada se abre en pantalla completa y funciona sin conexión. Si agregaste versículos primero en el navegador, pásalos con una copia de seguridad, como se explica abajo.</p>`],
  ["Copias de seguridad", `
    <p>Tus versículos se guardan solo en este dispositivo, y no hay cuenta. Para protegerlos o pasarlos a otro dispositivo, toca <b>Exportar copia de seguridad</b> al final de la pantalla de inicio. En el otro dispositivo, toca <b>Importar copia de seguridad</b> y elige el archivo. Tu clave de la ESV no se incluye.</p>`],
  ["Actualizaciones", `
    <p>La versión y el mes de publicación se muestran al final de la pantalla. La app se actualiza sola: si no ves una versión nueva, cierra y vuelve a abrir la app una o dos veces.</p>`],
];

// Look up a phrase by name.
function t(key, ...args) {
  const v = STRINGS[key];
  return typeof v === "function" ? v(...args) : v;
}
