# Maintaining Markdown Meeting Viewer

A short guide for publishing and keeping the add-on up to date.

## The big picture

```
you edit src/  →  npm start (try it)  →  bump version + CHANGELOG  →  git tag vX.Y.Z  →  push
                                                                                       ↓
                         GitHub checks it, uploads to addons.mozilla.org, makes a GitHub Release
                                                                                       ↓
                               Mozilla reviews it (minutes to a few days)  →  users update automatically
```

## First publication (once, by hand)

1. **Create a Firefox account** and open the Developer Hub:
   https://addons.mozilla.org/developers/
2. **Build the zip**: `npm install` then `npm run build`
   → `dist/markdown-meeting-viewer-1.0.0.zip`
3. **Submit a New Add-on** → choose **"On this site"** (listed on AMO) → upload the zip.
4. When asked whether you use code generators, minifiers or bundlers: answer **No**.
   That question means tools that *transform* code into a hard-to-read form
   (webpack, TypeScript, minifiers) — not who wrote it. Our `src/` code is
   readable JavaScript that runs exactly as written, with no build step.
   `src/lib/` holds unmodified official library files (listed in
   `THIRD_PARTY.md`, which helps the reviewer). That the code was written with
   an AI assistant is stated openly in the README and the listing.
5. **Fill in the listing** — copy the text from `store/listing.md`:
   name, summary, description, categories, support email, license **MIT**.
   Upload `src/icons/icon-128.png` as the icon and the images in
   `docs/screenshots/` as screenshots.
6. Submit. You'll get an email when the review is done.
7. Put the real add-on page link into `README.md` if it differs.

## Connect GitHub to AMO (once)

1. Get API keys: https://addons.mozilla.org/developers/addon/api/key/
2. In your GitHub repo → **Settings → Secrets and variables → Actions** → add
   - `AMO_JWT_ISSUER` = the "JWT issuer"
   - `AMO_JWT_SECRET` = the "JWT secret"

Never put these keys in a file or commit them.

## Releasing a new version

1. Make your changes in `src/`, test with `npm start`.
2. Pick the new version number:
   - `1.0.1` — bug fix · `1.1.0` — new feature · `2.0.0` — big change
3. Change it in **both** `src/manifest.json` and `package.json`.
4. Add a section at the top of `CHANGELOG.md`, e.g. `## 1.0.1 — 2026-11-02`.
5. Check: `npm run check-version` and `npm run lint`.
6. Commit, tag and push:
   ```sh
   git commit -am "Release 1.0.1"
   git tag v1.0.1
   git push && git push --tags
   ```
7. The **Release** workflow does the rest. Watch it under the repo's **Actions** tab.

AMO never accepts the same version twice — if an upload fails after the
version was accepted, bump to the next patch number.

## Things to check before each release

- Open `examples/example-meeting.md`: math, callouts, table/figure captions,
  footnote, outline sidebar, action items.
- Every theme in **Aa Style** (light and dark).
- **Present**: slides, full screen, timer bells (set talk length to 1 min to
  test quickly), next-presenter notice and its sound, `]` / `[`.
- `Ctrl+P` print preview.

## Updating the libraries (every few months)

```sh
npm run update-libs
npm start          # test everything above
```
Then update the versions in `THIRD_PARTY.md`, add a CHANGELOG line, and release.

## Keeping old settings working

Users' settings are saved in Firefox. When you rename or remove an option,
add a small conversion in `mdvCleanSettings()` in `src/settings.js`
(for example: `if (s.theme === "old-name") s.theme = "new-name";`),
so nobody's saved settings break.

**Never change the add-on ID** in `src/manifest.json`
(`browser_specific_settings.gecko.id`). It is how Firefox and AMO know
it is the same add-on.

## Where things are

| Path | What |
|---|---|
| `src/manifest.json` | name, version, permissions |
| `src/render.js` | builds the page, buttons, Style panel |
| `src/research.js` | header card, math, callouts, figures, action items |
| `src/present.js` | slides and keys |
| `src/timer.js` | clock, bells, presenter list, notice and its sound |
| `src/settings.js` | defaults, themes list, saving settings |
| `src/viewer.css` | all colors and layout (themes at the top) |
| `src/lib/`, `src/sounds/` | third-party files and built-in voices — don't edit by hand |
| `store/listing.md` | text for the AMO page |
| `docs/screenshots/` | images for the AMO page and README |
