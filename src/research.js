// Research features: meeting header, math, callouts, figures,
// tables, numbered headings, action items, @mentions, word count.

// ---------------------------------------------------------
// MEETING HEADER (front matter)
// A block at the very top of the file like:
//   ---
//   title: Group meeting
//   date: 2026-10-07
//   presenter: Sam
//   attendees: [Ana, Li, Omar]
//   ---
// ---------------------------------------------------------
function mdvSplitFrontMatter(text) {
  const m = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { meta: null, body: text };

  const meta = {};
  let lastKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(mdvNoComment(line));
    if (item && lastKey) {
      if (!Array.isArray(meta[lastKey])) meta[lastKey] = meta[lastKey] ? [meta[lastKey]] : [];
      meta[lastKey].push(mdvUnquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z][\w -]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    lastKey = kv[1].trim();
    let value = mdvNoComment(kv[2]).trim();
    if (/^\[.*\]$/.test(value)) {
      value = value.slice(1, -1).split(",").map((s) => mdvUnquote(s.trim())).filter(Boolean);
    } else {
      value = mdvUnquote(value);
    }
    meta[lastKey] = value;
  }
  return { meta, body: text.slice(m[0].length) };
}

// Drop a "  # comment" at the end of a line (a # inside quotes is kept).
function mdvNoComment(s) {
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s;
}

function mdvUnquote(s) {
  return s.replace(/^(["'])(.*)\1$/, "$2");
}

function mdvBuildMeetingCard(meta) {
  if (!meta || Object.keys(meta).length === 0) return null;
  const card = mdvEl("header", "mdv-meeting");

  const title = meta.title || meta.Title;
  if (title) card.append(mdvEl("h1", "mdv-meeting-title", String(title)));

  const grid = mdvEl("dl", "mdv-meeting-grid");
  for (const [key, value] of Object.entries(meta)) {
    if (["title", "timer", "bells", "warning", "warn", "qa", "q&a", "questions",
         "next", "next presenter", "next-presenter", "announce", "announce-message", "announce message",
         "announce-audio", "announce audio"]
          .includes(key.toLowerCase()) || value === "" ||
        (Array.isArray(value) && value.length === 0)) continue;
    const row = mdvEl("div", "mdv-meeting-row");
    row.append(mdvEl("dt", null, key.replace(/[_-]/g, " ")));
    const dd = mdvEl("dd");
    if (Array.isArray(value)) {
      value.forEach((v) => dd.append(mdvEl("span", "mdv-chip", v)));
    } else {
      dd.textContent = value;
    }
    row.append(dd);
    grid.append(row);
  }
  if (grid.children.length) card.append(grid);
  return card;
}

// ---------------------------------------------------------
// MATH  ($inline$, $$display$$, \( \), \[ \])
// Marked leaves a placeholder; KaTeX draws it after cleaning.
// ---------------------------------------------------------
function mdvAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const mdvMathExtension = {
  extensions: [
    {
      name: "mdvMathBlock",
      level: "block",
      start(src) {
        const i = src.search(/^ {0,3}(\$\$|\\\[)/m);
        return i < 0 ? undefined : i;
      },
      tokenizer(src) {
        const m = /^ {0,3}\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src) ||
                  /^ {0,3}\\\[([\s\S]+?)\\\][ \t]*(?:\n+|$)/.exec(src);
        if (m) return { type: "mdvMathBlock", raw: m[0], text: m[1].trim() };
      },
      renderer(token) {
        return `<div class="mdv-math" data-display="true" data-tex="${mdvAttr(token.text)}"></div>\n`;
      },
    },
    {
      name: "mdvMathInline",
      level: "inline",
      start(src) {
        const i = src.search(/\$|\\\(/);
        return i < 0 ? undefined : i;
      },
      tokenizer(src) {
        let m = /^\$\$((?:\\.|[^\\$])+?)\$\$/.exec(src);
        if (m) return { type: "mdvMathInline", raw: m[0], text: m[1].trim(), display: true };
        // $...$ — not "$5 and $10": no space just inside, no digit right after.
        m = /^\$(?!\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
        if (m) return { type: "mdvMathInline", raw: m[0], text: m[1], display: false };
        m = /^\\\(([\s\S]+?)\\\)/.exec(src);
        if (m) return { type: "mdvMathInline", raw: m[0], text: m[1].trim(), display: false };
      },
      renderer(token) {
        return `<span class="mdv-math" data-display="${token.display}" data-tex="${mdvAttr(token.text)}"></span>`;
      },
    },
  ],
};

function mdvDrawMath(root) {
  if (typeof katex === "undefined") return;
  root.querySelectorAll(".mdv-math").forEach((el) => {
    try {
      katex.render(el.dataset.tex, el, {
        displayMode: el.dataset.display === "true",
        throwOnError: false,
      });
    } catch (e) {
      el.textContent = el.dataset.tex;
    }
  });
}

// ---------------------------------------------------------
// CALLOUT BOXES
//   > [!RESULT] Optional title
//   > Accuracy went up 4%.
// ---------------------------------------------------------
const MDV_CALLOUTS = {
  note:       { icon: "📝", label: "Note" },
  info:       { icon: "ℹ️", label: "Info" },
  tip:        { icon: "💡", label: "Tip" },
  important:  { icon: "❗", label: "Important" },
  warning:    { icon: "⚠️", label: "Warning" },
  caution:    { icon: "🛑", label: "Caution" },
  question:   { icon: "❓", label: "Question" },
  idea:       { icon: "✨", label: "Idea" },
  hypothesis: { icon: "🔬", label: "Hypothesis" },
  result:     { icon: "📊", label: "Result" },
  decision:   { icon: "✅", label: "Decision" },
  todo:       { icon: "☑️", label: "To do" },
  summary:    { icon: "📌", label: "Summary" },
  example:    { icon: "🧪", label: "Example" },
};

function mdvMakeCallouts(root) {
  root.querySelectorAll("blockquote").forEach((bq) => {
    const p = bq.firstElementChild;
    if (!p || p.tagName !== "P") return;
    const first = p.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) return;

    const m = /^\s*\[!([A-Za-z]+)\][ \t]*([^\n]*)\n?/.exec(first.textContent);
    if (!m) return;
    const type = m[1].toLowerCase();
    const info = MDV_CALLOUTS[type] || { icon: "📝", label: m[1] };

    first.textContent = first.textContent.slice(m[0].length);
    if (!p.textContent.trim() && !p.querySelector("img, .mdv-math")) p.remove();

    const box = mdvEl("div", "mdv-callout");
    box.dataset.type = MDV_CALLOUTS[type] ? type : "note";
    const title = mdvEl("div", "mdv-callout-title");
    title.append(mdvEl("span", "mdv-callout-icon", info.icon),
                 mdvEl("span", null, m[2].trim() || info.label));
    const body = mdvEl("div", "mdv-callout-body");
    body.append(...bq.childNodes);
    box.append(title, body);
    bq.replaceWith(box);
  });
}

// ---------------------------------------------------------
// FIGURES AND TABLES
// An image on its own line becomes "Figure 1: <alt text>".
// A line "Table: caption" just before or after a table
// becomes "Table 1: caption".
// ---------------------------------------------------------
function mdvMakeFigures(root) {
  let n = 0;
  root.querySelectorAll("p").forEach((p) => {
    const kids = [...p.childNodes].filter(
      (k) => !(k.nodeType === Node.TEXT_NODE && !k.textContent.trim()));
    if (kids.length !== 1) return;
    const img = kids[0].tagName === "IMG" ? kids[0]
      : (kids[0].tagName === "A" && kids[0].children.length === 1 &&
         kids[0].firstElementChild.tagName === "IMG") ? kids[0].firstElementChild : null;
    if (!img) return;

    const fig = mdvEl("figure", "mdv-figure");
    fig.append(kids[0]);
    const text = img.getAttribute("title") || img.getAttribute("alt");
    if (text) {
      n++;
      const cap = mdvEl("figcaption");
      cap.append(mdvEl("strong", null, "Figure " + n + ". "), text);
      fig.append(cap);
    }
    p.replaceWith(fig);
  });
}

function mdvMakeTableCaptions(root) {
  let n = 0;
  root.querySelectorAll("table").forEach((table) => {
    const isCaption = (el) => el && el.tagName === "P" && /^table:\s*/i.test(el.textContent);
    const before = table.previousElementSibling;
    const after = table.nextElementSibling;
    const capP = isCaption(after) ? after : isCaption(before) ? before : null;

    const wrap = mdvEl("figure", "mdv-table");
    table.replaceWith(wrap);
    wrap.append(table);

    if (capP) {
      n++;
      const cap = mdvEl("figcaption");
      const first = capP.firstChild;
      if (first && first.nodeType === Node.TEXT_NODE) {
        first.textContent = first.textContent.replace(/^\s*table:\s*/i, "");
      }
      cap.append(mdvEl("strong", null, "Table " + n + ". "), ...capP.childNodes);
      wrap.prepend(cap);
      capP.remove();
    }
  });
}

// ---------------------------------------------------------
// HEADINGS: ids for jumping, plus 1 / 1.1 / 1.1.1 numbers
// (numbers only show when "Numbered" is chosen in Style).
// ---------------------------------------------------------
function mdvMainHeadings(root) {
  return [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")]
    .filter((h) => !h.closest(".footnotes, .mdv-meeting"));
}

function mdvPrepareHeadings(root) {
  const used = {};
  const count = [0, 0, 0];
  mdvMainHeadings(root).forEach((h) => {
    let slug = h.textContent.toLowerCase().trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
    if (used[slug]) slug += "-" + used[slug]++;
    else used[slug] = 1;
    h.id = slug;

    const level = Number(h.tagName[1]);
    if (level >= 2 && level <= 4) {
      count[level - 2]++;
      for (let i = level - 1; i < 3; i++) count[i] = 0;
      const num = count.slice(0, level - 1).join(".");
      h.dataset.num = num;
      h.prepend(mdvEl("span", "mdv-num", num + " "));
    }
  });
}

// ---------------------------------------------------------
// ACTION ITEMS ( - [ ] task ) and @mentions
// ---------------------------------------------------------
function mdvCollectTasks(root) {
  const tasks = [];
  root.querySelectorAll('li > input[type="checkbox"]').forEach((box, i) => {
    const li = box.parentElement;
    li.id = li.id || "task-" + (i + 1);
    li.classList.add("mdv-task");
    if (box.checked) li.classList.add("done");
    tasks.push({ id: li.id, done: box.checked, text: li.textContent.trim() });
  });
  return tasks;
}

function mdvMarkMentions(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement.closest("code, pre, a, .mdv-math, .katex")) {
        return NodeFilter.FILTER_REJECT;
      }
      return /(^|\s|\()@[A-Za-z]/.test(node.textContent)
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const parts = node.textContent.split(/((?:^|(?<=[\s(]))@[A-Za-z][\w.-]*[\w])/);
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (/^@[A-Za-z]/.test(part)) frag.append(mdvEl("span", "mdv-mention", part));
      else if (part) frag.append(part);
    });
    node.replaceWith(frag);
  });
}

// ---------------------------------------------------------
// WORD COUNT
// ---------------------------------------------------------
function mdvWordCount(root) {
  const text = root.innerText || root.textContent || "";
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  return { words, minutes: Math.max(1, Math.round(words / 230)) };
}
