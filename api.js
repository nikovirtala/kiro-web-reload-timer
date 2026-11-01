// Shared by content.js and popup.js.
//
// Chrome exposes the extension API as `chrome`; Safari and Firefox as
// `browser`. In Safari, content scripts on app.kiro.dev get neither: the only
// `browser` there is the page's <symbol id="browser"> icon (elements with an id
// become globals). So accept an object only if it really has the storage API.
// When there is none, content.js saves to the page's localStorage instead.

const api =
  [globalThis.browser, globalThis.chrome].find((c) => c?.storage?.local && c?.runtime) ?? null;

// Key used in app.kiro.dev's localStorage when extension storage isn't available.
const PAGE_STORAGE_KEY = "kiroWebReloadTimer.days";

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
        const lastError = globalThis.chrome?.runtime?.lastError;
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

function dayKey(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Adds totals to extension storage, kept as
//   { days: { "2026-11-01": { ms: 412000, episodes: 7 }, ... } }
// `additions` has the same shape as `days`. Returns the updated days.
async function addDays(additions) {
  const { days = {} } = await storageGet("days");
  for (const [key, add] of Object.entries(additions)) {
    const day = days[key] || { ms: 0, episodes: 0 };
    day.ms += Number(add.ms) || 0;
    day.episodes += Number(add.episodes) || 0;
    days[key] = day;
  }
  await storageSet({ days });
  return days;
}

async function addToDay(key, ms, episodes) {
  const days = await addDays({ [key]: { ms, episodes } });
  return days[key];
}
