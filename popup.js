// Runs after api.js, which provides api, dayKey, storageGet, storageSet and addDays.

// In Safari the content script saves to app.kiro.dev's localStorage (see
// api.js). Move those totals into extension storage: read them from an open
// app.kiro.dev tab, add them here, then remove them from the page, but only if
// they haven't changed in between, so nothing is counted twice or lost.
async function collectFromPages() {
  if (!api?.tabs?.query || !api?.scripting?.executeScript) return;
  const tabs = await callApi(api.tabs.query, api.tabs, [{ url: "https://app.kiro.dev/*" }]);
  const run = (tabId, func, args = []) =>
    callApi(api.scripting.executeScript, api.scripting, [{ target: { tabId }, func, args }]).then(
      (results) => results?.[0]?.result,
    );

  // localStorage is shared by all app.kiro.dev tabs, so one tab is enough.
  for (const tab of tabs ?? []) {
    try {
      const raw = await run(tab.id, (key) => localStorage.getItem(key), [PAGE_STORAGE_KEY]);
      if (!raw) return;
      await addDays(JSON.parse(raw));
      await run(
        tab.id,
        (key, seen) => {
          if (localStorage.getItem(key) === seen) localStorage.removeItem(key);
          else {
            // New time was added after we read: subtract what we collected.
            const now = JSON.parse(localStorage.getItem(key) || "{}");
            const old = JSON.parse(seen);
            for (const [day, v] of Object.entries(old)) {
              if (!now[day]) continue;
              now[day].ms -= v.ms;
              now[day].episodes -= v.episodes;
              if (now[day].ms <= 0 && now[day].episodes <= 0) delete now[day];
            }
            localStorage.setItem(key, JSON.stringify(now));
          }
        },
        [PAGE_STORAGE_KEY, raw],
      );
      return;
    } catch (err) {
      console.warn("[Kiro Web Reload Timer] couldn't collect from tab", tab.url, err);
    }
  }
}

async function clearPages() {
  if (!api?.tabs?.query || !api?.scripting?.executeScript) return;
  const tabs = await callApi(api.tabs.query, api.tabs, [{ url: "https://app.kiro.dev/*" }]);
  for (const tab of tabs ?? []) {
    try {
      await callApi(api.scripting.executeScript, api.scripting, [
        { target: { tabId: tab.id }, func: (key) => localStorage.removeItem(key), args: [PAGE_STORAGE_KEY] },
      ]);
      return;
    } catch (err) {
      console.warn("[Kiro Web Reload Timer] couldn't clear tab", tab.url, err);
    }
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
  await clearPages();
  await storageSet({ days: {} });
  render();
});

async function refresh() {
  try {
    await collectFromPages();
  } catch (err) {
    console.warn("[Kiro Web Reload Timer] collecting failed:", err);
  }
  await render();
}

api?.storage?.onChanged?.addListener(render);
refresh();
setInterval(refresh, 5000); // pick up new page totals while the popup is open
