// Runs after api.js, which provides api, dayKey, storageGet, storageSet and addDays.

const LOG_PREFIX = "[Kiro Web Reload Timer]";

// Runs `func` in the first open app.kiro.dev tab where it succeeds and returns
// its result. localStorage is shared by all tabs of a site, so one is enough.
// Returns undefined when no app.kiro.dev tab is open.
async function runInKiroTab(func, args) {
  if (!api?.tabs?.query || !api?.scripting?.executeScript) return undefined;
  const tabs = await callApi(api.tabs.query, api.tabs, [{ url: "https://app.kiro.dev/*" }]);
  for (const tab of tabs ?? []) {
    try {
      const results = await callApi(api.scripting.executeScript, api.scripting, [
        { target: { tabId: tab.id }, func, args },
      ]);
      return results?.[0]?.result;
    } catch (err) {
      console.warn(`${LOG_PREFIX} couldn't reach tab ${tab.url}:`, err);
    }
  }
  return undefined;
}

// Page-side helpers. They run inside app.kiro.dev, so they must be
// self-contained. Each runs in one go, so the content script can't write
// in between.
function takePageTotals(key) {
  const raw = localStorage.getItem(key);
  localStorage.removeItem(key);
  return raw;
}

function returnPageTotals(key, raw) {
  const back = JSON.parse(raw);
  const now = JSON.parse(localStorage.getItem(key) || "{}");
  for (const [day, v] of Object.entries(back)) {
    const d = now[day] || { ms: 0, episodes: 0 };
    d.ms += v.ms;
    d.episodes += v.episodes;
    now[day] = d;
  }
  localStorage.setItem(key, JSON.stringify(now));
}

function clearPageTotals(key) {
  localStorage.removeItem(key);
}

// In Safari the content script saves to app.kiro.dev's localStorage (see
// api.js). Move those totals into extension storage. If adding them here
// fails, put them back on the page so nothing is lost.
async function collectFromPages() {
  const raw = await runInKiroTab(takePageTotals, [PAGE_STORAGE_KEY]);
  if (!raw) return;
  try {
    await addDays(JSON.parse(raw));
  } catch (err) {
    await runInKiroTab(returnPageTotals, [PAGE_STORAGE_KEY, raw]);
    throw err;
  }
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
  const { days = {} } = await storageGet("days");
  const today = days[dayKey(Date.now())] || { ms: 0, episodes: 0 };
  document.getElementById("today").textContent = fmt(today.ms);
  document.getElementById("todayEpisodes").textContent =
    `${today.episodes} time${today.episodes === 1 ? "" : "s"}`;

  const table = document.getElementById("history");
  table.replaceChildren();
  for (let i = 1; i <= 14; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i); // calendar days, correct across DST changes
    const key = dayKey(date.getTime());
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
  await runInKiroTab(clearPageTotals, [PAGE_STORAGE_KEY]);
  await storageSet({ days: {} });
  render();
});

async function refresh() {
  try {
    await collectFromPages();
  } catch (err) {
    console.warn(`${LOG_PREFIX} collecting from app.kiro.dev failed:`, err);
  }
  await render();
}

api?.storage?.onChanged?.addListener(render);
refresh();
setInterval(refresh, 5000); // pick up new page totals while the popup is open
