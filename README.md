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

Tests are grouped with the feature they verify: Visual (lightbar and player indicators), Feel (rumble and triggers), Audio & Mic (test tone and mic meter), and Gyro / Accelerometer (browser-only diagnostics). Feel, Audio & Mic, and Sticks save only their own settings. Sticks requires oc14 firmware: each stick has independent inner and outer deadzones (0–30%, per axis). Inner deadzone suppresses center drift, outer deadzone reaches full output earlier, and 0% for both preserves unmodified input. The live stick graphic shows the USB output after saved adjustments.

The connection color picker previews the color in the browser and stages it for saving. On a connected controller, dragging the picker previews the latest color; either test button can replay it for five seconds. Preview touches only the lightbar by default. Stopping sends the configured connection color, not a snapshot of the game's lights. The optional player-light test turns those indicators off when it ends. Use **Save as connection color** in the test center to submit only the lightbar color, leaving other pending edits untouched. Pure black cannot be saved on current firmware. The saved color applies on controller reconnect; a game can send a different color later.

The local offline build (`python build.py --embed`) includes the newest image for each PCB variant. If board detection is unavailable, select the physical PCB variant explicitly; the USB bootloader does not identify the PCB revision. Older images are served from the firmware directory over HTTP. The update dialog verifies the exact selected release hash before enabling flashing.

The oc13 test firmware reports Flash write results for settings and button mappings. Older firmware can acknowledge the write request but does not confirm persistence. Unsaved drafts can be restored in the same tab when the same browser device handle reconnects. The receiver diagnostics panel shows board-side latency; it does not measure button-to-screen latency. USB negotiation is reported by oc13 and shown as unknown on older firmware.

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

The suites use `linkedom` for DOM emulation, so install it once:

```bash
npm install
```

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

- `i18n-catalog.json` is the source of truth for message IDs and translations across all 13 locales. Edit it instead of the generated `index.html`.
- For new UI copy, add a stable ID under `messages` and translate it for all 13 locales. Use `data-i18n="your_message_id"` on text-only HTML elements, `data-i18n-label="your_message_id"` for accessible labels, or `paintLocalized(node, msg('your_message_id', {count}))` in the app. Keep the ID when editing the wording, and use the same named placeholders in every translation. The node retains its message ID and parameters so switching languages keeps inputs and selections in place.
- Legacy text is still matched against its Simplified Chinese source. For those entries, edit the translations in the catalog; if you change the Chinese wording, update the source in both places or migrate the caller to a stable ID. Existing dynamic patterns are in `i18n_phrases.mjs`.
- Run `npm run i18n:check` to see coverage and possible uncatalogued text, or `npm run i18n:check -- --locale ja` to list missing Japanese IDs. The build checks completeness and placeholders for key-bound UI. `--strict` additionally fails on legacy translation gaps and scan candidates; the text scan is heuristic and can include technical diagnostics.
- Run `python build.py --embed` to regenerate the offline page. The catalog is embedded, so switching languages reads the new translations without fetching files or reloading the page. The tool detects missing translations; it does not generate them.

Language choice is stored in `localStorage` (`ds5.lang`). Localized copy falls back to English where available (legacy Traditional Chinese details fall back to their Simplified Chinese source). Technical flashing logs are preserved as reported.

---

## Project layout

```
app.mjs               application logic (config, live view, dialogs)
protocol.mjs          HID report codec — config 0xF7, remap 0xFB, telemetry 0xF9
test-center.mjs       rumble / trigger / lightbar / audio testers
i18n-catalog.json     shared message IDs and translations
i18n.mjs              locale selection and message lookup
i18n_phrases.mjs      legacy dynamic translation patterns
check-i18n.py         translation coverage and source checks
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
