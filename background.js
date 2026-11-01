// Saves totals for content scripts that can't reach extension storage
// themselves (seen in Safari). Updates are queued so messages from several
// tabs can't overwrite each other.
importScripts("api.js");

let queue = Promise.resolve();

function handle(msg) {
  const run = queue.then(() => addToDay(msg.key, msg.ms, msg.episodes));
  queue = run.catch(() => {});
  return run.then(
    (day) => ({ ok: true, day }),
    (err) => {
      console.warn("[Kiro Web Reload Timer] storage write failed:", err);
      return { ok: false, error: String(err) };
    },
  );
}

const onMessage = (extBrowser ?? extChrome)?.runtime?.onMessage;

onMessage?.addListener((msg, _sender, sendResponse) => {
  const valid =
    msg?.type === "add" &&
    typeof msg.key === "string" &&
    Number.isFinite(msg.ms) &&
    Number.isFinite(msg.episodes);
  if (!valid) return false;
  handle(msg).then(sendResponse);
  return true; // answer asynchronously through sendResponse
});
