# DS5Dongle · Web Configurator

Browser-based configuration and firmware flashing UI for the **DS5Dongle** — a BL616/BL618 based bridge that lets a PS5 DualSense controller work wirelessly on PC with its full feature set.

> 浏览器端配置器与固件烧录界面，用于 **DS5Dongle**（基于 BL616/BL618 的 DualSense 无线接收器）。

This repository contains **only the web part**. Firmware sources and PCB design are maintained separately.
本仓库**只包含网页部分**，固件与硬件设计单独维护。

---

## What it does

| Feature | 说明 |
|---|---|
| Device status | Connection, controller state, battery, RSSI, paired count, USB speed |
| Live input view | Sticks, buttons, triggers, touchpad trail, 6-axis gyro/accel |
| Settings | Lightbar, haptics, triggers, audio, touchpad/mouse emulation, remapping |
| Diagnostics | Rumble / trigger / lightbar tests, mic level, audio tone |
| Firmware update | Flashes the dongle through Web Serial, with SHA-256 allow-list |

Runs entirely in **Chrome / Edge** — no installer, no background service. The page talks to the dongle over **WebHID** (configuration) and **Web Serial** (flashing).

---

## Build

```bash
cd web          # this repository root
python build.py             # slim build  (~465 KB, firmware fetched over HTTP)
python build.py --embed     # offline single file (~3.6 MB, firmware embedded)
```

`build.py` concatenates the ES modules into a single `index.html`, inlines the controller artwork, and validates the result with `node --check` before writing (a broken module aborts the build instead of producing a blank page).

Output: `index.html` (+ `auth-preview.html`).

### Requirements

- Python 3.9+
- Node.js (only for `--check` validation and the tests)
- A local HTTP server for anything that touches firmware:

```bash
python -m http.server 8765 --bind 127.0.0.1
# then open http://127.0.0.1:8765/index.html
```

Windows helper: double-click `start-web.cmd`.

---

## Test

```bash
node tests/auth.test.mjs
node tests/config.test.mjs
node tests/firmware-version.test.mjs
node tests/flasher.test.mjs
node tests/restart.test.mjs
node tests/test-center.test.mjs
```

Or all at once:

```powershell
.\release.ps1 -SkipFirmware
```

Tests run against a DOM stub (`linkedom`); they use a `__DS5_LANG` global to pin the language to Chinese.

---

## Firmware images are not in this repo

The page lists available firmware from `firmware/<board>/index.json` and fetches the `.bin` files at flash time:

```
firmware/v1/index.json     ← catalog (version, size, sha256, notes)
firmware/v12/index.json
```

Copy the built `.bin` files into those folders before deploying, or point the page at a server that serves them. Without them the flasher reports “固件需要通过 HTTP 访问”.

---

## Localisation

13 languages ship with the page:

`en · zh-CN · zh-TW · ja · ko · de · fr · es · it · pt-BR · ru · pl · tr`

- `i18n.mjs` — core dictionary (navigation, metrics, primary actions) for all 13 languages
- `i18n_phrases.mjs` — zh → en phrase table plus regex rules for dynamic strings

Switching language is instant and persisted in `localStorage` (`ds5.lang`).

---

## Project layout

```
app.mjs               application logic (config, live view, dialogs)
protocol.mjs          HID report codec (config 0xF7, remap 0xFB, telemetry 0xF9)
test-center.mjs       rumble / trigger / lightbar / audio testers
i18n.mjs              core multilingual dictionary
i18n_phrases.mjs      zh→en phrases and regex rules
template.html         page skeleton (build input)
style.css             styles (dark + light themes)
assets/               controller artwork (SVG)
flasher/              Web Serial flasher (BL616 ISP protocol)
tests/                node:test suites
build.py              bundler with syntax guard
release.ps1           build → sync → test
stage.ps1             copy page + firmware into a site tree
```

---

## License

MIT — see [LICENSE](LICENSE).
