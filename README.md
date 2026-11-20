# DS5Dongle · Web Configurator

Browser-based configuration and firmware flashing UI for **DS5Dongle** — a BL616/BL618 bridge that lets a PS5 DualSense controller work wirelessly on a PC with its full feature set (adaptive triggers, haptics, speaker, microphone, gyro).

This repository contains **only the web part**. Firmware sources, PCB design and the factory tool are maintained in a separate repository.

---

## Features

| Area | What it does |
|---|---|
| Device status | Connection state, controller state, battery, RSSI, paired controller count, USB speed (HS/FS) |
| Live input | Sticks, buttons, triggers, touchpad position with a fading trail, 6-axis gyro/accelerometer |
| Feel | Lightbar colour, haptic strength, trigger resistance, LED timeout |
| Audio | Speaker/headset volume, gain, buffer depth, audio-to-haptics, mic passthrough |
| Touchpad | D-pad / mouse emulation modes, sensitivity, raw-touch blocking, combo window |
| Remapping | Two profiles, 31 buttons, keyboard/mouse targets, live highlight on the controller image |
| Diagnostics | Rumble, adaptive-trigger, lightbar tests, mic level meter, test tone |
| Firmware | Version list with rollback, SHA-256 allow-list, flashing over Web Serial |

Everything runs in **Chrome or Edge**. There is no installer and no background service: the page talks to the dongle over **WebHID** for configuration and **Web Serial** for flashing.

---

## Requirements

- Python 3.9+ (build script)
- Node.js 18+ (syntax check and tests)
- Chrome / Edge (WebHID + Web Serial)
- A local HTTP server when flashing is involved (`file://` cannot fetch firmware)

---

## Build

```bash
python build.py            # slim build,  ~465 KB — firmware fetched over HTTP
python build.py --embed    # offline single file, ~3.6 MB — firmware embedded
```

`build.py` concatenates the ES modules into a single `index.html`, inlines the controller artwork, and validates the bundle with `node --check` before writing. A module with a syntax error aborts the build instead of producing a blank page.

Outputs: `index.html` and `auth-preview.html`.

### Run locally

```bash
python -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/index.html
```

Windows helpers: `start-web.cmd` (server) and `open-ui.cmd` (server + browser).

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

Or run everything, including the build:

```powershell
.\release.ps1 -SkipFirmware
```

The suites run the page inside a DOM stub (`linkedom`). They pin the UI language to Chinese through a `__DS5_LANG` global so assertions stay stable.

---

## Firmware images are not included

The page reads the available versions from `firmware/<board>/index.json` and fetches the `.bin` at flash time:

```
firmware/v1/index.json
firmware/v12/index.json
```

Drop the built `.bin` files into those folders before deploying, or serve them from your own host. Without them the flasher reports that the firmware must be served over HTTP.

---

## Localisation

13 languages ship with the page:

`en · zh-CN · zh-TW · ja · ko · de · fr · es · it · pt-BR · ru · pl · tr`

- `i18n.mjs` — core dictionary (navigation, metrics, primary actions) for all 13 languages
- `i18n_phrases.mjs` — zh → en phrase table plus regex rules for dynamic strings

Switching is instant and persisted in `localStorage` (`ds5.lang`). Languages other than English fall back to English for strings that are not translated yet.

---

## Project layout

```
app.mjs               application logic (config, live view, dialogs)
protocol.mjs          HID report codec — config 0xF7, remap 0xFB, telemetry 0xF9
test-center.mjs       rumble / trigger / lightbar / audio testers
i18n.mjs              core multilingual dictionary
i18n_phrases.mjs      zh→en phrases and regex rules
template.html         page skeleton (build input)
style.css             styles, dark and light themes
assets/               controller artwork (SVG)
flasher/              Web Serial flasher (BL616 ISP protocol)
tests/                node:test suites
build.py              bundler with syntax guard
release.ps1           build → sync → test
stage.ps1             copy page and firmware into a site tree
sync-firmware.ps1     refresh the firmware catalogue
```

---

## License

MIT — see [LICENSE](LICENSE).
