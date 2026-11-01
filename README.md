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

### Safari, permanent install (Apple Developer Program)

On a Mac with Xcode, from the repo folder:

```sh
xcrun safari-web-extension-converter . \
  --project-location ../kiro-web-reload-timer-xcode \
  --app-name "Kiro Web Reload Timer" \
  --bundle-identifier com.nikovirtala.kiro-web-reload-timer \
  --macos-only --swift --no-open
```

The generated project points at the files in this folder, so code changes here are picked up on the next build.

1. Open the generated `.xcodeproj` in Xcode.
2. Under **Signing & Capabilities**, set your team for both the app target and the extension target.
3. **Product → Run** builds and installs it. Or, to install a signed copy you can keep in `/Applications`, use **Product → Archive → Distribute App → Developer ID**.
4. In Safari Settings → **Extensions**, turn on Kiro Web Reload Timer and allow it on app.kiro.dev.

### Chrome, Edge, Brave

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.

## Changing the tracked text

Edit `TARGET_TEXT` at the top of `content.js`, then reload the extension.
