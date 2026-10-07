# addons.mozilla.org listing

Copy each part into the matching field when submitting.
AMO lets you add a Japanese version of the listing too
(Edit Product Page → choose 日本語 next to "Localize").

---

## Name (max 50)

Markdown Meeting Viewer

## Summary (max 250)

**English**

Open Markdown files as clean pages and present them as slides — with math, callouts, a talk timer with 1/2/3 bells, and an automatic “next presenter” notice. Made for research group meetings.

**日本語**

Markdown ファイルを見やすいページで開き、スライドとして発表できます。数式、コールアウト、1鈴・2鈴・3鈴の発表タイマー、「次の発表者」の自動アナウンス付き。研究室のミーティング向けです。

## Categories

- Appearance
- Other

## Tags

markdown, viewer, slides, presentation, timer, research, math, katex

## Description

**English**

Markdown Meeting Viewer turns any .md file into a clean, readable page — and into slides for your lab meeting.

<b>Read</b>
• Open a .md file in Firefox, or click the toolbar button and drop one in
• Themes (light, dark, sepia, navy, KG…), text size, page width, numbered headings
• Outline sidebar, word count, action items (- [ ]) and @mentions
• Math with KaTeX ($…$ and $$…$$), callout boxes (> [!RESULT], > [!QUESTION]…), footnotes
• Numbered figures and tables, colored code with copy buttons
• Meeting header (title, date, presenter, attendees) from the file's front matter
• Ctrl+P prints a clean black-on-white handout

<b>Present</b>
• Slides from --- or headings, full screen, keyboard control, auto-fit
• Big talk timer: 7:00 by default, counts down, turns amber and red
• Conference bells: 1st bell before the end, 2nd at the end, 3rd after Q&A — they move with the talk length
• Presenter list: a notice in the middle of the slide announces the next presenter, with a built-in voice or your own audio file
• Keys: P pause, T restart, +/− one minute, N notice, ] / [ next / previous presenter

<b>Private</b>
Everything runs inside your browser. The add-on collects nothing and sends nothing.

Created by Han Nay Aung. Most of the code was written with an AI assistant (Claude by Anthropic) and tested by the author.

**日本語**

Markdown Meeting Viewer は、.md ファイルを見やすいページにし、研究室のミーティングでそのままスライドとして発表できる拡張機能です。

<b>読む</b>
• .md ファイルを Firefox で開くか、ツールバーのボタンからドロップ
• テーマ（ライト、ダーク、セピア、Navy、KG など）、文字サイズ、ページ幅、見出し番号
• 目次、文字数、アクションアイテム、@メンション
• 数式（KaTeX）、コールアウト、脚注、図表番号、コードの色分けとコピー
• ファイル先頭のヘッダーから、タイトル・日付・発表者・参加者を表示
• Ctrl+P できれいな白黒の配布資料

<b>発表する</b>
• --- または見出しでスライドに分割、全画面、キー操作、自動で文字サイズ調整
• 大きな発表タイマー（初期値 7:00）、色が変わってお知らせ
• 1鈴・2鈴・3鈴（発表時間に連動）
• 発表者リスト：終了前に、スライド中央で次の発表者を音声付きでお知らせ
• キー：P 一時停止、T 最初から、+/− 1分、N お知らせ、] / [ 次・前の発表者

<b>プライバシー</b>
すべてブラウザ内で動作し、データの収集・送信は一切ありません。

作者：Han Nay Aung。コードの大部分は AI アシスタント（Anthropic の Claude）を使って書き、作者がテストしています。

## License

MIT

(After the code is on GitHub, add its Issues page as the "Support site".)

## Notes to reviewer

Plain JavaScript, no build step, no minification of our own code.
The code was written with an AI assistant (Claude) and reviewed/tested by the author.
src/lib/ contains unmodified official library files; versions and sources are
listed in THIRD_PARTY.md. The add-on makes no network requests.
src/sounds/*.mp4 are short voice recordings generated with Open JTalk.
To test: open any .md file in Firefox (or click the toolbar button and drop one in), then press ▶ Present.

Permissions:
- storage / unlimitedStorage: saves the user's settings and an optional
  audio file the user chooses for the "next presenter" notice.
- clipboardWrite: the "Copy" button on code blocks.
- Content script on *.md pages: renders Markdown files the user opens.
