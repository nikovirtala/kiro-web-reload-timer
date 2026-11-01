// Shared by content.js and popup.js.
//
// Safari and Firefox expose the extension API as `browser`, Chrome as `chrome`,
// and Safari also provides `chrome`. On app.kiro.dev in Safari, `browser`
// turned out to be an object without `storage`, so pick whichever object
// actually has the storage API instead of trusting the name.
const api = [globalThis.browser, globalThis.chrome].find((c) => c?.storage?.local) ?? null;

const apiName =
  api === null ? "none" : api === globalThis.browser ? "browser" : "chrome";

// storage.local.get/set that work whether the API returns promises
// (Safari, Firefox, Chrome MV3) or only supports callbacks.
function storageCall(method, arg) {
  return new Promise((resolve, reject) => {
    if (!api) {
      reject(new Error("extension storage API not available"));
      return;
    }
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      const err = globalThis.chrome?.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(value);
    };
    try {
      const result = api.storage.local[method](arg, done);
      if (result && typeof result.then === "function") result.then(done, reject);
    } catch (err) {
      reject(err);
    }
  });
}

const storageGet = (key) => storageCall("get", key).then((v) => v ?? {});
const storageSet = (items) => storageCall("set", items);
