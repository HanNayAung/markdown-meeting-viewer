# Third-party files

These files are included **unmodified**, exactly as published. Mozilla's reviewers
may compare them with the official copies, so don't edit them — update them with
`npm run update-libs` instead.

| File in `src/lib/` | Project | Version | Official source | License |
|---|---|---|---|---|
| `marked.min.js` (from `lib/marked.umd.js`) | marked | 18.1.0 | https://www.npmjs.com/package/marked | MIT |
| `marked-footnote.js` (from `dist/index.umd.js`) | marked-footnote | 1.4.0 | https://www.npmjs.com/package/marked-footnote | MIT |
| `purify.min.js` (from `dist/purify.min.js`) | DOMPurify | 3.4.16 | https://www.npmjs.com/package/dompurify | Apache-2.0 / MPL-2.0 |
| `highlight.min.js` | highlight.js (cdn-assets) | 11.12.0 | https://www.npmjs.com/package/@highlightjs/cdn-assets | BSD-3-Clause |
| `katex.min.js`, `katex.min.css`, `fonts/*.woff2` | KaTeX | 0.19.0 | https://www.npmjs.com/package/katex | MIT |

## Sounds (`src/sounds/`)

Made for this project with Open JTalk.

| File | Voice model | License |
|---|---|---|
| `next-presenter-f.mp4` | tohoku-f01 (neutral), Tohoku University — https://github.com/icn-lab/htsvoice-tohoku-f01 | CC BY 4.0 |
| `next-presenter-m.mp4` | nitech-jp-atr503-m001, Nagoya Institute of Technology | CC BY 3.0 |

Both say 「次の発表者の方は、準備をお願いします。」 and are Opus audio in an MP4
container, so Firefox plays them on every system without extra codecs.
