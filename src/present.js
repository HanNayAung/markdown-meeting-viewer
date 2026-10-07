// Present mode: turns the notes into full-screen slides.
//
// How slides are split:
//   • If the file uses --- lines, each --- starts a new slide.
//   • Otherwise every # or ## heading starts a new slide.
//   • The meeting header (front matter) becomes the title slide.
//
// Keys: → / Space / PageDown = next, ← / PageUp = back,
//       Home / End = first / last, F = full screen,
//       P = pause timer, T = restart timer, + / − = one minute,
//       N = next-presenter notice, ] / [ = next / previous presenter,
//       S = timer settings, Esc = leave.
// The timer itself lives in timer.js.

const mdvPresent = { on: false, slides: [], index: 0, root: null };

function mdvBuildSlides(article) {
  const nodes = [...article.childNodes].filter(
    (n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent.trim()));
  const slides = [];
  let current = [];
  const push = () => {
    if (current.some((n) => n.textContent.trim() || n.querySelector?.("img, .mdv-math, table"))) {
      slides.push(current);
    }
    current = [];
  };

  const useRules = nodes.some((n) => n.tagName === "HR");

  nodes.forEach((n) => {
    if (n.classList?.contains("mdv-meeting")) {
      push(); current.push(n); push();
    } else if (useRules && n.tagName === "HR") {
      push();
    } else if (!useRules && (n.tagName === "H1" || n.tagName === "H2")) {
      push(); current.push(n);
    } else {
      current.push(n);
    }
  });
  push();
  return slides;
}

function mdvStartPresent(article) {
  const slides = mdvBuildSlides(article);
  if (!slides.length) return;

  const root = mdvEl("div", "mdv-present");
  const stage = mdvEl("div", "mdv-stage");
  const slide = mdvEl("section", "mdv-slide mdv-content");
  stage.append(slide);

  const bar = mdvEl("div", "mdv-present-bar");
  const prev = mdvEl("button", "mdv-pbtn", "‹ Back");
  const counter = mdvEl("span", "mdv-counter");
  const next = mdvEl("button", "mdv-pbtn", "Next ›");
  const timerBtn = mdvEl("button", "mdv-pbtn", "Timer settings");
  const nextSpeakerBtn = mdvEl("button", "mdv-pbtn", "Next presenter ›");
  nextSpeakerBtn.title = "Move to the next presenter and restart the clock ( ] key )";
  nextSpeakerBtn.hidden = !(mdvTimer.lineup && mdvTimer.lineup.names.length);
  nextSpeakerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    mdvLineupGo(mdvTimer.lineup.current + 1);
  });
  const full = mdvEl("button", "mdv-pbtn", "Full screen");
  full.title = "Full screen (F)";
  const exit = mdvEl("button", "mdv-pbtn", "Exit");
  exit.title = "Leave (Esc)";
  bar.append(prev, counter, next, mdvEl("span", "mdv-spacer"), nextSpeakerBtn, timerBtn, full, exit);

  const line = mdvEl("div", "mdv-present-progress");
  root.append(line, stage, bar);
  document.body.append(root);
  document.body.classList.add("mdv-presenting");

  Object.assign(mdvPresent, {
    on: true, slides, index: 0, root, slide, counter, line,
  });

  prev.addEventListener("click", () => mdvGoSlide(mdvPresent.index - 1));
  next.addEventListener("click", () => mdvGoSlide(mdvPresent.index + 1));
  timerBtn.addEventListener("click", (e) => { e.stopPropagation(); mdvTimerPanelToggle(root, true); });
  // Clicking anywhere else closes the timer settings.
  root.addEventListener("click", () => {
    mdvTimerPanelClose();
  });
  full.addEventListener("click", mdvToggleFullscreen);
  exit.addEventListener("click", mdvStopPresent);

  // Click the right side of a slide to go on, left side to go back.
  stage.addEventListener("click", (e) => {
    if (e.target.closest("a, button, input, summary, .katex")) return;
    if (mdvTimer.panel) return; // first click just closes the timer settings
    if (window.getSelection().toString()) return;
    mdvGoSlide(mdvPresent.index + (e.clientX > window.innerWidth / 3 ? 1 : -1));
  });

  mdvTimerStart(root);
  if (!mdvPresent.resizeBound) {
    mdvPresent.resizeBound = true;
    window.addEventListener("resize", () => mdvPresent.on && mdvFitSlide());
  }
  mdvGoSlide(0);
  mdvToggleFullscreen();
}

function mdvGoSlide(i) {
  const p = mdvPresent;
  if (!p.on) return;
  p.index = Math.max(0, Math.min(p.slides.length - 1, i));

  const copy = p.slides[p.index].map((n) => n.cloneNode(true));
  p.slide.replaceChildren(...copy);
  p.slide.querySelectorAll(".mdv-copy").forEach((b) => b.remove());
  p.slide.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));

  // A slide that is only a heading (or the title card) sits in the middle.
  const onlyTitle = copy.length === 1 &&
    (/^H[1-3]$/.test(copy[0].tagName) || copy[0].classList?.contains("mdv-meeting"));
  p.slide.classList.toggle("mdv-title-slide", onlyTitle);

  // Shrink text a little if the slide is too full to fit.
  mdvFitSlide();
  p.slide.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", mdvFitSlide, { once: true });
  });

  p.slide.scrollTop = 0;
  p.counter.textContent = (p.index + 1) + " / " + p.slides.length;
  p.line.style.width = ((p.index + 1) / p.slides.length) * 100 + "%";

  // Restart the fade-in.
  p.slide.classList.remove("mdv-enter");
  void p.slide.offsetWidth;
  p.slide.classList.add("mdv-enter");
}

function mdvFitSlide() {
  const slide = mdvPresent.slide;
  if (!slide) return;
  slide.style.fontSize = "";
  let size = parseFloat(getComputedStyle(slide).fontSize);
  const smallest = size * 0.6;
  while (slide.scrollHeight > slide.clientHeight + 2 && size > smallest) {
    size *= 0.94;
    slide.style.fontSize = size + "px";
  }
}

function mdvToggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  } catch (e) {
    // Full screen not allowed here; slides still work in the window.
  }
}

function mdvStopPresent() {
  const p = mdvPresent;
  if (!p.on) return;
  mdvTimerStop();
  p.root.remove();
  p.on = false;
  document.body.classList.remove("mdv-presenting");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function mdvPresentKeys(e) {
  if (!mdvPresent.on) return false;
  const k = e.key;
  // Typing in the timer settings should not change slides.
  if (e.target.closest && e.target.closest("input, textarea, select")) {
    if (k === "Escape") e.target.blur();
    return true;
  }
  if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) mdvGoSlide(mdvPresent.index + 1);
  else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) mdvGoSlide(mdvPresent.index - 1);
  else if (k === "Home") mdvGoSlide(0);
  else if (k === "End") mdvGoSlide(mdvPresent.slides.length - 1);
  else if (k === "f" || k === "F") mdvToggleFullscreen();
  else if (k === "t" || k === "T") mdvTimerReset();
  else if (k === "p" || k === "P") mdvTimerPause();
  else if (k === "+" || k === "=") mdvTimerAdjust(60);
  else if (k === "-" || k === "_") mdvTimerAdjust(-60);
  else if (k === "s" || k === "S") mdvTimerPanelToggle(mdvPresent.root, true);
  else if (k === "n" || k === "N") mdvAnnounceToggle();
  else if (k === "]") mdvLineupGo(mdvTimer.lineup.current + 1);
  else if (k === "[") mdvLineupGo(mdvTimer.lineup.current - 1);
  else if (k === "Escape") {
    if (mdvTimer.announceEl) mdvAnnounceHide();
    else if (mdvTimer.panel) mdvTimerPanelClose();
    else mdvStopPresent();
  }
  else return true;
  e.preventDefault();
  return true;
}
