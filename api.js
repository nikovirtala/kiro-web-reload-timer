// Shared by content.js, popup.js and background.js.
//
// Safari and Firefox expose the extension API as `browser`, Chrome as `chrome`,
// and Safari also provides `chrome`. Don't trust the names: on app.kiro.dev in
// Safari, content scripts got objects without `storage`. So find an object that
// actually has storage, and if there is none (Safari has known bugs with
// storage in content scripts), ask the background script to save instead.

//
// Why that happens: app.kiro.dev adds an SVG icon sprite containing
// <symbol id="browser">, and browsers expose elements with an id as globals,
// so globalThis.browser is that element. Safari can also provide `browser` as
// a variable in scope rather than a property of globalThis. So read the plain
// names `browser` and `chrome` first, which find such a variable, and fall
// back to globalThis. If an element is in the way there, its id is removed
// for a moment to read the real object behind it.

const isElement = (o) => typeof Element !== "undefined" && o instanceof Element;
const notElement = (o) => (isElement(o) ? undefined : o);

// Where each object was found, for the diagnostics log.
const apiSource = { browser: "none", chrome: "none" };

function readExtensionGlobals() {
  /* global browser, chrome */
  const inScope = [
    typeof browser !== "undefined" ? notElement(browser) : undefined,
    typeof chrome !== "undefined" ? notElement(chrome) : undefined,
  ];
  const fromGlobal = readGlobalObject();
  return ["browser", "chrome"].map((name, i) => {
    if (inScope[i]?.runtime) {
      apiSource[name] = inScope[i] === fromGlobal[i] ? "globalThis" : "variable";
      return inScope[i];
    }
    if (fromGlobal[i]?.runtime) {
      apiSource[name] = "globalThis";
      return fromGlobal[i];
    }
    return undefined;
  });
}

function readGlobalObject() {
  const read = () => [globalThis.browser, globalThis.chrome];
  if (!read().some(isElement)) return read();

  // Every element named "browser" or "chrome", with the id it had.
  const blockers = [...(globalThis.document?.querySelectorAll("[id='browser'], [id='chrome']") ?? [])].map(
    (el) => [el, el.id],
  );
  for (const [el] of blockers) el.removeAttribute("id");
  try {
    return read().map(notElement);
  } finally {
    for (const [el, id] of blockers) el.setAttribute("id", id);
  }
}

const [extBrowser, extChrome] = readExtensionGlobals();
const candidates = () => [extBrowser, extChrome];

const api = candidates().find((c) => c?.storage?.local) ?? null;
const messenger = candidates().find((c) => typeof c?.runtime?.sendMessage === "function") ?? null;

const nameOf = (o) =>
  o === null ? "none" : o === extBrowser ? "browser" : "chrome";

// Calls an extension API method that may return a promise (Safari, Firefox,
// Chrome MV3) or only support a callback.
function callApi(fn, thisArg, args, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error(`no answer after ${timeoutMs} ms`)), timeoutMs);
    function finish(err, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    }
    try {
      const result = fn.call(thisArg, ...args, (value) => {
        const lastError = extChrome?.runtime?.lastError;
        finish(lastError ? new Error(lastError.message) : null, value);
      });
      if (result && typeof result.then === "function") {
        result.then((v) => finish(null, v), (e) => finish(e));
      }
    } catch (err) {
      finish(err);
    }
  });
}

function storageGet(key) {
  if (!api) return Promise.reject(new Error("extension storage API not available"));
  return callApi(api.storage.local.get, api.storage.local, [key]).then((v) => v ?? {});
}

function storageSet(items) {
  if (!api) return Promise.reject(new Error("extension storage API not available"));
  return callApi(api.storage.local.set, api.storage.local, [items]);
}

function sendToBackground(msg) {
  if (!messenger) return Promise.reject(new Error("extension messaging API not available"));
  return callApi(messenger.runtime.sendMessage, messenger.runtime, [msg]).then((res) => {
    if (!res?.ok) throw new Error(`background save failed: ${res?.error ?? "no response"}`);
    return res;
  });
}

function dayKey(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Adds time and appearances to one day's totals in
//   { days: { "2026-11-01": { ms: 412000, episodes: 7 }, ... } }
// and returns that day's new totals.
async function addToDay(key, ms, episodes) {
  const { days = {} } = await storageGet("days");
  const day = days[key] || { ms: 0, episodes: 0 };
  day.ms += ms;
  day.episodes += episodes;
  days[key] = day;
  await storageSet({ days });
  return day;
}
