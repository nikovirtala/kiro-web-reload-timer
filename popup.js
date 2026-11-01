// Runs after api.js, which provides dayKey, storageGet and storageSet.

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
  const { days = {} } = await storageGet("days");
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
  document.getElementById("historyEmpty").hidden = table.rows.length > 0;
}

// Safari popups don't support confirm(), so ask for a second click instead.
const resetButton = document.getElementById("reset");
const resetLabel = resetButton.textContent;
let resetArmed = null;

resetButton.addEventListener("click", async () => {
  if (!resetArmed) {
    resetButton.textContent = "Click again to delete all data";
    resetArmed = setTimeout(() => {
      resetArmed = null;
      resetButton.textContent = resetLabel;
    }, 3000);
    return;
  }
  clearTimeout(resetArmed);
  resetArmed = null;
  resetButton.textContent = resetLabel;
  await storageSet({ days: {} });
  render();
});

api?.storage?.onChanged?.addListener(render);
render();
