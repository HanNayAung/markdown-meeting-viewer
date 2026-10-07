// Shared by the content script and the viewer page.
// Takes Markdown text and turns the current page into a pretty view.

// Small helper to make an element.
function mdvEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Things the page-wide listeners need to find.
const mdvState = { article: null, toc: null, stylePanel: null, styleBtn: null };

// Turn on math and footnotes in the Markdown converter (once).
function mdvSetupMarked() {
  if (mdvState.markedReady) return;
  mdvState.markedReady = true;
  marked.use({ gfm: true });
  marked.use(mdvMathExtension);
  if (typeof markedFootnote !== "undefined") {
    marked.use(markedFootnote({ description: "Notes", sectionClass: "footnotes" }));
  }
}

async function mdvRender(rawText, fileName) {
  const settings = await mdvLoadSettings();
  mdvSetupMarked();
  if (mdvPresent.on) mdvStopPresent();

  // Meeting header at the top of the file, if there is one.
  const { meta, body: mdText } = mdvSplitFrontMatter(rawText);
  mdvTimerPanelClose();
  mdvTimerPrepare(settings, meta);
  mdvTimer.audio = await mdvLoadAudio();

  // Turn Markdown into HTML, then clean it so no scripts can run.
  const content = DOMPurify.sanitize(marked.parse(mdText), {
    RETURN_DOM_FRAGMENT: true,
  });

  const body = document.body;
  body.replaceChildren();
  body.classList.add("mdv");
  body.classList.remove("mdv-toc-open", "mdv-presenting");
  mdvApplySettings(settings);

  const article = mdvEl("article", "mdv-content");
  article.append(content);
  const card = mdvBuildMeetingCard(meta);
  if (card) article.prepend(card);

  // Research extras (see research.js).
  mdvDrawMath(article);
  mdvMakeCallouts(article);
  mdvMakeFigures(article);
  mdvMakeTableCaptions(article);
  mdvPrepareHeadings(article);
  const tasks = mdvCollectTasks(article);
  mdvMarkMentions(article);
  mdvColorCode(article);
  mdvAddCopyButtons(article);

  const raw = mdvEl("pre", "mdv-raw");
  raw.textContent = rawText;
  raw.hidden = true;

  const progress = mdvEl("div", "mdv-progress");
  const stylePanel = mdvBuildStylePanel(settings);

  body.append(progress, article, raw);
  const stats = mdvWordCount(article);
  const toc = mdvBuildSidebar(article, tasks, stats);

  // ---- Top-right buttons ----
  const bar = mdvEl("div", "mdv-bar");

  const tocBtn = mdvEl("button", "mdv-btn", "☰ Outline");
  tocBtn.addEventListener("click", () => mdvSetContents(!toc.classList.contains("open")));

  const presentBtn = mdvEl("button", "mdv-btn mdv-btn-accent", "▶ Present");
  presentBtn.addEventListener("click", () => {
    stylePanel.hidden = true;
    mdvSetContents(false);
    mdvTimerPanelClose();
    mdvStartPresent(article);
  });

  const styleBtn = mdvEl("button", "mdv-btn", "Aa Style");
  styleBtn.addEventListener("click", () => {
    mdvTimerPanelClose();
    stylePanel.hidden = !stylePanel.hidden;
  });

  const timerBtn = mdvEl("button", "mdv-btn", "Timer");
  timerBtn.title = "Set the talk length and bells before presenting";
  timerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    stylePanel.hidden = true;
    mdvTimerPanelToggle(body, false);
  });

  const rawBtn = mdvEl("button", "mdv-btn", "Raw");
  rawBtn.addEventListener("click", () => {
    const showRaw = raw.hidden;
    raw.hidden = !showRaw;
    article.hidden = showRaw;
    rawBtn.textContent = showRaw ? "Pretty" : "Raw";
  });


  bar.append(tocBtn, presentBtn, styleBtn, timerBtn, rawBtn);
  body.append(bar, stylePanel, toc);

  Object.assign(mdvState, { article, toc, stylePanel, styleBtn });
  mdvBindPageListeners();
  window.scrollTo(0, 0);
  mdvOnScroll();

  // Tab title: meeting title, first heading, or the file name.
  const h1 = article.querySelector("h1");
  document.title = (meta && meta.title) || (h1 ? h1.textContent : fileName);
}

// ---- Colorful code ----
function mdvColorCode(article) {
  if (typeof hljs === "undefined") return;
  hljs.configure({ ignoreUnescapedHTML: true });
  article.querySelectorAll("pre code").forEach((code) => {
    try { hljs.highlightElement(code); } catch (e) { /* leave it plain */ }
  });
}

// ---- "Copy" button on every code block ----
function mdvAddCopyButtons(article) {
  article.querySelectorAll("pre").forEach((pre) => {
    const btn = mdvEl("button", "mdv-copy", "Copy");
    btn.addEventListener("click", async () => {
      const text = pre.querySelector("code")?.innerText ?? pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied!";
      } catch (e) {
        btn.textContent = "Couldn't copy";
      }
      setTimeout(() => (btn.textContent = "Copy"), 1500);
    });
    pre.classList.add("mdv-code");
    pre.append(btn);
  });
}

// ---- Sidebar: outline, action items, word count ----
function mdvSetContents(open) {
  if (!mdvState.toc) return;
  mdvState.toc.classList.toggle("open", open);
  document.body.classList.toggle("mdv-toc-open", open);
}

function mdvJumpTo(target) {
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.remove("mdv-flash");
  void target.offsetWidth;
  target.classList.add("mdv-flash");
  if (window.innerWidth < 1200) mdvSetContents(false);
}

function mdvBuildSidebar(article, tasks, stats) {
  const toc = mdvEl("nav", "mdv-toc");

  toc.append(mdvEl("p", "mdv-toc-stats",
    stats.words.toLocaleString() + " words · " + stats.minutes + " min read"));

  // Outline
  const headings = mdvMainHeadings(article).filter((h) => /^H[1-3]$/.test(h.tagName));
  if (headings.length) {
    toc.append(mdvEl("p", "mdv-toc-title", "Outline"));
    const list = mdvEl("ul");
    headings.forEach((h) => {
      const li = mdvEl("li", "level-" + h.tagName[1]);
      const link = mdvEl("a");
      if (h.dataset.num) link.append(mdvEl("span", "mdv-num", h.dataset.num + " "));
      link.append([...h.childNodes]
        .filter((n) => !n.classList?.contains("mdv-num"))
        .map((n) => n.textContent).join(""));
      link.href = "#" + h.id;
      link.dataset.target = h.id;
      link.addEventListener("click", (e) => { e.preventDefault(); mdvJumpTo(h); });
      li.append(link);
      list.append(li);
    });
    toc.append(list);
  }

  // Action items
  if (tasks.length) {
    const open = tasks.filter((t) => !t.done);
    toc.append(mdvEl("p", "mdv-toc-title",
      "Action items · " + open.length + " open / " + tasks.length));
    const list = mdvEl("ul", "mdv-toc-tasks");
    [...open, ...tasks.filter((t) => t.done)].forEach((t) => {
      const li = mdvEl("li", t.done ? "done" : null);
      const link = mdvEl("a", null, (t.done ? "✓ " : "○ ") + t.text);
      link.href = "#" + t.id;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        mdvJumpTo(document.getElementById(t.id));
      });
      li.append(link);
      list.append(li);
    });
    toc.append(list);
  }

  return toc;
}

// ---- Style panel ----
function mdvBuildStylePanel(settings) {
  const panel = mdvEl("div", "mdv-panel");
  panel.hidden = true;

  const update = (change) => {
    Object.assign(settings, change);
    mdvApplySettings(settings);
    mdvSaveSettings(settings);
    refresh();
  };

  // Theme dots
  panel.append(mdvEl("p", "mdv-panel-label", "Theme"));
  const themeGrid = mdvEl("div", "mdv-themes");
  MDV_THEMES.forEach((t) => {
    const btn = mdvEl("button", "mdv-theme");
    btn.dataset.value = t.id;
    const swatch = mdvEl("span", "mdv-swatch");
    swatch.style.background = t.bg;
    const dot = mdvEl("span", "mdv-swatch-dot");
    dot.style.background = t.dot;
    swatch.append(dot);
    btn.append(swatch, mdvEl("span", null, t.name));
    btn.addEventListener("click", () => update({ theme: t.id }));
    themeGrid.append(btn);
  });
  panel.append(themeGrid);

  // Font
  panel.append(mdvEl("p", "mdv-panel-label", "Font"));
  const fontRow = mdvSegments(MDV_FONTS, (v) => update({ font: v }));
  panel.append(fontRow);

  // Size
  const sizeLabel = mdvEl("p", "mdv-panel-label");
  panel.append(sizeLabel);
  const size = mdvEl("input", "mdv-range");
  Object.assign(size, { type: "range", min: 14, max: 24, step: 1 });
  size.addEventListener("input", () => update({ size: Number(size.value) }));
  panel.append(size);

  // Width
  panel.append(mdvEl("p", "mdv-panel-label", "Page width"));
  const widthRow = mdvSegments(MDV_WIDTHS, (v) => update({ width: v }));
  panel.append(widthRow);

  // Heading numbers
  panel.append(mdvEl("p", "mdv-panel-label", "Headings"));
  const numRow = mdvSegments(MDV_NUMBERS, (v) => update({ numbers: v }));
  panel.append(numRow);

  // Reset
  const reset = mdvEl("button", "mdv-reset", "Reset to default");
  reset.addEventListener("click", () => update({ ...MDV_DEFAULTS }));
  panel.append(reset);

  // Show which choices are active.
  function refresh() {
    panel.querySelectorAll(".mdv-theme").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.value === settings.theme));
    const mark = (row, key) => row.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.value === settings[key]));
    mark(fontRow, "font");
    mark(widthRow, "width");
    mark(numRow, "numbers");
    size.value = settings.size;
    sizeLabel.textContent = "Text size · " + settings.size + "px";
  }
  refresh();
  return panel;
}

function mdvSegments(options, onPick) {
  const row = mdvEl("div", "mdv-segments");
  options.forEach((o) => {
    const btn = mdvEl("button", null, o.name);
    btn.dataset.value = o.id;
    btn.addEventListener("click", () => onPick(o.id));
    row.append(btn);
  });
  return row;
}

// ---- Page-wide listeners (added only once) ----
function mdvOnScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  document.body.style.setProperty("--progress", pct + "%");

  const { article, toc } = mdvState;
  if (!toc || !article) return;
  let current = null;
  mdvMainHeadings(article).forEach((h) => {
    if (/^H[1-3]$/.test(h.tagName) && h.getBoundingClientRect().top < 120) current = h.id;
  });
  toc.querySelectorAll("a[data-target]").forEach((a) =>
    a.classList.toggle("active", a.dataset.target === current));
}

function mdvBindPageListeners() {
  if (mdvState.bound) return;
  mdvState.bound = true;

  window.addEventListener("scroll", mdvOnScroll, { passive: true });
  window.addEventListener("resize", mdvOnScroll);

  // Click outside the Style panel closes it.
  document.addEventListener("click", (e) => {
    const { stylePanel, styleBtn } = mdvState;
    if (stylePanel && !stylePanel.hidden &&
        !stylePanel.contains(e.target) && e.target !== styleBtn) {
      stylePanel.hidden = true;
    }
    if (!mdvPresent.on) mdvTimerPanelClose();
  });

  document.addEventListener("keydown", (e) => {
    if (mdvPresentKeys(e)) return;
    if (e.key !== "Escape") return;
    if (mdvState.stylePanel) mdvState.stylePanel.hidden = true;
    mdvAnnounceHide();
    mdvTimerPanelClose();
    mdvSetContents(false);
  });
}
