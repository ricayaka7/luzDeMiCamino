/* Luz de mi Camino — memoriza versículos bíblicos y citas.
 * Plain JS, no build step. Data lives in localStorage. Interface text is in strings.js. */

"use strict";

// Shares an origin (ricayaka7.github.io) with light2Path, so keys must not overlap.
const STORE_KEY = "luzdemicamino.v1";
const DAY = 86400000;
const MASTERED_DAYS = 21;
const MODES = ["recall", "fade", "letters", "type", "scramble"];

const DEFAULT_SETTINGS = { translation: "RVR1909", esvKey: "" };

/* ---------- Storage ---------- */

let state = load();
let session = null;     // active practice session; null when not on the practice screen
let searchQuery = "";
let installPrompt = null; // deferred beforeinstallprompt event (Android / desktop Chrome)

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

/* ---------- UI helpers ---------- */

const app = document.getElementById("app");
const $ = (sel, root = app) => root.querySelector(sel);
const $$ = (sel, root = app) => Array.from(root.querySelectorAll(sel));

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
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
  window.scrollTo(0, 0);
  if (view === "add") return renderForm(null);
  if (view === "edit") return renderForm(findItem(id));
  if (view === "practice" && findItem(id)) return startPractice(findItem(id), false);
  if (view === "review") return startReview();
  if (view === "settings") return renderSettings();
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
          <div class="card-text">${esc(i.text)}</div>
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

const translations = () => [
  { id: "RVR1909", label: t("translationRV") },
  { id: "ESV", label: t("translationESV") },
  { id: "KJV", label: t("translationKJV") },
  { id: "WEB", label: t("translationWEB") },
  { id: "", label: t("translationNone") },
];
const ENGLISH = ["ESV", "KJV", "WEB"];
// Crossway's required wording; kept in English as published.
const ESV_NOTICE = "Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

// Returns { ref, text } or throws an Error with a message fit to show the user.
async function lookupVerse(ref, translation) {
  if (translation === "RVR1909") return lookupReinaValera(ref);
  if (translation === "ESV") {
    const key = state.settings.esvKey;
    if (!key) throw new Error("NO_KEY");
    const params = new URLSearchParams({
      q: ref,
      "include-passage-references": "false",
      "include-verse-numbers": "false",
      "include-first-verse-numbers": "false",
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
    const text = (data.passages || []).join(" ").replace(/\s+/g, " ").trim();
    if (!text) throw new Error(t("errNotFoundEnglish", ref));
    return { ref: data.canonical || ref, text };
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
  return { ref: data.reference || ref, text: (data.text || "").replace(/\s+/g, " ").trim() };
}

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
  return {
    ref: `${book.name} ${chapter}${span}`,
    text: verses.map((v) => cleanRvVerse(v.text)).join(" ").replace(/\s+/g, " ").trim(),
  };
}

const refLabel = (item) =>
  esc(item.ref) + (item.translation ? ` <span class="translation">${esc(item.translation)}</span>` : "");

/* ---------- Add / edit ---------- */

function renderForm(item) {
  session = null;
  renderSidebar(item ? item.id : null);
  const current = item ? item.translation || "" : state.settings.translation;

  app.innerHTML = `
    <h1>${item ? t("editTitle") : t("addTitle")}</h1>
    <form id="form">
      <label for="ref">${t("refLabel")}</label>
      <input type="text" id="ref" required autocomplete="off" placeholder="${t("refPlaceholder")}" value="${esc(item ? item.ref : "")}" />

      <label for="translation">${t("translation")}</label>
      <div class="row lookup-row">
        <select id="translation">
          ${translations().map((o) => `<option value="${o.id}" ${o.id === current ? "selected" : ""}>${o.label}</option>`).join("")}
        </select>
        <button class="btn" type="button" id="lookup">${t("lookUp")}</button>
      </div>
      <p class="lookup-msg" id="lookup-msg" hidden></p>

      <label for="text">${t("text")}</label>
      <textarea id="text" required placeholder="${t("textPlaceholder")}">${esc(item ? item.text : "")}</textarea>

      <label for="tags">${t("tags")} <span class="hint">${t("tagsHint")}</span></label>
      <input type="text" id="tags" placeholder="${t("tagsPlaceholder")}" value="${esc(item ? item.tags.join(", ") : "")}" />

      <div class="row form-actions">
        <button class="btn btn-primary" type="submit">${item ? t("saveChanges") : t("addToVerses")}</button>
        <a class="btn btn-ghost" href="${item ? `#/practice/${item.id}` : "#/"}">${t("cancel")}</a>
        <span class="spacer"></span>
        ${item ? `<button class="btn btn-ghost btn-danger" type="button" id="delete">${t("delete")}</button>` : ""}
      </div>
    </form>
  `;

  const refInput = $("#ref"), select = $("#translation"), lookupBtn = $("#lookup"), msg = $("#lookup-msg");
  refInput.focus();

  const showMsg = (html, isError) => {
    msg.innerHTML = html;
    msg.classList.toggle("error", Boolean(isError));
    msg.hidden = !html;
  };
  const syncLookup = () => { lookupBtn.hidden = !select.value; showMsg(""); };
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
      $("#text").value = found.text;
      showMsg(esc(t("found", found.ref, select.value)));
    } catch (e) {
      showMsg(e.message === "NO_KEY"
        ? t("needKey")
        : esc(e.message), true);
    } finally {
      lookupBtn.disabled = false;
      lookupBtn.textContent = t("lookUp");
    }
  }
  lookupBtn.addEventListener("click", doLookup);
  // Enter in the reference field looks it up when there's no text yet.
  refInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && select.value && !$("#text").value.trim()) { e.preventDefault(); doLookup(); }
  });

  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const ref = refInput.value.trim();
    const text = $("#text").value.trim();
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

/* ---------- Settings ---------- */

function renderSettings() {
  session = null;
  renderSidebar(null);
  const s = state.settings;

  app.innerHTML = `
    <h1>${t("settings")}</h1>

    <label for="default-translation">${t("defaultTranslation")}</label>
    <select id="default-translation">
      ${translations().map((o) => `<option value="${o.id}" ${o.id === s.translation ? "selected" : ""}>${o.label}</option>`).join("")}
    </select>

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
  renderSidebar(item.id);
  session = {
    item,
    review,
    progress: progress || null,
    mode: review ? "recall" : (session && session.item === item ? session.mode : "fade"),
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
      ${MODES.map((m) => `<button class="tab" role="tab" data-mode="${m}" aria-selected="${m === session.mode}">${t("modes")[m]}</button>`).join("")}
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

  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    session.mode = t.dataset.mode;
    session.suggested = null;
    $$(".tab").forEach((x) => x.setAttribute("aria-selected", x === t));
    renderStage();
  }));
  $$(".rate-btn").forEach((b) => b.addEventListener("click", () => rate(Number(b.dataset.r))));
  $("#speak").addEventListener("click", speak);
  renderStage();
}

function renderStage() {
  const stage = $("#stage");
  const renderers = { recall: stageRecall, fade: stageFade, letters: stageLetters, type: stageType, scramble: stageScramble };
  renderers[session.mode](stage);
  $$(".rate-btn").forEach((b) => b.classList.toggle("suggested", Number(b.dataset.r) === session.suggested));
}

// Render the verse, deciding per word whether it's shown, hidden, or partially hidden.
// `wordState(index)` returns "show" | "hide" | "first".
function verseHtml(wordState, extraClass) {
  let wi = -1;
  return tokenize(session.item.text).map((t) => {
    if (t.space) return t.space;
    wi++;
    const revealed = session.revealed.has(wi);
    const st = revealed ? "show" : wordState(wi);
    const cls = extraClass ? extraClass(wi) : "";
    if (st === "show" || !t.core) {
      return `<span class="w ${revealed ? "peek" : ""} ${cls}" data-i="${wi}">${esc(t.pre + t.core + t.post)}</span>`;
    }
    const head = st === "first" ? esc(t.core[0]) : "";
    const hiddenLen = st === "first" ? t.core.length - 1 : t.core.length;
    const blank = hiddenLen > 0 ? `<span class="blank" style="width:${Math.max(0.6, hiddenLen * 0.55)}em"></span>` : "";
    return `<span class="w" data-i="${wi}" data-hidden>${esc(t.pre)}${head}${blank}${esc(t.post)}</span>`;
  }).join("");
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
  stage.innerHTML = `<p class="verse">${esc(session.item.text)}</p>
    <p class="mode-help" style="margin-top:14px">${t("recallCheck")}</p>`;
}

function stageFade(stage) {
  const count = tokenize(session.item.text).filter((t) => !t.space).length;
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
  const target = wordsOf(session.item.text);
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
    const matched = lcsMatches(target, wordsOf(session.typed));
    const score = Math.round((matched.size / target.length) * 100);
    session.checked = { matched, score };
    session.suggested = score === 100 ? 3 : score >= 90 ? 2 : score >= 70 ? 1 : 0;
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
    const words = session.item.text.split(/\s+/).filter(Boolean);
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

function speak() {
  if (!("speechSynthesis" in window)) return toast(t("noSpeech"));
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(`${session.item.ref}. ${session.item.text}`);
  u.lang = ENGLISH.includes(session.item.translation) ? "en-US" : "es-ES";
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

/* ---------- Keyboard ---------- */

function onKey(e) {
  if (!session || e.metaKey || e.ctrlKey || e.altKey) return;
  if (["TEXTAREA", "INPUT"].includes(document.activeElement.tagName)) return;
  if (e.key >= "1" && e.key <= "4") { rate(Number(e.key) - 1); return; }
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

render();
