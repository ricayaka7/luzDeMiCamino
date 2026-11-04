/* Luz de mi Camino — memoriza versículos bíblicos y citas.
 * Plain JS, no build step. Data lives in localStorage. Interface text is in strings.js. */

"use strict";

// Shares an origin (ricayaka7.github.io) with light2Path, so keys must not overlap.
const STORE_KEY = "luzdemicamino.v1";
const DAY = 86400000;
const MASTERED_DAYS = 21;
const MODES = ["recall", "fade", "letters", "type", "scramble", "say", "repeat"];
const VOICE_MODES = ["say", "repeat"];

const DEFAULT_SETTINGS = { translation: "RVR1909", esvKey: "", voiceHelp: false };

/* ---------- Storage ---------- */

let state = load();
let session = null;     // active practice session; null when not on the practice screen
let searchQuery = "";
let installPrompt = null; // deferred beforeinstallprompt event (Android / desktop Chrome)
const voice = { rec: null, timer: null, run: 0, toastUntil: 0 }; // active recognizer, pause timer, id of the current Escucha y repite run, when the last toast should finish being read

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && Array.isArray(saved.items)) {
      saved.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
      return saved;
    }
  } catch (e) { /* start fresh */ }
  return { version: 1, items: [], stats: { streak: 0, lastDay: null, reviews: 0 }, settings: { ...DEFAULT_SETTINGS } };
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast(t("saveFailed"));
  }
}

function newItem(ref, text, tags) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    ref: ref.trim(),
    text: text.trim(),
    tags: tags || [],
    created: Date.now(),
    srs: { due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0 },
  };
}

const findItem = (id) => state.items.find((i) => i.id === id);

/* ---------- Spaced repetition (simplified SM-2) ---------- */

function nextSrs(srs, rating) {
  let { interval, ease, reps, lapses } = srs;
  if (rating === 0) {
    reps = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0;
  } else {
    if (rating === 1) {
      interval = Math.max(1, interval * 1.2);
      ease = Math.max(1.3, ease - 0.15);
    } else {
      interval = reps === 0 ? 2 : reps === 1 ? 5 : interval * ease;
      if (rating === 3) {
        interval *= 1.3;
        ease = Math.min(3, ease + 0.15);
      }
    }
    reps += 1;
    interval = Math.round(interval * 10) / 10;
  }
  // "Again" comes back in 10 minutes; everything else in N days.
  const due = rating === 0 ? Date.now() + 10 * 60000 : Date.now() + interval * DAY;
  return { due, interval, ease, reps, lapses };
}

function formatInterval(srs) {
  if (srs.interval === 0) return t("minutes", 10);
  const d = Math.round(srs.interval);
  if (d < 30) return t("days", d);
  return t("months", Math.round(d / 30));
}

const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };
const isDue = (item) => item.srs.due <= endOfToday();
const isMastered = (item) => item.srs.interval >= MASTERED_DAYS;
const dueItems = () => state.items.filter(isDue).sort((a, b) => a.srs.due - b.srs.due);

function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function recordReview(item, rating) {
  item.srs = nextSrs(item.srs, rating);
  const s = state.stats;
  const today = dayKey(Date.now());
  if (s.lastDay !== today) {
    s.streak = s.lastDay === dayKey(Date.now() - DAY) ? s.streak + 1 : 1;
    s.lastDay = today;
  }
  s.reviews += 1;
  save();
}

function currentStreak() {
  const s = state.stats;
  const alive = s.lastDay === dayKey(Date.now()) || s.lastDay === dayKey(Date.now() - DAY);
  return alive ? s.streak : 0;
}

/* ---------- Text helpers ---------- */

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Split text into tokens, keeping whitespace so we can rebuild it exactly.
// Each word token is split into leading punctuation, core, trailing punctuation.
function tokenize(text) {
  return text.split(/(\s+)/).filter(Boolean).map((t) => {
    if (/^\s+$/.test(t)) return { space: t };
    const m = t.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    return { pre: m[1], core: m[2], post: m[3] };
  });
}

// Lowercase and drop accents and punctuation, so "Señor," matches "senor".
const normalize = (w) => w.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");
const wordsOf = (text) => text.split(/\s+/).map(normalize).filter(Boolean);

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Deterministic shuffle so the fade order is stable for each verse.
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let x = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Longest common subsequence over words: returns a Set of matched indices in `target`.
function lcsMatches(target, typed) {
  const n = target.length, m = typed.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = target[i] === typed[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const matched = new Set();
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (target[i] === typed[j]) { matched.add(i); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return matched;
}

// Like lcsMatches, but returns for each index in `a` the matched index in `b` (or -1).
// Returns null when the inputs are too long to compare quickly.
function lcsPairs(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 4e6) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = new Int32Array(n).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs[i] = j; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/* ---------- Verses ----------
 * A Bible passage is stored one verse per line, each line starting with its number:
 *   "16 Porque de tal manera amó Dios al mundo…\n17 Porque no envió Dios…"
 * A single verse or a quote is stored as plain text. Same format as light2Path. */

const VERSE_LINE = /^(\d{1,3}(?::\d{1,3})?)\s+(\S.*)$/;
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const squash = (s) => s.replace(/\s+/g, " ").trim();
const linesOf = (text) => text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
const hasNumberedLines = (text) => linesOf(text).filter((l) => VERSE_LINE.test(l)).length >= 2;

// Returns [{ num, text }]; num is null for a line without a verse number.
// Numbers count on a passage of numbered lines, or on a single verse like "16 Porque…",
// but not on text that just starts with a number, like "12 hombres fueron elegidos".
function versesOf(item) {
  const lines = linesOf(item.text);
  const numbered = hasNumberedLines(item.text)
    || (item.translation && lines.length === 1 && /^\d{1,3}(?::\d{1,3})?\s+\p{Lu}/u.test(lines[0]));
  return lines.map((line) => {
    const m = numbered && line.match(VERSE_LINE);
    return m ? { num: m[1], text: m[2] } : { num: null, text: line };
  });
}

// The words to memorize, without verse numbers.
const plainText = (item) => versesOf(item).map((v) => v.text).join("\n");
const versesToText = (verses) => verses.map((v) => (v.num ? `${v.num} ${v.text}` : v.text)).join("\n");
const vnumHtml = (v) => (v.num ? `<sup class="vnum">${esc(v.num)}</sup>` : "");
const lineHtml = (v, inner) => `<span class="vline">${vnumHtml(v)}${inner}</span>`;
const previewHtml = (item) => versesOf(item).map((v) => vnumHtml(v) + esc(v.text)).join(" ");

// Finds verse numbers inside pasted text ("16 Porque… 17 Porque…", "[16]", "¹⁶", "16Porque").
// Returns [{ num, text }] when at least two numbered verses are found, otherwise null.
function splitInlineNumbers(text) {
  const clean = text
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) => ` ${[...s].map((c) => SUPERSCRIPT_DIGITS.indexOf(c)).join("")} `)
    .replace(/[\[(](\d{1,3}(?::\d{1,3})?)[\])]/g, " $1 ")
    .replace(/(^|\s)(\d{1,3})(?=\p{Lu})/gu, "$1$2 ");
  const verses = [];
  const tokens = clean.split(/\s+/).filter(Boolean);
  let current = { num: null, words: [] }, last = null, chapter = null;
  tokens.forEach((tok, i) => {
    const m = tok.match(/^(?:(\d{1,3}):)?(\d{1,3})$/);
    if (!m) { current.words.push(tok); return; }
    const n = Number(m[2]), c = m[1] ? Number(m[1]) : null;
    // Bible sites often open a chapter with its number: "3 Había un hombre… 2 Este vino…".
    const afterChapterNumber = !c && n === 2 && last > 2 && !verses.length && current.num && current.words.length >= 3;
    // The first number has to open the text or follow punctuation, so "tomó 5 panes" doesn't count.
    const isFirst = last === null && (!current.words.length || /[.;:,!?"”’)»]$/.test(current.words[current.words.length - 1]));
    // After that, numbers have to continue the sequence or start a new chapter.
    const continues = last !== null && (c === null
      ? n === last + 1 || (n === 1 && last > 1 && tokens.slice(i + 1).includes("2"))
      : chapter === null ? n === 1 || n === last + 1 : (c === chapter && n === last + 1) || (c === chapter + 1 && n === 1));
    if (afterChapterNumber) current.num = "1";
    if (isFirst || continues || afterChapterNumber) {
      if (current.words.length) verses.push(current);
      current = { num: m[0], words: [] };
      last = n;
      if (c) chapter = c;
    } else {
      current.words.push(tok);
    }
  });
  if (current.words.length) verses.push(current);
  if (verses.filter((v) => v.num).length < 2) return null;
  // Some sites leave the number off the first verse: it's the one before the next verse.
  const next = !verses[0].num && verses[1].num.match(/^(?:(\d+):)?(\d+)$/);
  if (next && next[2] > 1) verses[0].num = (next[1] ? `${next[1]}:` : "") + (next[2] - 1);
  return verses.map((v) => ({ num: v.num, text: v.words.join(" ") }));
}

// Book names and common abbreviations (Spanish and English), for finding a reference in pasted text.
const NUMBERED_BOOKS = "Samuel|Sam|Sm|Kings|Kgs|Reyes|Re|Chronicles|Chron|Chr|Crónicas|Cronicas|Cr|Corinthians|Corintios|Cor|Co|Thessalonians|Tesalonicenses|Thess|Tes|Ts|Timothy|Timoteo|Tim|Ti|Peter|Pedro|Pet|Pe|John|Juan|Jn";
const BOOKS = [
  "Genesis|Gen|Exodus|Exod|Ex|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Judg|Ruth|Ezra|Nehemiah|Neh|Esther|Esth|Job|Psalms|Psalm|Psa|Ps|Proverbs|Prov|Ecclesiastes|Eccl|Song of Solomon|Song of Songs|Isaiah|Isa|Jeremiah|Jer|Lamentations|Lam|Ezekiel|Ezek|Daniel|Dan|Hosea|Hos|Joel|Amos|Obadiah|Obad|Jonah|Micah|Mic|Nahum|Nah|Habakkuk|Hab|Zephaniah|Zeph|Haggai|Hag|Zechariah|Zech|Malachi|Mal|Matthew|Matt|Mt|Mark|Mk|Luke|Lk|John|Jn|Acts|Romans|Rom|Galatians|Gal|Ephesians|Eph|Philippians|Phil|Colossians|Col|Titus|Philemon|Philem|Hebrews|Heb|James|Jas|Jude|Revelation|Rev",
  "Génesis|Genesis|Gn|Éxodo|Exodo|Levítico|Levitico|Lv|Números|Numeros|Nm|Deuteronomio|Dt|Josué|Josue|Jos|Jueces|Jue|Rut|Esdras|Esd|Nehemías|Nehemias|Ester|Est|Salmos|Salmo|Sal|Sl|Proverbios|Pr|Eclesiastés|Eclesiastes|Ecl|Cantares|Cantar de los Cantares|Cnt|Cant|Isaías|Isaias|Is|Jeremías|Jeremias|Jr|Lamentaciones|Ezequiel|Ez|Dn|Oseas|Os|Jl|Amós|Am|Abdías|Abdias|Abd|Jonás|Jon|Miqueas|Miq|Mi|Nahúm|Habacuc|Sofonías|Sofonias|Sof|Hageo|Zacarías|Zacarias|Zac|Malaquías|Malaquias|Mateo|Marcos|Mr|Mc|Lucas|Lc|Juan|Hechos|Hch|Romanos|Ro|Gálatas|Galatas|Ga|Efesios|Ef|Filipenses|Fil|Flp|Colosenses|Tito|Tit|Filemón|Filemon|Flm|Hebreos|Santiago|Stg|Sant|Judas|Apocalipsis|Ap|Apoc",
].join("|");
const REFERENCE = `(?<![A-Za-zÀ-ÿ0-9])(?:[1-3] ?(?:${NUMBERED_BOOKS})|${BOOKS})\\.? +\\d{1,3}(?::\\d{1,3})?(?: ?[-–—] ?(?:\\d{1,3}:)?\\d{1,3})?`;
const NOTICE_SIGNAL = /©|\(c\)\s*\d{4}|\bcopyright\s+(?:\(c\)|\d{4})|derechos reservados|all rights reserved|used by permission|[®™]|^\s*scripture\s+(?:quotations?|taken|quoted)\b.*\b(?:from|marked)\b/i;
const NOTICE_START = /scripture\s+(?:quotations?|taken|quoted)\b|(?:the\s+)?holy bible\b|copyright\b|©|\(c\)\s*\d{4}|derechos reservados|all rights reserved|used by permission|texto bíblico tomado|(?:las\s+)?citas bíblicas/i;
const MARKED_NOTICE = /[^.!?]*[®™]/;
const PASTED_URL = /(?:https?:\/\/|www\.)\S+|\b(?:bible|biblegateway|biblia|bibliaparatodos)\.(?:com|org)\S*/gi;

// Pulls the version and reference out of a pasted passage, along with copyright notices and links.
// A version only counts in brackets, next to a reference, alone on a line, or in a notice,
// and a reference only at the start or end of the paste, alone on a line, or next to a version,
// so words in the verse itself aren't mistaken for them.
// Returns { text, translation, ref }; the last two are null when not found.
function extractPasteInfo(pasted) {
  const known = translations().filter((v) => v.id);
  const spelled = known.flatMap((v) => [v.name, ...(v.alias || [])]).filter((n) => n && /\W/.test(n));
  const names = spelled.sort((a, b) => b.length - a.length).join("|");
  const ids = known.flatMap((v) => [v.id, ...(v.alias || []).filter((n) => !/\W/.test(n))]).join("|");
  const VERSION = `\\b(?:${names}|(?:${ids})(?:\\d{2,4})?)\\b`;
  const original = pasted.replace(/\r\n?/g, "\n");
  const REMOVED = "\0"; // marks what was taken out, so only separators next to it get cleaned up
  const tidy = (s) => s.replace(/[ \t\-–—~|·]*\0[ \t\-–—~|·:,]*/g, " ");
  let translation = null, ref = null;
  const take = (r, v) => {
    if (r && !ref) ref = r;
    if (v && !translation) translation = findVersion(v) || v.toUpperCase().replace(/\d+$/, "");
    return REMOVED;
  };

  let notices = "";
  let text = original.split("\n").map((line) => {
    if (!NOTICE_SIGNAL.test(line)) return line;
    const start = line.search(NOTICE_START);
    const cut = start >= 0 ? start : line.search(MARKED_NOTICE);
    if (cut < 0) return line;
    notices += line.slice(cut) + " ";
    return line.slice(0, cut) + REMOVED;
  }).join("\n").replace(PASTED_URL, REMOVED);
  text = tidy(text);

  // Next to each other: "Juan 3:16 (NVI)", "NVI Juan 3:16". Typed references may be in any case.
  const between = "[ \\t,:;|·\\-–—(\\[]*";
  text = text.replace(new RegExp(`[(\\[]?(${REFERENCE})${between}(${VERSION})[)\\]]?`, "i"), (_, r, v) => take(r, v));
  if (!ref) text = text.replace(new RegExp(`[(\\[]?(${VERSION})${between}(${REFERENCE})[)\\]]?`, "i"), (_, v, r) => take(r, v));
  // A version not in the list still counts in brackets with a reference: "(Salmo 1:1-6 XYZ)".
  if (!ref) text = text.replace(new RegExp(`[(\\[](${REFERENCE})[ ,]+([A-Z][A-Za-z]{1,5})\\d{0,4}[)\\]]`), (_, r, v) => take(r, v));
  // In brackets, then alone on a line.
  text = text.replace(new RegExp(`[(\\[] ?(${VERSION}) ?[)\\]]`, "g"), (_, v) => take(null, v));
  text = tidy(text);
  const wrap = "[\\s\\-–—~:;,.|·()\\[\\]\"'“”‘’«»]*";
  const aloneVersion = new RegExp(`^${wrap}(${VERSION})${wrap}$`, "i");
  const aloneRef = new RegExp(`^${wrap}(${REFERENCE})${wrap}$`, "i");
  text = text.split("\n").filter((l) => {
    const v = l.match(aloneVersion), r = l.match(aloneRef);
    if (v) take(null, v[1]);
    if (r) take(r[1], null);
    return !v && !r;
  }).join("\n");
  // At the start or end of the paste, leaving any quote marks and final punctuation of the verse.
  if (!ref) text = text.replace(new RegExp(`^[\\s\\-–—~:;,.|·)\\]]*(${REFERENCE})[\\s\\-–—~:;,.|·)\\]]*`, "i"), (_, r) => take(r, null));
  if (!ref) text = text.replace(new RegExp(`[\\s\\-–—~:|·(\\[]*(${REFERENCE})${wrap}$`, "i"), (_, r) => take(r, null));
  // With a reference found, a version also counts at the start or end: "Juan 3:16 Porque de tal… NVI".
  // Here it has to be in capitals or spelled out, so a verse ending in a word like "web" keeps it.
  if (ref && !translation) text = text.replace(new RegExp(`[\\s\\-–—~:;,|·(\\[]+(${VERSION})[)\\]]?[\\s.]*$`), (_, v) => take(null, v));
  if (ref && !translation) text = text.replace(new RegExp(`^[\\s(\\[]*(${VERSION})[)\\]]?[\\s\\-–—~:;,|·]+`), (_, v) => take(null, v));

  if (!translation) {
    const named = notices.match(new RegExp(VERSION));
    if (named) take(null, named[0]);
  }
  if (text === original) return { text: pasted, translation: null, ref: null };

  text = tidy(text).split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  const quoted = text.match(/^["“«]([^"“”«»]*)["”»]$/);
  return {
    text: quoted ? quoted[1].trim() : text,
    translation,
    ref: ref && ref.replace(/ ?[-–—] ?/, "-").replace(/^(\d ?)?\p{Ll}/u, (m) => m.toUpperCase()),
  };
}

// Splits text with no verse numbers by matching it word by word against `refVerses`
// (the same passage fetched from another translation).
const COMMON_WORDS = new Set(("a an and are as at be but by for from he her him his i in is it me my not of on or our she so that the their them they this to was we were who will with you your "
  + "el la los las un una unos unas y e o u de del al en que se no por con para su sus es son fue lo le les mi tu yo como pero mas sin sobre").split(" "));

function alignToVerses(text, refVerses) {
  const words = text.split(/\s+/).filter(Boolean);
  const pasted = words.map(normalize);
  const ref = [], starts = [];
  refVerses.forEach((v) => { starts.push(ref.length); ref.push(...wordsOf(v.text)); });
  const pairs = lcsPairs(ref, pasted);
  if (!pairs) return null;
  // Common words match almost anything, so only the meaningful ones decide if this is the same passage.
  const meaningful = ref.map((w, i) => i).filter((i) => !COMMON_WORDS.has(ref[i]));
  const matched = meaningful.filter((i) => pairs[i] >= 0).length;
  if (matched < 0.4 * meaningful.length) return null;

  // Where each verse starts in the pasted words: line it up with the nearest matched word.
  const cuts = starts.map((s, k) => {
    if (k === 0) return 0;
    let next = s; while (next < ref.length && pairs[next] < 0) next++;
    let prev = s - 1; while (prev >= 0 && pairs[prev] < 0) prev--;
    const lo = prev >= 0 ? pairs[prev] + 1 : 0;
    const hi = next < ref.length ? pairs[next] : words.length;
    const guess = Math.max(lo, Math.min(hi, next < ref.length ? pairs[next] - (next - s) : lo + (s - 1 - prev)));
    // Where translations differ, prefer breaking right after a sentence or clause ends.
    let best = null;
    for (let c = lo; c <= hi && c < words.length; c++) {
      if (c > 0 && /[.;:!?]["'”’)»]*$/.test(words[c - 1]) && (best === null || Math.abs(c - guess) < Math.abs(best - guess))) best = c;
    }
    return best === null ? guess : best;
  });
  const verses = [];
  cuts.forEach((c, k) => {
    const end = k + 1 < cuts.length ? Math.max(c, cuts[k + 1]) : words.length;
    const chunk = words.slice(c, end).join(" ");
    if (chunk) verses.push({ num: refVerses[k].num, text: chunk });
  });
  return verses.length >= 2 ? verses : null;
}

// Puts each verse of a passage on its own numbered line.
// Returns { text, count, how } on success, or { note } explaining why not.
async function splitIntoVerses(text, ref, translation) {
  if (hasNumberedLines(text)) return { note: t("splitAlready") };
  const inline = splitInlineNumbers(text);
  if (inline) return { text: versesToText(inline), count: inline.length, how: "numbers" };
  if (!ref) return { note: t("splitNeedRef") };
  // Look the passage up to find the verse breaks: the same translation if it can be looked up,
  // otherwise the Reina-Valera 1909 for Spanish, and the ESV (or the WEB without a key) for English.
  const wanted = canLookup(translation) ? translation : ENGLISH.includes(translation) ? "ESV" : "RVR1909";
  const source = wanted === "ESV" && !state.settings.esvKey ? "WEB" : wanted;
  const found = await lookupVerse(ref, source);
  if (found.verses.length < 2) return { note: t("splitSingle", esc(found.ref)) };
  const verses = alignToVerses(text, found.verses);
  if (!verses) return { note: t("splitNoMatch", esc(found.ref)) };
  return { text: versesToText(verses), count: verses.length, how: source };
}

/* ---------- UI helpers ---------- */

const app = document.getElementById("app");
const $ = (sel, root = app) => root.querySelector(sel);
const $$ = (sel, root = app) => Array.from(root.querySelectorAll(sel));

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  if (voiceOn() && !voice.rec) {
    // Screens change right after most toasts; keep this speech alive through that (see hush).
    voice.toastUntil = Date.now() + 1500 + msg.length * 70;
    say(msg, { queue: true });
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

function statusBadge(item) {
  if (item.srs.reps === 0 && item.srs.lapses === 0) return `<span class="badge badge-new">${t("badgeNew")}</span>`;
  if (isDue(item)) return `<span class="badge badge-due">${t("badgeDue")}</span>`;
  if (isMastered(item)) return `<span class="badge badge-mastered">${t("badgeMastered")}</span>`;
  const days = Math.max(1, Math.ceil((item.srs.due - Date.now()) / DAY));
  return `<span class="badge">${t("badgeIn", days)}</span>`;
}

/* ---------- Router ---------- */

window.addEventListener("hashchange", render);
window.addEventListener("keydown", onKey);

function render() {
  const [, view, id] = location.hash.slice(1).split("/");
  stopVoice();
  window.scrollTo(0, 0);
  if (view === "add") return renderQuickAdd();
  if (view === "edit") return renderForm(findItem(id));
  if (view === "practice" && findItem(id)) return startPractice(findItem(id), false);
  if (view === "review") return startReview();
  if (view === "settings") return renderSettings();
  if (view === "help") return renderHelp();
  renderHome();
}

/* ---------- Home ---------- */

function renderHome() {
  session = null;
  renderSidebar(null);
  const due = dueItems().length;
  const mastered = state.items.filter(isMastered).length;
  const empty = state.items.length === 0;

  app.innerHTML = `
    ${empty ? `
      <section class="welcome">
        <h1>${t("welcomeTitle")}</h1>
        <p class="muted">${t("welcomeBody")}</p>
        <a class="btn btn-cta" href="#/add">${t("addFirst")}</a>
      </section>` : `
      <section class="stats">
        <div class="stat"><b>${due}</b><span>${t("statDue")}</span></div>
        <div class="stat"><b>${state.items.length}</b><span>${t("statVerses")}</span></div>
        <div class="stat"><b>${mastered}</b><span>${t("statMastered")}</span></div>
        <div class="stat"><b>${currentStreak()}</b><span>${t("statStreak")}</span></div>
      </section>

      <div class="review-cta">
        ${due
          ? `<a class="btn btn-cta btn-block" href="#/review">${t("startReview", due)}</a>`
          : `<div class="empty">${t("caughtUp")}</div>`}
      </div>`}

    ${installCardHtml()}

    ${empty ? "" : `
      <section class="home-library">
        <h2>${t("myVerses")}</h2>
        <input type="search" class="search" placeholder="${t("searchLong")}" value="${esc(searchQuery)}" />
        <div class="list verse-list"></div>
      </section>`}

    <div class="row footer-actions">
      ${empty ? "" : `<button class="btn btn-sm btn-ghost" id="export">${t("exportBackup")}</button>`}
      <label class="btn btn-sm btn-ghost" style="margin:0;font-weight:500">
        ${t("importBackup")} <input type="file" id="import" accept="application/json" hidden />
      </label>
    </div>
  `;

  bindSearch(app);
  bindInstallCard();
  if (!empty) $("#export").addEventListener("click", exportData);
  $("#import").addEventListener("change", importData);
  renderLists();
}

/* ---------- Verse list (sidebar on wide screens, home screen on phones) ---------- */

const sidebar = document.getElementById("sidebar");
let activeId = null;

function renderSidebar(id) {
  activeId = id;
  const scroll = $(".verse-list", sidebar)?.scrollTop || 0;
  sidebar.innerHTML = `
    <div class="sidebar-head">
      <h2>${t("myVerses")} <span class="muted">${state.items.length || ""}</span></h2>
      <a class="btn btn-sm btn-ghost" href="#/add">${t("add")}</a>
    </div>
    ${state.items.length ? `<input type="search" class="search" placeholder="${t("searchShort")}" value="${esc(searchQuery)}" />` : ""}
    <div class="verse-list compact"></div>
  `;
  bindSearch(sidebar);
  renderLists();
  $(".verse-list", sidebar).scrollTop = scroll;
}

function bindSearch(root) {
  const search = $(".search", root);
  if (search) search.addEventListener("input", () => { searchQuery = search.value; renderLists(); });
}

function renderLists() {
  const q = searchQuery.trim().toLowerCase();
  const items = state.items
    .filter((i) => !q || [i.ref, i.text, ...i.tags].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => (isDue(b) - isDue(a)) || b.created - a.created);

  const html = items.length
    ? items.map((i) => `
        <a class="card ${i.id === activeId ? "active" : ""}" href="#/practice/${i.id}">
          <div class="card-head">
            <span class="card-ref">${refLabel(i)}</span>
            ${statusBadge(i)}
          </div>
          <div class="card-text">${previewHtml(i)}</div>
          ${i.tags.length ? `<div class="tags">${i.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </a>`).join("")
    : `<div class="empty">${q ? t("noMatches") : `${t("noVerses")}<br><a href="#/add">${t("addOne")}</a>`}</div>`;

  document.querySelectorAll(".verse-list").forEach((el) => (el.innerHTML = html));
}

/* ---------- Install to home screen ---------- */

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function installCardHtml() {
  if (isStandalone()) return "";
  let dismissed = false;
  try { dismissed = localStorage.getItem("luzdemicamino.installDismissed") === "1"; } catch (e) { /* ignore */ }
  if (dismissed) return "";

  let body;
  if (installPrompt) {
    body = `<p class="muted">${t("installBody")}</p>
      <button class="btn btn-primary btn-sm" id="install">${t("installButton")}</button>`;
  } else if (isIOS()) {
    body = `<p class="muted">${t("installIOS")}</p>`;
  } else {
    body = `<p class="muted">${t("installOther")}</p>`;
  }
  return `
    <section class="install-card">
      <div class="row"><h2 style="margin:0">${t("installTitle")}</h2><span class="spacer"></span>
        <button class="btn btn-sm btn-ghost" id="install-dismiss" aria-label="${t("dismiss")}">✕</button></div>
      ${body}
    </section>`;
}

function bindInstallCard() {
  const btn = $("#install");
  if (btn) btn.addEventListener("click", async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    renderHome();
  });
  const dismiss = $("#install-dismiss");
  if (dismiss) dismiss.addEventListener("click", () => {
    try { localStorage.setItem("luzdemicamino.installDismissed", "1"); } catch (e) { /* ignore */ }
    dismiss.closest(".install-card").remove();
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  if (!session && !location.hash.slice(2)) renderHome();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => { /* offline support unavailable */ });
}

function exportData() {
  const backup = { ...state, settings: { ...state.settings, esvKey: "" } }; // never put the API key in a file
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `luz-de-mi-camino-copia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then((txt) => {
    const data = JSON.parse(txt);
    if (!Array.isArray(data.items)) throw new Error("bad file");
    const known = new Set(state.items.map((i) => i.id));
    const added = data.items.filter((i) => i.id && i.text && !known.has(i.id));
    state.items.push(...added);
    save();
    toast(t("imported", added.length));
    renderHome();
  }).catch(() => toast(t("badBackup")));
}

/* ---------- Verse lookup ---------- */

// Spanish and English versions. `lookup: false` ones can be pasted and labelled, but not looked up.
const translations = () => [
  { id: "RVR1909", label: t("translationRV"), name: "Reina-Valera 1909", alias: ["Reina Valera 1909", "RV1909"], spanish: true },
  { id: "ESV", label: t("translationESV"), name: "English Standard Version" },
  { id: "KJV", label: t("translationKJV"), name: "King James Version" },
  { id: "WEB", label: t("translationWEB"), name: "World English Bible" },
  { id: "ASV", label: t("translationASV"), name: "American Standard Version" },
  { id: "RVR1960", label: "RVR1960", name: "Reina-Valera 1960", alias: ["Reina Valera 1960", "RV1960"], spanish: true, lookup: false },
  { id: "RVR1995", label: "RVR1995", name: "Reina-Valera 1995", alias: ["Reina Valera 1995", "RV1995"], spanish: true, lookup: false },
  { id: "RVC", label: "RVC", name: "Reina Valera Contemporánea", spanish: true, lookup: false },
  { id: "RVA", label: "RVA", name: "Reina-Valera Actualizada", alias: ["Reina Valera Actualizada"], spanish: true, lookup: false },
  { id: "NVI", label: "NVI", name: "Nueva Versión Internacional", spanish: true, lookup: false },
  { id: "LBLA", label: "LBLA", name: "La Biblia de las Américas", spanish: true, lookup: false },
  { id: "NBLA", label: "NBLA", name: "Nueva Biblia de las Américas", spanish: true, lookup: false },
  { id: "NTV", label: "NTV", name: "Nueva Traducción Viviente", spanish: true, lookup: false },
  { id: "DHH", label: "DHH", name: "Dios Habla Hoy", spanish: true, lookup: false },
  { id: "TLA", label: "TLA", name: "Traducción en Lenguaje Actual", spanish: true, lookup: false },
  { id: "PDT", label: "PDT", name: "Palabra de Dios para Todos", spanish: true, lookup: false },
  { id: "BTX", label: "BTX", name: "Biblia Textual", spanish: true, lookup: false },
  { id: "NBV", label: "NBV", name: "Nueva Biblia Viva", spanish: true, lookup: false },
  { id: "NIV", label: "NIV", name: "New International Version", lookup: false },
  { id: "NASB", label: "NASB", name: "New American Standard Bible", lookup: false },
  { id: "NKJV", label: "NKJV", name: "New King James Version", lookup: false },
  { id: "NLT", label: "NLT", name: "New Living Translation", lookup: false },
  { id: "CSB", label: "CSB", name: "Christian Standard Bible", lookup: false },
  { id: "RSV", label: "RSV", name: "Revised Standard Version", lookup: false },
  { id: "NRSV", label: "NRSV", name: "New Revised Standard Version", lookup: false },
  { id: "AMP", label: "AMP", name: "Amplified Bible", lookup: false },
  { id: "MSG", label: "MSG (The Message)", name: "The Message", lookup: false },
  { id: "YLT", label: "YLT (Young's Literal)", name: "Young's Literal Translation", lookup: false },
  { id: "LSB", label: "LSB", name: "Legacy Standard Bible", lookup: false },
  { id: "NET", label: "NET", name: "New English Translation", lookup: false },
  { id: "HCSB", label: "HCSB", name: "Holman Christian Standard Bible", lookup: false },
  { id: "NIRV", label: "NIrV", name: "New International Reader's Version", lookup: false },
  { id: "NABRE", label: "NABRE", name: "New American Bible", lookup: false },
  { id: "CEB", label: "CEB", name: "Common English Bible", lookup: false },
  { id: "CEV", label: "CEV", name: "Contemporary English Version", lookup: false },
  { id: "GNT", label: "GNT (Good News)", name: "Good News Translation", lookup: false },
  { id: "NCV", label: "NCV", name: "New Century Version", lookup: false },
  { id: "TLB", label: "TLB (Living Bible)", name: "The Living Bible", lookup: false },
  { id: "TPT", label: "TPT", name: "The Passion Translation", lookup: false },
  { id: "BSB", label: "BSB", name: "Berean Standard Bible", lookup: false },
  { id: "LEB", label: "LEB", name: "Lexham English Bible", lookup: false },
  { id: "", label: t("translationNone") },
];
const ENGLISH = translations().filter((v) => v.id && !v.spanish).map((v) => v.id);
const canLookup = (id) => translations().some((v) => v.id && v.id === id && v.lookup !== false);

// "NIV", "new international version" or "RV1909" -> "NIV" / "RVR1909"; null if unknown.
// A trailing year is ignored: "ESV2011".
function findVersion(word) {
  if (!word) return null;
  const w = word.trim().toLowerCase();
  const known = translations().filter((v) => v.id);
  const hit = known.find((v) => [v.id, v.name, ...(v.alias || [])].some((n) => n.toLowerCase() === w))
    || known.find((v) => v.id.toLowerCase() === w.replace(/\d{2,4}$/, ""));
  return hit ? hit.id : null;
}
// Crossway's required wording; kept in English as published.
const ESV_NOTICE = "Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

// Returns { ref, verses, text } or throws an Error with a message fit to show the user.
async function lookupVerse(ref, translation) {
  if (translation === "RVR1909") return lookupReinaValera(ref);
  if (translation === "ESV") {
    const key = state.settings.esvKey;
    if (!key) throw new Error("NO_KEY");
    const params = new URLSearchParams({
      q: ref,
      "include-passage-references": "false",
      "include-verse-numbers": "true",
      "include-first-verse-numbers": "true",
      "include-footnotes": "false",
      "include-footnote-body": "false",
      "include-headings": "false",
      "include-short-copyright": "false",
      "include-selahs": "true",
      "indent-paragraphs": "0",
      "indent-poetry": "false",
    });
    let res;
    try {
      res = await fetch(`https://api.esv.org/v3/passage/text/?${params}`, { headers: { Authorization: `Token ${key}` } });
    } catch (e) {
      throw new Error(t("errEsvReach"));
    }
    if (res.status === 401 || res.status === 403) throw new Error(t("errEsvKey"));
    if (!res.ok) throw new Error(t("errEsvStatus", res.status));
    const data = await res.json();
    const verses = parseEsvVerses((data.passages || []).join(" "));
    if (!verses.length) throw new Error(t("errNotFoundEnglish", ref));
    return passage(data.canonical || ref, verses);
  }

  let res;
  try {
    res = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${translation.toLowerCase()}`);
  } catch (e) {
    throw new Error(t("errReach"));
  }
  if (res.status === 404) throw new Error(t("errNotFoundEnglish", ref));
  if (!res.ok) throw new Error(t("errStatus", res.status));
  const data = await res.json();
  const list = data.verses || [];
  const chapters = new Set(list.map((v) => v.chapter));
  const verses = list
    .map((v) => ({ num: chapters.size > 1 ? `${v.chapter}:${v.verse}` : String(v.verse), text: squash(v.text || "") }))
    .filter((v) => v.text);
  if (!verses.length) verses.push({ num: null, text: squash(data.text || "") });
  return passage(data.reference || ref, verses);
}

// ESV text with verse numbers looks like "[16] For God so loved… [17] For God did not…".
function parseEsvVerses(raw) {
  const parts = raw.split(/\[(\d+(?::\d+)?)\]/);
  const verses = squash(parts[0]) ? [{ num: null, text: squash(parts[0]) }] : [];
  for (let i = 1; i < parts.length; i += 2) {
    const text = squash(parts[i + 1] || "");
    if (text) verses.push({ num: parts[i], text });
  }
  return verses;
}

// A single verse is stored without its number; a passage gets one numbered line per verse.
const passage = (ref, verses) => ({ ref, verses, text: verses.length > 1 ? versesToText(verses) : verses[0].text });

/* Reina-Valera 1909 via getBible.net, which is organized by book number and chapter. */

const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
let rvBooks = null; // [{ nr, name, key }] loaded once per session

// Common Spanish abbreviations that aren't a unique prefix of the book name (folded form → book number).
const RV_ABBREVIATIONS = {
  gn: 1, ex: 2, lv: 3, nm: 4, dt: 5, jos: 6, jue: 7, rt: 8, "1s": 9, "2s": 10, "1r": 11, "2r": 12,
  "1cr": 13, "2cr": 14, esd: 15, neh: 16, est: 17, jb: 18, sal: 19, sl: 19, pr: 20, prov: 20,
  ec: 21, ecl: 21, cnt: 22, cant: 22, is: 23, jr: 24, jer: 24, lm: 25, ez: 26, dn: 27, os: 28,
  jl: 29, am: 30, abd: 31, jon: 32, mi: 33, nah: 34, hab: 35, sof: 36, hag: 37, zac: 38, mal: 39,
  mt: 40, mr: 41, mc: 41, lc: 42, jn: 43, hch: 44, ro: 45, rom: 45, "1co": 46, "2co": 47,
  ga: 48, gal: 48, ef: 49, fil: 50, flp: 50, col: 51, "1ts": 52, "2ts": 53, "1ti": 54, "2ti": 55,
  tit: 56, flm: 57, heb: 58, stg: 59, sant: 59, "1p": 60, "2p": 61, "1jn": 62, "2jn": 63, "3jn": 64,
  jud: 65, ap: 66, apoc: 66,
};

// Psalm 119's Hebrew letter headings ("ALEPH.", "NUN.") are printed, not part of the verse.
const HEBREW_HEADING = /^(ALEPH|BETH|GIMEL|DALETH|HE|VAU|ZAIN|CHETH|TETH|JOD|CAPH|LAMED|MEM|NUN|SAMECH|AIN|PE|TSADDI|COPH|RESH|SIN|SCHIN|TAU)\.\s+/;

function cleanRvVerse(text) {
  return text.trim()
    .replace(HEBREW_HEADING, "")
    // Chapters open with a capitalized word ("EN el principio", "JEHOVÁ es"); write it normally.
    .replace(/^(\p{Lu})(\p{Lu}+)(?!\p{L})/u, (_, a, b) => a + b.toLowerCase());
}

async function getJson(url) {
  let res;
  try { res = await fetch(url); } catch (e) { throw new Error(t("errReach")); }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(t("errStatus", res.status));
  return res.json();
}

async function lookupReinaValera(ref) {
  // "Juan 3:16", "1 Juan 1:9", "Salmo 23", "Prov 3:5-6", "romanos 8.28"
  const m = ref.trim().match(/^(.+?)\s*(\d+)(?:\s*[:.,]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!m) throw new Error(t("errNotFound", ref));
  const [, bookText, chapter, from, to] = m;

  if (!rvBooks) {
    const data = await getJson("https://api.getbible.net/v2/valera/books.json");
    if (!data) throw new Error(t("errStatus", 404));
    rvBooks = Object.values(data).map((b) => ({ nr: b.nr, name: b.name, key: fold(b.name) }));
  }
  const want = fold(bookText);
  if (!want) throw new Error(t("errNotFound", ref));
  // Exact name, then a known abbreviation ("Fil", "Jn"), then a unique prefix ("Salmo", "1 Cor").
  const book = rvBooks.find((b) => b.key === want) ||
    rvBooks.find((b) => b.nr === RV_ABBREVIATIONS[want]) ||
    (() => { const hits = rvBooks.filter((b) => b.key.startsWith(want)); return hits.length === 1 ? hits[0] : null; })();
  if (!book) throw new Error(t("errNotFound", ref));

  const data = await getJson(`https://api.getbible.net/v2/valera/${book.nr}/${chapter}.json`);
  if (!data || !data.verses) throw new Error(t("errNotFound", ref));
  const first = from ? Number(from) : 1;
  const last = to ? Number(to) : from ? first : Infinity;
  const verses = data.verses.filter((v) => v.verse >= first && v.verse <= last);
  if (!verses.length) throw new Error(t("errNotFound", ref));

  const span = !from ? "" : `:${first}${verses.length > 1 ? `-${verses[verses.length - 1].verse}` : ""}`;
  return passage(`${book.name} ${chapter}${span}`, verses.map((v) => ({ num: String(v.verse), text: squash(cleanRvVerse(v.text)) })));
}

const refLabel = (item) =>
  esc(item.ref) + (item.translation ? ` <span class="translation">${esc(item.translation)}</span>` : "");

/* ---------- Add: one box first ---------- */

// The add screen starts with a single box. Whatever goes in it is searched,
// then the full form opens with what was found filled in and what's missing marked.
function renderQuickAdd(input = "") {
  session = null;
  renderSidebar(null);
  app.innerHTML = `
    <h1>${t("addTitle")}</h1>
    <form id="quick">
      ${canListen() ? `<button type="button" class="btn mic-btn" id="mic">${t("sayRef")}</button>` : ""}
      <label for="entry">${t("quickLabel")}</label>
      <textarea id="entry" class="entry" required placeholder="${t("quickPlaceholder")}">${esc(input)}</textarea>
      <div class="row form-actions">
        <button class="btn btn-primary" type="submit" id="go">${t("continue")}</button>
        <a class="btn btn-ghost" href="#/">${t("cancel")}</a>
      </div>
    </form>
  `;
  const entry = $("#entry"), go = $("#go"), mic = $("#mic");
  if (!voiceOn() || !mic) entry.focus(); // with Voice help the mic comes first, so don't pop up the keyboard
  if (mic) {
    mic.addEventListener("click", () => {
      if (voice.rec) return voice.rec.stop();
      hush(true);
      const lang = voiceLang(state.settings.translation);
      let heard = "";
      const rec = listen({
        lang,
        onText: (text) => { heard = text; entry.value = text; },
        onEnd: (failed) => {
          if (!entry.isConnected) return;
          mic.classList.remove("on");
          mic.textContent = t("sayRef");
          if (!heard) return failed ? undefined : toast(t("didntHear"));
          const ref = spokenRef(heard, lang);
          entry.value = ref;
          if (REF_ENTRY.test(ref)) $("#quick").requestSubmit();
          else if (voiceOn()) say(t("voiceHeard", heard));
        },
      });
      if (!rec) return toast(t("micFail"));
      mic.classList.add("on");
      mic.textContent = t("sayStop");
    });
  }
  // Enter continues when a reference was typed; pasted passages keep their line breaks.
  entry.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey || REF_ENTRY.test(entry.value.trim()))) {
      e.preventDefault();
      $("#quick").requestSubmit();
    }
  });
  $("#quick").addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = entry.value.trim();
    if (!value) return;
    go.disabled = true;
    go.textContent = t("searching");
    const draft = await identifyEntry(value);
    if (location.hash === "#/add") renderForm(null, draft);
  });
}

// A typed reference with an optional version: "juan 3:16", "Salmo 23 (RVR1960)".
const REF_ENTRY = new RegExp(`^(${REFERENCE})\\s*[(\\[]?\\s*([a-z]{2,5}\\d{0,4})?\\s*[)\\]]?$`, "i");

// Works out what was entered and fills in what it can.
// Returns { input, ref, text, translation, notes, missing, checkTranslation }.
async function identifyEntry(input) {
  const draft = { input, ref: "", text: "", translation: null, notes: [], missing: [], checkTranslation: false };
  const typedRef = input.match(REF_ENTRY);
  if (typedRef && (!typedRef[2] || findVersion(typedRef[2]))) {
    draft.ref = typedRef[1].replace(/ ?[-–—] ?/, "-").replace(/^(\d ?)?\p{Ll}/u, (m) => m.toUpperCase());
    draft.translation = findVersion(typedRef[2]);
  } else {
    const info = extractPasteInfo(input);
    Object.assign(draft, { text: info.text.trim(), ref: info.ref || "", translation: info.translation });
  }

  // No version given: a reference means scripture in the usual translation; otherwise it may be any quote.
  if (!draft.translation) {
    draft.translation = draft.ref ? state.settings.translation : "";
    draft.checkTranslation = Boolean(draft.ref && draft.text);
  }

  if (draft.ref && !draft.text) {
    if (canLookup(draft.translation)) {
      try {
        const found = await lookupVerse(draft.ref, draft.translation);
        Object.assign(draft, { ref: found.ref, text: found.text });
        draft.notes.push(esc(t("foundInTranslation", found.ref, draft.translation)));
      } catch (e) {
        draft.notes.push(e.message === "NO_KEY" ? t("needKeyDraft") : esc(e.message));
        draft.error = true;
      }
    } else {
      draft.notes.push(esc(t("cantLookUp", draft.translation)));
    }
  } else if (draft.text) {
    const stated = !draft.checkTranslation && draft.translation;
    const found = [draft.ref, stated && `(${draft.translation})`].filter(Boolean).join(" ");
    if (found) draft.notes.push(esc(t("foundInEntry", found)));
    if (draft.ref && draft.translation) {
      try {
        const split = await splitIntoVerses(draft.text, draft.ref, draft.translation);
        if (split.text) {
          draft.text = split.text;
          draft.notes.push(esc(t("splitInto", split.count)));
        }
      } catch (e) { /* leave the text as entered */ }
    }
  }

  if (!draft.ref) draft.missing.push("ref");
  if (!draft.text) draft.missing.push("text");
  return draft;
}

/* ---------- Add / edit ---------- */

// `draft` comes from the one-box add screen: fields to fill in, notes, and what's still missing.
function renderForm(item, draft) {
  session = null;
  renderSidebar(item ? item.id : null);
  const current = item ? item.translation || "" : draft ? draft.translation : state.settings.translation;
  const missing = (field) => Boolean(draft && draft.missing.includes(field));
  const ask = (field, key) => (missing(field) ? ` <span class="hint ask">${t(key)}</span>` : "");
  if (draft && voiceOn()) {
    if (draft.missing.length || draft.checkTranslation) say(t("voiceCheck"));
    else {
      say(t("voiceFound", draft.ref));
      say(squash(draft.text).slice(0, 400), { queue: true, lang: voiceLang(draft.translation) });
      say(t("voiceAdd"), { queue: true });
    }
  }

  app.innerHTML = `
    <h1>${item ? t("editTitle") : draft ? t("checkTitle") : t("addTitle")}</h1>
    ${draft ? `<p class="lookup-msg draft-msg ${draft.error ? "error" : ""}">${draft.notes.join(" ") || t("checkDetails")}
      ${draft.missing.length ? ` ${t("fillMarked")}` : ""}</p>` : ""}
    <form id="form">
      <label for="ref">${t("refLabel")}${ask("ref", "askRef")}</label>
      <input type="text" id="ref" required autocomplete="off" placeholder="${t("refPlaceholder")}" class="${missing("ref") ? "missing" : ""}" value="${esc(item ? item.ref : draft ? draft.ref : "")}" />

      <label for="translation">${t("translation")}${draft && draft.checkTranslation ? ` <span class="hint ask">${t("askTranslation")}</span>` : ""}</label>
      <div class="row lookup-row">
        <select id="translation">
          ${translations().map((o) => `<option value="${o.id}" ${o.id === current ? "selected" : ""}>${o.label}</option>`).join("")}
          ${translations().some((o) => o.id === current) ? "" : `<option value="${esc(current)}" selected>${esc(current)}</option>`}
        </select>
        <button class="btn" type="button" id="lookup">${t("lookUp")}</button>
      </div>
      <p class="lookup-msg" id="lookup-msg" hidden></p>

      <label for="text">${t("text")}${ask("text", "askText")}</label>
      <textarea id="text" required placeholder="${t("textPlaceholder")}" class="${missing("text") ? "missing" : ""}">${esc(item ? item.text : draft ? draft.text : "")}</textarea>
      <div class="row text-tools">
        <button class="btn btn-sm btn-ghost" type="button" id="split">${t("splitVerses")}</button>
        <p class="lookup-msg" id="text-msg" hidden></p>
      </div>
      <p class="notice">${t("pasteNotice")}</p>

      <label for="tags">${t("tags")} <span class="hint">${t("tagsHint")}</span></label>
      <input type="text" id="tags" placeholder="${t("tagsPlaceholder")}" value="${esc(item ? item.tags.join(", ") : "")}" />

      <div class="row form-actions">
        <button class="btn btn-primary" type="submit">${item ? t("saveChanges") : t("addToVerses")}</button>
        ${draft ? `<button class="btn btn-ghost" type="button" id="back">${t("back2")}</button>` : ""}
        <a class="btn btn-ghost" href="${item ? `#/practice/${item.id}` : "#/"}">${t("cancel")}</a>
        <span class="spacer"></span>
        ${item ? `<button class="btn btn-ghost btn-danger" type="button" id="delete">${t("delete")}</button>` : ""}
      </div>
    </form>
  `;

  const refInput = $("#ref"), select = $("#translation"), lookupBtn = $("#lookup"), msg = $("#lookup-msg");
  const textArea = $("#text"), splitBtn = $("#split"), textMsg = $("#text-msg");
  if (draft) {
    const first = draft.missing[0] === "ref" ? refInput : draft.missing[0] === "text" ? textArea : $("button[type=submit]");
    first.focus();
    $("#back").addEventListener("click", () => renderQuickAdd(draft.input));
    $$(".missing").forEach((el) => el.addEventListener("input", () => el.classList.toggle("missing", !el.value.trim())));
  } else {
    refInput.focus();
  }

  const textNote = (html, isError) => {
    textMsg.innerHTML = html;
    textMsg.classList.toggle("error", Boolean(isError));
    textMsg.hidden = !html;
  };
  const showMsg = (html, isError) => {
    msg.innerHTML = html;
    msg.classList.toggle("error", Boolean(isError));
    msg.hidden = !html;
  };
  const syncButtons = () => { lookupBtn.hidden = !canLookup(select.value); splitBtn.hidden = !select.value; };
  const syncLookup = () => { syncButtons(); showMsg(""); textNote(""); };
  select.addEventListener("change", syncLookup);
  syncLookup();

  async function doLookup() {
    const ref = refInput.value.trim();
    if (!ref) { refInput.focus(); return; }
    lookupBtn.disabled = true;
    lookupBtn.textContent = t("lookingUp");
    try {
      const found = await lookupVerse(ref, select.value);
      refInput.value = found.ref;
      textArea.value = found.text;
      textArea.classList.remove("missing");
      showMsg(esc(t("found", found.ref, select.value)));
    } catch (e) {
      showMsg(e.message === "NO_KEY" ? t("needKey") : esc(e.message), true);
    } finally {
      lookupBtn.disabled = false;
      lookupBtn.textContent = t("lookUp");
    }
  }
  lookupBtn.addEventListener("click", doLookup);
  // Enter in the reference field looks it up when there's no text yet.
  refInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && canLookup(select.value) && !textArea.value.trim()) { e.preventDefault(); doLookup(); }
  });

  // Moves a version and reference found in the text into their own fields.
  // Returns a sentence saying what was found, or "".
  function applyPasteInfo() {
    const info = extractPasteInfo(textArea.value);
    const fillRef = info.ref && !refInput.value.trim();
    textArea.value = info.text;
    if (info.translation) { select.value = info.translation; syncButtons(); }
    if (fillRef) refInput.value = info.ref;
    const found = [fillRef && info.ref, info.translation && (fillRef ? `(${info.translation})` : info.translation)].filter(Boolean).join(" ");
    return found ? esc(t("foundPaste", found)) : "";
  }

  // Put each verse on its own line. Runs on paste, on the button, and when the reference changes.
  // `manual` shows why it couldn't, and is the only way a reference that doesn't look biblical gets looked up.
  async function trySplit(manual, found = "") {
    const before = textArea.value, ref = refInput.value.trim();
    if (!select.value || !before.trim()) return;
    const usableRef = manual || new RegExp(`^${REFERENCE}`, "i").test(ref) ? ref : "";
    if (manual) { splitBtn.disabled = true; splitBtn.textContent = t("splitting"); }
    try {
      const result = await splitIntoVerses(before, usableRef, select.value);
      if (textArea.value !== before) return; // they kept typing
      if (result.text) {
        textArea.value = result.text;
        textNote(found + esc(result.how === "numbers"
          ? t("splitInto", result.count)
          : t("splitMatched", result.count, ref, result.how)));
      } else if (manual) {
        textNote(found + result.note);
      }
    } catch (err) {
      if (manual) textNote(found + (err.message === "NO_KEY" ? t("splitNeedKey") : esc(err.message)), true);
    } finally {
      if (manual) { splitBtn.disabled = false; splitBtn.textContent = t("splitVerses"); }
    }
  }
  splitBtn.addEventListener("click", () => trySplit(true));
  textArea.addEventListener("paste", () => setTimeout(() => {
    const found = applyPasteInfo();
    if (found) textNote(found);
    trySplit(false, found);
  }, 0));
  refInput.addEventListener("change", () => trySplit(false));

  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const ref = refInput.value.trim();
    const text = textArea.value.trim();
    const tags = $("#tags").value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    const translation = select.value;
    if (!ref || !text) return;
    const editing = Boolean(item);
    if (editing) {
      Object.assign(item, { ref, text, tags, translation });
    } else {
      item = newItem(ref, text, tags);
      item.translation = translation;
      state.items.push(item);
    }
    save();
    toast(editing ? t("saved") : t("added"));
    location.hash = `#/practice/${item.id}`;
  });

  const del = $("#delete");
  if (del) {
    del.addEventListener("click", () => {
      if (del.dataset.armed) {
        state.items = state.items.filter((i) => i !== item);
        save();
        toast(t("deleted"));
        location.hash = "#/";
      } else {
        del.dataset.armed = "1";
        del.textContent = t("deleteConfirm");
      }
    });
  }
}

/* ---------- Help ---------- */

function renderHelp() {
  session = null;
  renderSidebar(null);
  app.innerHTML = `
    <h1>${t("helpTitle")}</h1>
    <p class="muted">${t("helpHint")}</p>
    <div class="help">
      ${t("helpTopics").map(([title, body], i) => `<details class="help-item" ${i === 0 ? "open" : ""}><summary>${title}</summary>${body}</details>`).join("")}
    </div>
  `;
}

/* ---------- Settings ---------- */

function renderSettings() {
  session = null;
  renderSidebar(null);
  const s = state.settings;

  app.innerHTML = `
    <h1>${t("settings")}</h1>

    <label for="default-translation">${t("defaultTranslation")}</label>
    <select id="default-translation">
      ${translations().filter((o) => o.lookup !== false).map((o) => `<option value="${o.id}" ${o.id === s.translation ? "selected" : ""}>${o.label}</option>`).join("")}
    </select>

    <label class="check"><input type="checkbox" id="voice-help" ${s.voiceHelp ? "checked" : ""} /> ${t("voiceHelp")}</label>
    <p class="muted check-note">${t("voiceHelpNote")}</p>

    <section class="settings-card">
      <h2>${t("esvKeyTitle")}</h2>
      <p class="muted">${t("esvKeyIntro")}</p>
      <ol class="muted steps">
        <li>${t("esvStep1")}</li>
        <li>${t("esvStep2")}</li>
        <li>${t("esvStep3")}</li>
      </ol>
      <input type="text" id="esv-key" autocomplete="off" spellcheck="false" placeholder="${t("keyPlaceholder")}" value="${esc(s.esvKey)}" />
      <div class="row stage-tools">
        <button class="btn btn-primary" id="save-key">${esc(t("testSave"))}</button>
        ${s.esvKey ? `<button class="btn btn-ghost btn-danger" id="remove-key">${t("removeKey")}</button>` : ""}
      </div>
      <p class="lookup-msg" id="key-msg" hidden></p>
    </section>

    <p class="notice">${ESV_NOTICE}</p>
    <p class="notice">${t("sourcesNote")}</p>
  `;

  $("#default-translation").addEventListener("change", (e) => {
    s.translation = e.target.value;
    save();
    toast(t("defaultSaved"));
  });

  $("#voice-help").addEventListener("change", (e) => {
    s.voiceHelp = e.target.checked;
    save();
    applyVoiceClass();
    toast(t(s.voiceHelp ? "voiceOn" : "voiceOff"));
  });

  const msg = $("#key-msg");
  const showMsg = (text, isError) => { msg.textContent = text; msg.classList.toggle("error", isError); msg.hidden = false; };

  $("#save-key").addEventListener("click", async (e) => {
    const key = $("#esv-key").value.trim();
    if (!key) return showMsg(t("keyFirst"), true);
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = t("testing");
    const previous = s.esvKey;
    s.esvKey = key;
    try {
      await lookupVerse("John 11:35", "ESV");
      save();
      renderSettings();
      toast(t("keySaved"));
    } catch (err) {
      s.esvKey = previous;
      showMsg(err.message === "NO_KEY" ? t("keyFirst") : err.message, true);
      btn.disabled = false;
      btn.textContent = t("testSave");
    }
  });

  const remove = $("#remove-key");
  if (remove) remove.addEventListener("click", () => {
    s.esvKey = "";
    save();
    renderSettings();
    toast(t("keyRemoved"));
  });
}

/* ---------- Practice ---------- */

function startReview() {
  const queue = dueItems();
  if (!queue.length) return renderDone(0);
  startPractice(queue[0], true, { reviewed: 0, total: queue.length });
}

function startPractice(item, review, progress) {
  stopVoice(); // a review moves on without a route change, so end the last item's speech and mic here
  renderSidebar(item.id);
  session = {
    item,
    review,
    progress: progress || null,
    mode: review
      ? (voiceOn() ? (canListen() ? "say" : "repeat") : "recall")
      : (session && session.item === item ? session.mode : voiceOn() ? "repeat" : "fade"),
    spokenFor: null,       // "itemId:mode" whose instructions were last read aloud (Voice help)
    heard: "",             // say: transcript so far
    said: null,            // say: { matched, score }
    listening: null,       // say: active recognizer
    repeat: null,          // repeat: { phrases, index, playing, done, hide }
    fadeLevel: 0,
    revealed: new Set(),
    shown: false,          // recall: has the text been revealed
    typed: "",
    checked: null,         // type: { matched, score }
    scramble: null,
    suggested: null,       // rating suggested by type/scramble results
  };
  renderPractice();
}

function renderPractice() {
  const { item, review, progress } = session;
  app.innerHTML = `
    <div class="practice-head">
      <div class="row">
        <a class="btn btn-sm btn-ghost" href="#/">${t("back")}</a>
        <span class="spacer"></span>
        ${progress ? `<span class="muted">${t("progress", progress.reviewed + 1, progress.total)}</span>` : ""}
        ${!review ? `<a class="btn btn-sm btn-ghost" href="#/edit/${item.id}">${t("edit")}</a>` : ""}
        <button class="btn btn-sm btn-ghost" id="speak" title="${t("listenTitle")}">${t("listen")}</button>
      </div>
      <p class="practice-ref">${refLabel(item)}</p>
    </div>

    <div class="tabs" role="tablist">
      ${(voiceOn() ? [...VOICE_MODES, ...MODES.filter((m) => !VOICE_MODES.includes(m))] : MODES)
        .map((m) => `<button class="tab" role="tab" data-mode="${m}" aria-selected="${m === session.mode}">${t("modes")[m]}</button>`).join("")}
    </div>

    <div class="stage" id="stage"></div>

    <div class="rate">
      <p>${t("rateQuestion")}</p>
      <div class="rate-grid">
        ${t("ratings").map((r, i) => `
          <button class="rate-btn" data-r="${i}">${r}<small>${formatInterval(nextSrs(item.srs, i))}</small></button>`).join("")}
      </div>
    </div>
    ${item.translation === "ESV" ? `<p class="notice">${ESV_NOTICE}</p>` : ""}
  `;

  $$(".tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  $$(".rate-btn").forEach((b) => b.addEventListener("click", () => rate(Number(b.dataset.r))));
  $("#speak").addEventListener("click", speak);
  renderStage();
}

function setMode(mode) {
  stopVoice();
  session.mode = mode;
  session.suggested = null;
  $$(".tab").forEach((x) => x.setAttribute("aria-selected", x.dataset.mode === mode));
  renderStage();
}

function renderStage() {
  const stage = $("#stage");
  const renderers = { recall: stageRecall, fade: stageFade, letters: stageLetters, type: stageType, scramble: stageScramble, say: stageSay, repeat: stageRepeat };
  renderers[session.mode](stage);
  $$(".rate-btn").forEach((b) => b.classList.toggle("suggested", Number(b.dataset.r) === session.suggested));

  // Voice help: read the instructions once per mode (and the reference the first time).
  const key = `${session.item.id}:${session.mode}`;
  if (voiceOn() && session.spokenFor !== key) {
    const first = session.spokenFor === null;
    session.spokenFor = key;
    const help = $(".mode-help, .recall-cover p", stage);
    if (first) say(session.item.ref, { lang: voiceLang(session.item.translation) });
    say(help ? help.textContent : "", { queue: first });
  }
}

// Render the verse, deciding per word whether it's shown, hidden, or partially hidden.
// `wordState(index)` returns "show" | "hide" | "first".
function verseHtml(wordState, extraClass) {
  let wi = -1;
  return versesOf(session.item).map((v) => lineHtml(v, tokenize(v.text).map((tok) => {
    if (tok.space) return tok.space;
    if (!tok.core) return esc(tok.pre + tok.post); // a lone dash isn't a word to practice
    wi++;
    const revealed = session.revealed.has(wi);
    const st = revealed ? "show" : wordState(wi);
    const cls = extraClass ? extraClass(wi) : "";
    if (st === "show") {
      return `<span class="w ${revealed ? "peek" : ""} ${cls}" data-i="${wi}">${esc(tok.pre + tok.core + tok.post)}</span>`;
    }
    const head = st === "first" ? esc(tok.core[0]) : "";
    const hiddenLen = st === "first" ? tok.core.length - 1 : tok.core.length;
    const blank = hiddenLen > 0 ? `<span class="blank" style="width:${Math.max(0.6, hiddenLen * 0.55)}em"></span>` : "";
    return `<span class="w" data-i="${wi}" data-hidden>${esc(tok.pre)}${head}${blank}${esc(tok.post)}</span>`;
  }).join(""))).join("");
}

function bindPeek(stage) {
  $$("[data-i]", stage).forEach((el) => el.addEventListener("click", () => {
    const i = Number(el.dataset.i);
    if (el.hasAttribute("data-hidden")) session.revealed.add(i);
    else session.revealed.delete(i);
    renderStage();
  }));
}

function stageRecall(stage) {
  if (!session.shown) {
    stage.innerHTML = `
      <div class="recall-cover">
        <p class="muted" style="margin:0">${t("recallPrompt")}</p>
        <button class="btn btn-primary" id="show">${t("showText")} <span class="muted" style="color:inherit;opacity:.7">${t("spaceKey")}</span></button>
      </div>`;
    $("#show", stage).addEventListener("click", () => { session.shown = true; renderStage(); });
    return;
  }
  stage.innerHTML = `<p class="verse">${versesOf(session.item).map((v) => lineHtml(v, esc(v.text))).join("")}</p>
    <p class="mode-help" style="margin-top:14px">${t("recallCheck")}</p>`;
}

function stageFade(stage) {
  const count = tokenize(plainText(session.item)).filter((tok) => tok.core).length;
  const order = seededShuffle([...Array(count).keys()], hashString(session.item.id));
  const hidden = new Set(order.slice(0, Math.round((session.fadeLevel / 10) * count)));

  stage.innerHTML = `
    <p class="mode-help">${t("fadeHelp")}</p>
    <p class="verse">${verseHtml((i) => (hidden.has(i) ? "hide" : "show"))}</p>
    <div class="row stage-tools">
      <button class="btn btn-sm" id="less" aria-label="${t("showMore")}">−</button>
      <input type="range" min="0" max="10" value="${session.fadeLevel}" id="level" aria-label="${t("wordsHidden")}" />
      <button class="btn btn-sm" id="more" aria-label="${t("hideMore")}">+</button>
      <span class="muted" style="min-width:3.5em;text-align:right">${session.fadeLevel * 10}%</span>
    </div>`;

  const set = (v) => { session.fadeLevel = Math.max(0, Math.min(10, v)); session.revealed.clear(); renderStage(); };
  $("#level", stage).addEventListener("input", (e) => set(Number(e.target.value)));
  $("#less", stage).addEventListener("click", () => set(session.fadeLevel - 1));
  $("#more", stage).addEventListener("click", () => set(session.fadeLevel + 1));
  bindPeek(stage);
}

function stageLetters(stage) {
  stage.innerHTML = `
    <p class="mode-help">${t("lettersHelp")}</p>
    <p class="verse">${verseHtml(() => "first")}</p>`;
  bindPeek(stage);
}

function stageType(stage) {
  const target = wordsOf(plainText(session.item));
  const c = session.checked;

  stage.innerHTML = `
    <p class="mode-help">${t("typeHelp")}</p>
    <textarea id="typed" placeholder="${t("typePlaceholder")}" spellcheck="false" autocapitalize="off">${esc(session.typed)}</textarea>
    <div class="row stage-tools">
      <button class="btn btn-primary" id="check">${t("check")}</button>
      ${c ? `<button class="btn btn-ghost" id="retry">${t("tryAgain")}</button>` : ""}
    </div>
    ${c ? `
      <p class="score">${t("score", c.score, c.matched.size, target.length)}</p>
      <p class="verse">${verseHtml(() => "show", (i) => (c.matched.has(i) ? "ok" : "miss"))}</p>` : ""}`;

  const ta = $("#typed", stage);
  ta.addEventListener("input", () => (session.typed = ta.value));
  if (!c) ta.focus();
  $("#check", stage).addEventListener("click", () => {
    session.checked = checkWords(session.typed);
    renderStage();
  });
  const retry = $("#retry", stage);
  if (retry) retry.addEventListener("click", () => {
    session.typed = "";
    session.checked = null;
    session.suggested = null;
    renderStage();
  });
}

function stageScramble(stage) {
  if (!session.scramble) {
    const words = plainText(session.item).split(/\s+/).filter(Boolean);
    const size = words.length <= 12 ? 2 : words.length <= 30 ? 3 : 4;
    const chunks = [];
    for (let i = 0; i < words.length; i += size) chunks.push(words.slice(i, i + size).join(" "));
    session.scramble = { chunks, pool: shuffle(chunks.map((_, i) => i)), placed: [], mistakes: 0 };
  }
  const s = session.scramble;
  const done = s.placed.length === s.chunks.length;

  stage.innerHTML = `
    <p class="mode-help">${t("scrambleHelp")}</p>
    <div class="placed"><p class="verse">${s.placed.map((i) => esc(s.chunks[i])).join(" ") || `<span class="muted">…</span>`}</p></div>
    ${done
      ? `<p class="score">${t("scrambleDone", s.mistakes)}</p>
         <button class="btn" id="again">${t("shuffleAgain")}</button>`
      : `<div class="pool">${s.pool.map((i) => `<button class="chunk" data-c="${i}">${esc(s.chunks[i])}</button>`).join("")}</div>`}`;

  $$(".chunk", stage).forEach((btn) => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.c);
    // Compare by text so repeated phrases are interchangeable.
    if (s.chunks[i] === s.chunks[s.placed.length]) {
      s.placed.push(i);
      s.pool = s.pool.filter((p) => p !== i);
      if (s.placed.length === s.chunks.length) {
        session.suggested = s.mistakes === 0 ? 2 : s.mistakes <= 2 ? 1 : 0;
      }
      renderStage();
    } else {
      s.mistakes++;
      btn.classList.remove("wrong");
      void btn.offsetWidth; // restart animation
      btn.classList.add("wrong");
    }
  }));
  const again = $("#again", stage);
  if (again) again.addEventListener("click", () => { session.scramble = null; session.suggested = null; renderStage(); });
}

// Scores spoken or typed text against the passage and suggests a rating.
function checkWords(text) {
  const target = wordsOf(plainText(session.item));
  const matched = lcsMatches(target, wordsOf(text));
  const score = Math.round((matched.size / target.length) * 100);
  session.suggested = score === 100 ? 3 : score >= 90 ? 2 : score >= 70 ? 1 : 0;
  return { matched, score };
}

function stageSay(stage) {
  if (!canListen()) {
    stage.innerHTML = `<p class="mode-help">${t("noListen")}</p>`;
    return;
  }
  const s = session;
  const lang = voiceLang(s.item.translation);
  const target = wordsOf(plainText(s.item));
  const c = s.said;

  stage.innerHTML = `
    <p class="mode-help">${t("sayHelp")}</p>
    <div class="say-bar">
      <button class="btn btn-primary mic-btn ${s.listening ? "on" : ""}" id="mic">${s.listening ? t("sayStop") : c ? t("sayAgain") : t("sayStart")}</button>
    </div>
    ${s.listening || s.heard ? `<p class="heard" id="heard" aria-live="polite">${esc(s.heard) || t("listening")}</p>` : ""}
    ${c ? `
      <p class="score">${t("score", c.score, c.matched.size, target.length)}</p>
      <p class="verse">${verseHtml(() => "show", (i) => (c.matched.has(i) ? "ok" : "miss"))}</p>` : ""}`;

  const finish = (failed) => {
    if (session !== s || s.mode !== "say") return;
    s.listening = null;
    if (!s.heard) { if (!failed) toast(t("didntHear")); }
    else {
      s.said = checkWords(matchNumbers(s.heard, target, lang));
      if (voiceOn()) say(t("gotWords", s.said.matched.size, target.length));
    }
    renderStage();
  };

  $("#mic", stage).addEventListener("click", () => {
    if (voice.rec) return voice.rec.stop();
    hush(true);
    s.heard = "";
    s.said = null;
    s.suggested = null;
    const rec = listen({
      continuous: true,
      lang,
      onText: (text) => {
        s.heard = text;
        const el = $("#heard");
        if (el && session === s) el.textContent = text;
      },
      onEnd: finish,
    });
    if (!rec) return toast(t("micFail"));
    s.listening = rec;
    renderStage();
  });
}

// Breaks the passage into short phrases to hear and repeat: at punctuation, and never much over 7 words.
function phrasesOf(item) {
  const phrases = [];
  versesOf(item).forEach((v, line) => {
    const pieces = v.text.match(/[^,;:.!?¡¿]+(?:[,;:.!?]+["'”’)»]*)?/g) || [v.text];
    pieces.map((p) => p.trim()).filter((p) => /[\p{L}\p{N}]/u.test(p)).forEach((p) => {
      const words = p.split(/\s+/);
      const parts = Math.ceil(words.length / 7), size = Math.ceil(words.length / parts);
      for (let i = 0; i < words.length; i += size) phrases.push({ text: words.slice(i, i + size).join(" "), line });
    });
  });
  return phrases;
}

const wait = (ms) => new Promise((resolve) => { voice.timer = setTimeout(resolve, ms); });

function playRepeat() {
  const r = session.repeat;
  const lang = voiceLang(session.item.translation);
  stopVoice();
  const run = voice.run;
  r.playing = true;
  r.done = false;
  renderStage();
  (async () => {
    while (r.index < r.phrases.length) {
      const text = r.phrases[r.index].text;
      renderStage();
      await say(text, { lang });
      if (voice.run !== run) return;
      await wait(1000 + 450 * text.split(/\s+/).length); // time to say it back
      if (voice.run !== run) return;
      r.index++;
    }
    r.playing = false;
    r.done = true;
    r.index = 0;
    renderStage();
    say(t("sayWhole"));
  })();
}

function stageRepeat(stage) {
  const s = session;
  if (!s.repeat) s.repeat = { phrases: phrasesOf(s.item), index: 0, playing: false, done: false, hide: false };
  const r = s.repeat;

  const lines = versesOf(s.item).map((v, line) => lineHtml(v, r.phrases
    .map((p, i) => (p.line === line ? `<span class="phrase ${i === r.index && !r.done ? "now" : ""}" data-p="${i}">${esc(p.text)}</span>` : ""))
    .join(" ")));

  stage.innerHTML = `
    <p class="mode-help">${t("repeatHelp")}</p>
    <p class="verse ${r.hide ? "hidden-words" : ""}">${lines.join("")}</p>
    ${r.done ? `<p class="score">${t("sayWhole")}</p>` : ""}
    <div class="row stage-tools repeat-tools">
      <button class="btn" id="prev" aria-label="${t("prevPhrase")}">⏮</button>
      <button class="btn btn-primary" id="play">${r.playing ? t("pause") : r.done ? t("playAgain") : t("play")}</button>
      <button class="btn" id="next" aria-label="${t("nextPhrase")}">⏭</button>
      <button class="btn btn-ghost" id="hide" aria-pressed="${r.hide}">${r.hide ? t("showWords") : t("hideWords")}</button>
      ${r.done && canListen() ? `<button class="btn" id="trysay">${t("trySay")}</button>` : ""}
    </div>`;

  const jump = (i) => {
    r.index = Math.max(0, Math.min(r.phrases.length - 1, i));
    r.done = false;
    if (r.playing) playRepeat(); else renderStage();
  };
  $("#play", stage).addEventListener("click", () => {
    if (r.playing) { stopVoice(); renderStage(); return; }
    playRepeat();
  });
  $("#prev", stage).addEventListener("click", () => jump(r.index - 1));
  $("#next", stage).addEventListener("click", () => jump(r.index + 1));
  $("#hide", stage).addEventListener("click", () => { r.hide = !r.hide; renderStage(); });
  $$("[data-p]", stage).forEach((el) => el.addEventListener("click", () => { r.index = Number(el.dataset.p); playRepeat(); }));
  const trySay = $("#trysay", stage);
  if (trySay) trySay.addEventListener("click", () => setMode("say"));
}

function rate(r) {
  const { item, review, progress } = session;
  recordReview(item, r);
  toast(t("rated", t("ratings")[r], formatInterval(item.srs)));
  if (!review) {
    location.hash = "#/";
    return;
  }
  const reviewed = progress.reviewed + 1;
  // Items rated "Again" stay due today and come back at the end of the queue.
  const remaining = dueItems();
  if (!remaining.length || reviewed >= progress.total + 20) return renderDone(reviewed);
  startPractice(remaining[0], true, { reviewed, total: reviewed + remaining.length });
}

function renderDone(count) {
  session = null;
  renderSidebar(null);
  app.innerHTML = `
    <div class="done">
      <div class="big">✓</div>
      <h1>${count ? t("reviewComplete") : t("nothingDue")}</h1>
      <p class="muted">${count ? t("reviewedSummary", count, currentStreak()) : t("allCaughtUp")}</p>
      <div class="row" style="justify-content:center;margin-top:20px">
        <a class="btn btn-primary" href="#/">${t("backToVerses")}</a>
      </div>
    </div>`;
}

/* ---------- Voice ---------- */

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const canListen = () => Boolean(Recognition);
const voiceOn = () => Boolean(state.settings.voiceHelp);
const applyVoiceClass = () => document.body.classList.toggle("voice-help", voiceOn());
// Verses in the English translations are read and heard in English; everything else in Spanish.
const voiceLang = (translation) => (ENGLISH.includes(translation) ? "en-US" : "es-ES");

// Cuts off speech, except a toast still being read (unless `force`), which would be lost when the screen changes.
function hush(force = false) {
  if ("speechSynthesis" in window && (force || Date.now() > voice.toastUntil)) speechSynthesis.cancel();
}

// Speaks `text` (Spanish unless `lang` says otherwise); resolves when it ends or is cut off.
// `queue` adds to what is already being said.
function say(text, { queue = false, lang = "es-ES" } = {}) {
  if (!("speechSynthesis" in window) || !text) return Promise.resolve();
  if (!queue) hush();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    u.onend = u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

// Starts the microphone. onText(fullTranscript) fires as words arrive; onEnd(failed) when it stops.
function listen({ continuous = false, lang = "es-ES", onText, onEnd }) {
  if (!Recognition) return null;
  if (voice.rec) voice.rec.abort();
  const rec = new Recognition();
  rec.lang = lang;
  rec.continuous = continuous;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
    onText(squash(text));
  };
  let failed = false; // an error was already shown, so onEnd shouldn't also say "no te oí"
  const problems = {
    "not-allowed": "micAllow",
    "service-not-allowed": "micAllow",
    "audio-capture": "micNone",
    network: "micNetwork",
  };
  rec.onerror = (e) => {
    if (!problems[e.error]) return;
    failed = true;
    toast(t(problems[e.error]));
  };
  rec.onend = () => {
    if (voice.rec === rec) voice.rec = null;
    onEnd(failed);
  };
  try { rec.start(); } catch (e) { return null; }
  voice.rec = rec;
  return rec;
}

// Silences everything: speech, the microphone and any Escucha y repite in progress.
function stopVoice() {
  voice.run++;
  clearTimeout(voice.timer);
  hush();
  const rec = voice.rec;
  voice.rec = null;
  if (rec) { try { rec.abort(); } catch (e) { /* already stopped */ } }
  if (session) {
    session.listening = null;
    if (session.repeat) session.repeat.playing = false;
  }
}

function speak() {
  if (!("speechSynthesis" in window)) return toast(t("noSpeech"));
  stopVoice();
  if (session.mode === "repeat") renderStage();
  say(`${session.item.ref}. ${squash(plainText(session.item))}`, { lang: voiceLang(session.item.translation) });
}

// Number words, so that what is said ("veintitrés") and what recognizers write ("23") can be matched.
const EN_UNITS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const EN_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const ES_UNITS = "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintitrés veinticuatro veinticinco veintiséis veintisiete veintiocho veintinueve".split(" ");
const ES_TENS = "_ _ _ treinta cuarenta cincuenta sesenta setenta ochenta noventa".split(" ");
const ES_HUNDREDS = "_ ciento doscientos trescientos cuatrocientos quinientos seiscientos setecientos ochocientos novecientos".split(" ");
const ES_VALUE = { un: 1, una: 1, veintiun: 21, veintiuna: 21, cien: 100 }; // by accent-free spelling
ES_UNITS.forEach((w, i) => { ES_VALUE[fold(w)] = i; });
ES_TENS.forEach((w, i) => { if (i >= 3) ES_VALUE[fold(w)] = i * 10; });
ES_HUNDREDS.forEach((w, i) => { if (i >= 1) ES_VALUE[fold(w)] = i * 100; });

function numToWords(n, lang) {
  if (lang === "es-ES") {
    if (n < 30) return ES_UNITS[n];
    if (n < 100) return ES_TENS[Math.floor(n / 10)] + (n % 10 ? ` y ${ES_UNITS[n % 10]}` : "");
    if (n === 100) return "cien";
    return ES_HUNDREDS[Math.floor(n / 100)] + (n % 100 ? ` ${numToWords(n % 100, lang)}` : "");
  }
  if (n < 20) return EN_UNITS[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? ` ${EN_UNITS[n % 10]}` : "");
  return `${EN_UNITS[Math.floor(n / 100)]} hundred` + (n % 100 ? ` ${numToWords(n % 100, lang)}` : "");
}

// "twenty three" -> "23", "ciento diecinueve" -> "119". Other words pass through.
function numberWordsToDigits(text, lang) {
  const es = lang === "es-ES";
  const toks = text.split(es ? /\s+/ : /[\s-]+/).filter(Boolean);
  const out = [];
  let cur = null, sawY = false;
  const flush = () => { if (cur !== null) out.push(String(cur)); cur = null; sawY = false; };
  const valueOf = (raw) => {
    const w = fold(raw);
    if (es) return ES_VALUE[w] ?? -1;
    const u = EN_UNITS.indexOf(raw.toLowerCase()), tens = EN_TENS.indexOf(raw.toLowerCase());
    return u >= 0 ? u : tens >= 2 ? tens * 10 : -1;
  };
  toks.forEach((raw, i) => {
    const value = valueOf(raw);
    if (!es && raw.toLowerCase() === "hundred" && cur !== null) { cur *= 100; return; }
    // "treinta y uno": the "y" joins tens and units
    if (es && fold(raw) === "y" && cur !== null && cur % 100 >= 30 && cur % 10 === 0 && valueOf(toks[i + 1] || "") > 0 && valueOf(toks[i + 1]) < 10) { sawY = true; return; }
    if (value < 0) { flush(); out.push(raw); return; }
    const joins = cur !== null && ((cur >= 100 && cur % 100 === 0 && value < 100)
      || (cur % 100 >= (es ? 30 : 20) && cur % 10 === 0 && value > 0 && value < 10 && (!es || sawY)));
    if (joins) { cur += value; sawY = false; } else { flush(); cur = value; }
  });
  flush();
  return out.join(" ");
}

// Makes spoken numbers match how the passage writes them. Speech-to-text gives digits ("40") while
// most verses spell numbers out ("cuarenta"); a passage that uses digits gets digits instead.
function matchNumbers(heard, targetWords, lang) {
  const digits = new Set(targetWords.filter((w) => /^\d{1,3}$/.test(w)));
  let out = heard.replace(/\b\d{1,3}\b/g, (d) => (digits.has(d) ? d : numToWords(Number(d), lang)));
  digits.forEach((d) => { out = out.replace(new RegExp(`(^|\\s)${numToWords(Number(d), lang)}(?=\\s|$)`, "gi"), `$1${d}`); });
  return out;
}

// Turns what was said into a reference the lookup understands:
// "primera de Juan tres dieciséis" -> "1 Juan 3:16", "John three sixteen" -> "John 3:16".
function spokenRef(said, lang) {
  const es = lang === "es-ES";
  let s = said.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  if (es) {
    s = s.replace(/^(primera|primero|primer)( de)? /, "1 ").replace(/^(segunda|segundo)( de)? /, "2 ").replace(/^(tercera|tercero|tercer)( de)? /, "3 ")
      .replace(/ dos puntos /g, ":");
  } else {
    s = s.replace(/^(first|1st) /, "1 ").replace(/^(second|2nd) /, "2 ").replace(/^(third|3rd) /, "3 ").replace(/ colon /g, ":");
  }
  s = numberWordsToDigits(s, lang)
    .replace(es ? /\bcap[ií]tulo /g : /\bchapter /g, "")
    .replace(es ? /\bvers[ií]culos? /g : /\bverses? /g, "")
    .replace(es ? /(\d) (?:al|a|hasta) (?=\d)/g : /(\d) (?:through|thru|to|until) (?=\d)/g, "$1-")
    .replace(/ ?: ?/g, ":");
  if (/\d:\d/.test(s)) return s;
  const m = s.match(/^((?:[1-3] )?[\p{L} ]+?) (\d{1,3})(?: (\d{1,3}(?:-\d{1,3})?))?( .*)?$/u);
  return m ? `${m[1]} ${m[2]}${m[3] ? `:${m[3]}` : ""}${m[4] || ""}` : s;
}

/* ---------- Keyboard ---------- */

function onKey(e) {
  if (!session || e.metaKey || e.ctrlKey || e.altKey) return;
  if (["TEXTAREA", "INPUT"].includes(document.activeElement.tagName)) return;
  if (e.key >= "1" && e.key <= "4") { rate(Number(e.key) - 1); return; }
  if (e.key === " " && (session.mode === "say" || session.mode === "repeat") && document.activeElement.tagName !== "BUTTON") {
    const btn = $(session.mode === "say" ? "#mic" : "#play");
    if (btn) { e.preventDefault(); btn.click(); return; }
  }
  if (e.key === " " && session.mode === "recall" && !session.shown) {
    e.preventDefault();
    session.shown = true;
    renderStage();
  }
  if (session.mode === "fade" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    session.fadeLevel = Math.max(0, Math.min(10, session.fadeLevel + (e.key === "ArrowRight" ? 1 : -1)));
    session.revealed.clear();
    renderStage();
  }
}

applyVoiceClass();
render();
