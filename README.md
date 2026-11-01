# kiro-web-reload-timer

A browser extension that tracks how often the "Reloading sandbox" message is shown to you on [app.kiro.dev](https://app.kiro.dev), and for how long, per day.

## What it counts

- **Time:** seconds the message is on screen in the visible tab. Time stops when you switch tabs, minimize the window, scroll it out of view, or the message goes away.
- **Times shown:** each appearance of the message that you actually saw. Switching tabs or scrolling away and back during the same appearance doesn't count again.

Click the toolbar icon to see today's totals and the last 14 days. Data stays in the browser's local extension storage.

## Install

### Safari

1. Safari Settings → **Advanced** → turn on "Show features for web developers".
2. Settings → **Developer** → turn on "Allow unsigned extensions".
3. Settings → **Developer** → **Add Temporary Extension**, then select this folder.

Safari removes temporary extensions after a while, so you may need to add it again.

### Chrome, Edge, Brave

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.

## Changing the tracked text

Edit `TARGET_TEXT` at the top of `content.js`, then reload the extension.
