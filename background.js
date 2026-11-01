// Safari and Firefox expose the promise-based `browser` API; Chrome uses `chrome`.
const api = globalThis.browser ?? chrome;

// Stores daily totals in api.storage.local as
//   { days: { "2026-11-01": { ms: 412000, episodes: 7 }, ... } }
// Updates are queued so messages from several tabs can't overwrite each other.

function dayKey(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let queue = Promise.resolve();

function addTime({ ms, episodes, at }) {
  queue = queue.then(async () => {
    const { days = {} } = await api.storage.local.get("days");
    const key = dayKey(at);
    const day = days[key] || { ms: 0, episodes: 0 };
    day.ms += ms;
    day.episodes += episodes;
    days[key] = day;
    await api.storage.local.set({ days });
  });
  return queue;
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "add" && Number.isFinite(msg.ms) && Number.isFinite(msg.episodes)) {
    addTime(msg).then(
      () => sendResponse({ ok: true }),
      (err) => {
        console.warn("[Kiro Web Reload Timer] storage write failed:", err);
        sendResponse({ ok: false, error: String(err) });
      },
    );
    return true; // keep the channel open for the async response
  }
  if (msg?.type === "reset") {
    queue = queue.then(() => api.storage.local.set({ days: {} }));
    queue.then(() => sendResponse({ ok: true }));
    return true;
  }
});
