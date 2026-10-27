/* Interface text (Spanish). Verses and references are never translated.
 * Values are strings, or functions when the text depends on a number or name. */

"use strict";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const STRINGS = {
  add: "+ Agregar",
  settings: "Ajustes",
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
  translationNone: "Ninguna — una cita o mi propio texto",
  errEsvReach: "No se pudo conectar con la API de la ESV. Revisa tu conexión.",
  errEsvKey: "La API de la ESV rechazó tu clave. Revísala en Ajustes.",
  errEsvStatus: (s) => `La API de la ESV devolvió un error (${s}).`,
  errReach: "No se pudo conectar con el servicio de búsqueda. Revisa tu conexión.",
  errStatus: (s) => `El servicio de búsqueda devolvió un error (${s}).`,
  errNotFound: (ref) => `No se encontró “${ref}”. Prueba con un formato como Juan 3:16.`,
  errNotFoundEnglish: (ref) => `No se encontró “${ref}”. Para las traducciones en inglés, escribe el libro en inglés, por ejemplo John 3:16.`,

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
  needKey: `Para buscar en la ESV, agrega tu clave gratuita de la API de la ESV en <a href="#/settings">Ajustes</a>. La Reina-Valera 1909 funciona sin clave.`,
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
  sourcesNote: "El texto de la Reina-Valera 1909 se obtiene de getBible.net. Los textos KJV y WEB son de dominio público y se obtienen de bible-api.com.",
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
  modes: { recall: "Recordar", fade: "Desvanecer", letters: "Primeras letras", type: "Escríbelo", scramble: "Ordenar" },
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

  // Fin del repaso
  reviewComplete: "Repaso terminado",
  nothingDue: "Nada pendiente",
  reviewedSummary: (n, streak) => `Repasaste ${plural(n, "versículo", "versículos")}. Racha: ${plural(streak, "día", "días")}.`,
  allCaughtUp: "Ya estás al día.",
  backToVerses: "Volver a mis versículos",
};

// Look up a phrase by name.
function t(key, ...args) {
  const v = STRINGS[key];
  return typeof v === "function" ? v(...args) : v;
}
