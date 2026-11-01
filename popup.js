// Safari and Firefox expose the promise-based `browser` API; Chrome uses `chrome`.
const api = globalThis.browser ?? chrome;

function dayKey(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmt(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

async function render() {
  const { days = {} } = await api.storage.local.get("days");
  const today = days[dayKey(Date.now())] || { ms: 0, episodes: 0 };
  document.getElementById("today").textContent = fmt(today.ms);
  document.getElementById("todayEpisodes").textContent =
    `${today.episodes} time${today.episodes === 1 ? "" : "s"}`;

  const table = document.getElementById("history");
  table.replaceChildren();
  for (let i = 1; i <= 14; i++) {
    const key = dayKey(Date.now() - i * 86400000);
    const day = days[key];
    if (!day) continue;
    const row = table.insertRow();
    row.insertCell().textContent = key;
    row.insertCell().textContent = fmt(day.ms);
    row.insertCell().textContent = `${day.episodes}×`;
  }
}

document.getElementById("reset").addEventListener("click", async () => {
  if (!confirm("Delete all recorded times?")) return;
  await api.runtime.sendMessage({ type: "reset" });
  render();
});

api.storage.onChanged.addListener(render);
render();
