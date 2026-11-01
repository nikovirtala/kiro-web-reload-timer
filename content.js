// Runs on app.kiro.dev, after api.js. Once a second, checks whether the
// target text is visible on screen in the active tab, and saves the daily
// totals.
//
// Where totals go:
// - Extension storage, when this script can reach it (Chrome).
// - Otherwise app.kiro.dev's own localStorage (Safari, where content scripts on
//   this site get no extension API). The popup moves those totals into
//   extension storage whenever it's opened.

const TARGET_TEXT = "Reloading sandbox";
const TICK_MS = 1000;
const FLUSH_MS = 5000;
const MAX_DELTA_MS = 2 * TICK_MS; // ignore gaps from sleep or a throttled tab

let lastTick = Date.now();
let wasShowing = false;
let pendingMs = 0;
let pendingEpisodes = 0;

function isOnScreen(el) {
  if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) {
    return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}

// Returns { present, showing }:
//   present: the text is somewhere in the page (even if hidden or scrolled away)
//   showing: it is on screen in the visible tab right now
function checkTarget() {
  if (!document.body) return { present: false, showing: false };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeValue.includes(TARGET_TEXT) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  });
  const tabVisible = document.visibilityState === "visible";
  let present = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el) continue;
    present = true;
    if (tabVisible && isOnScreen(el)) return { present, showing: true };
  }
  return { present, showing: false };
}

// One "time shown" = one appearance of the message that you actually saw.
// Switching tabs or scrolling away and back during the same appearance
// doesn't count again; the count resets only when the message goes away.
let episodeCounted = false;
let wasPresent = false;

// Diagnostics: shows up in the page's Web Inspector console.
const LOG_PREFIX = "[Kiro Web Reload Timer]";
function log(message) {
  console.info(`${LOG_PREFIX} ${message}`);
}
log(`content script loaded on ${location.href}`);
log(`saving to ${api ? "extension storage" : "page storage (popup collects it)"}`);

function tick() {
  const now = Date.now();
  const delta = now - lastTick;
  lastTick = now;

  const { present, showing } = checkTarget();
  if (present !== wasPresent || showing !== wasShowing) {
    log(`message in page: ${present}, on screen: ${showing}, tab: ${document.visibilityState}`);
  }
  wasPresent = present;
  if (!present) episodeCounted = false;
  if (showing) {
    if (!episodeCounted) {
      pendingEpisodes += 1;
      episodeCounted = true;
    }
    if (wasShowing && delta <= MAX_DELTA_MS) pendingMs += delta;
  }
  wasShowing = showing;
}

// Saves run one at a time per tab so they can't overwrite each other.
let saving = Promise.resolve();

function saveToPage(key, ms, episodes) {
  const all = JSON.parse(localStorage.getItem(PAGE_STORAGE_KEY) || "{}");
  const day = all[key] || { ms: 0, episodes: 0 };
  day.ms += ms;
  day.episodes += episodes;
  all[key] = day;
  localStorage.setItem(PAGE_STORAGE_KEY, JSON.stringify(all));
  return day;
}

function save(key, ms, episodes) {
  if (api) return addToDay(key, ms, episodes).then((day) => ({ via: "extension storage", day }));
  return Promise.resolve().then(() => ({ via: "page storage", day: saveToPage(key, ms, episodes) }));
}

function flush() {
  if (pendingMs === 0 && pendingEpisodes === 0) return;
  const ms = pendingMs;
  const episodes = pendingEpisodes;
  const key = dayKey(Date.now());
  pendingMs = 0;
  pendingEpisodes = 0;
  saving = saving
    .then(() => save(key, ms, episodes))
    .then(({ via, day }) => {
      const label = via === "page storage" ? "not yet collected by popup" : "total";
      log(`saved ${ms} ms, ${episodes} new appearance(s) to ${via}; ${key} ${label}: ${day.ms} ms, ${day.episodes}`);
    })
    .catch((err) => {
      // Keep the numbers so the next flush retries them.
      pendingMs += ms;
      pendingEpisodes += episodes;
      console.warn(`${LOG_PREFIX} saving failed, will retry:`, err);
    });
}

setInterval(tick, TICK_MS);
setInterval(flush, FLUSH_MS);
document.addEventListener("visibilitychange", () => {
  tick();
  if (document.visibilityState === "hidden") flush();
});
window.addEventListener("pagehide", flush);
