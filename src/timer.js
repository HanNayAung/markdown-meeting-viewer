// Presentation timer with bells (1鈴 / 2鈴 / 3鈴).
//
// • Big clock in a corner of the slides (top right by default).
// • Counts down the talk length, or counts up.
// • Bells move with the talk length:
//     1鈴 rings once   — a set time BEFORE the end (warning)
//     2鈴 rings twice  — at the end of the talk
//     3鈴 rings 3 times — a set time AFTER the end (Q&A over)
// • Turns amber after 1鈴 and red after 2鈴.
// • Click the clock to pause (or to start, if "On click" is chosen).
// • Keys while presenting: P pause, T restart, + / − one minute, S settings.
// • A file can set its own times in its header:
//     timer: 12      (talk length, minutes)
//     warning: 2     (1鈴, minutes before the end — or "off")
//     qa: 5          (3鈴, minutes of Q&A after the end — or "off")
//     next: 山田       (next presenter, shown in a notice near the end)
//     announce: 3    (minutes before the end to show it — or "off")
//     announce-message: 次は {next} さんです。
//     announce-audio: yamada.mp3   (your own recording, same folder as the .md)

const mdvTimer = {
  settings: null, cfg: null, fileKeys: new Set(),
  el: null, timeEl: null, labelEl: null, dotsEl: null, root: null,
  panel: null, panelRefresh: null,
  started: false, running: false, startedAt: 0, before: 0,
  rung: [false, false, false], interval: null, ctx: null,
  announced: false, announceEl: null, announceTimer: null,
};

// ---------- time text ----------
function mdvFmt(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? h + ":" + String(m).padStart(2, "0") + ":" + ss
           : String(m).padStart(2, "0") + ":" + ss;
}

// "8" → 480, "8:30" → 510, "1:05:00" → 3900
function mdvParseTime(text) {
  const parts = String(text).trim().split(":").map((p) => p.trim());
  if (!parts.length || parts.some((p) => p === "" || isNaN(p))) return null;
  const n = parts.map(Number);
  let s;
  if (n.length === 1) s = n[0] * 60;
  else if (n.length === 2) s = n[0] * 60 + n[1];
  else if (n.length === 3) s = n[0] * 3600 + n[1] * 60 + n[2];
  else return null;
  return s >= 0 ? Math.round(s) : null;
}

// The three bell times, worked out from the talk length.
function mdvBells(cfg) {
  return [
    { on: cfg.warn.on, at: Math.max(0, cfg.duration - cfg.warn.before) },
    { on: cfg.end.on, at: cfg.duration },
    { on: cfg.qa.on, at: cfg.duration + cfg.qa.after },
  ];
}

// ---------- settings + the file header ----------
// Called every time a file is shown.
function mdvTimerPrepare(settings, meta) {
  const cfg = JSON.parse(JSON.stringify(settings.timer));
  const fileKeys = new Set();
  const fileAnnounce = new Set();   // which notice fields the header sets
  const saved = settings.lineup || { names: [], current: 0 };
  const lineup = {
    names: [...(saved.names || [])],
    current: Math.max(0, Math.min(Number(saved.current) || 0, Math.max(0, (saved.names || []).length - 1))),
    fromFile: false,
  };

  if (meta) {
    const get = (...names) => {
      const key = Object.keys(meta).find((k) => names.includes(k.toLowerCase()));
      return key === undefined ? undefined : meta[key];
    };
    const isOff = (v) => /^(off|no|none|false)$/i.test(String(v).trim());

    const length = mdvParseTime(get("timer") ?? "");
    if (length) { cfg.duration = length; fileKeys.add("duration"); }

    const warning = get("warning", "warn");
    if (warning !== undefined) {
      const s = mdvParseTime(warning);
      cfg.warn = isOff(warning) || s === null ? { on: false, before: cfg.warn.before } : { on: true, before: s };
      fileKeys.add("warn");
    }

    const qa = get("qa", "q&a", "questions");
    if (qa !== undefined) {
      const s = mdvParseTime(qa);
      cfg.qa = isOff(qa) || s === null ? { on: false, after: cfg.qa.after } : { on: true, after: s };
      fileKeys.add("qa");
    }

    // Presenter list:  presenters: [A, B, C]   and who is presenting now:  presenter: A
    let list = get("presenters", "lineup", "speakers");
    if (typeof list === "string") list = list.split(",");
    if (Array.isArray(list)) {
      lineup.names = list.map((n) => String(n).trim()).filter(Boolean);
      lineup.fromFile = true;
      lineup.current = 0;
    }
    const now = get("presenter", "speaker");
    if (now !== undefined) {
      const i = lineup.names.findIndex((n) => mdvSameName(n, String(now)));
      if (i >= 0) lineup.current = i;
    }

    // Next presenter notice
    const next = get("next", "next presenter", "next-presenter");
    const when = get("announce");
    const msg = get("announce-message", "announce message");
    const audio = get("announce-audio", "announce audio");
    if (audio !== undefined && String(audio).trim()) {
      try {
        cfg.announce.audioUrl = new URL(String(audio).trim(), location.href).href;
        cfg.announce.voiceMode = "file";
        fileKeys.add("announce");
        fileAnnounce.add("voiceMode");
      } catch (e) { /* not a usable path */ }
    }
    if (next !== undefined || when !== undefined || msg !== undefined) {
      if (next !== undefined) {
        cfg.announce.next = Array.isArray(next) ? next.join(", ") : String(next);
        fileAnnounce.add("next");
      }
      if (when !== undefined) {
        const s = mdvParseTime(when);
        if (isOff(when) || s === null) cfg.announce.on = false;
        else { cfg.announce.on = true; cfg.announce.before = s; }
        fileAnnounce.add("on").add("before");
      }
      if (msg !== undefined) { cfg.announce.message = String(msg); fileAnnounce.add("message"); }
      fileKeys.add("announce");
    }

    // Older style: bells: [8, 10, 15]  (fixed times)
    let bells = get("bells");
    if (typeof bells === "string") bells = bells.split(",");
    if (Array.isArray(bells) && bells.length) {
      const t = bells.map((b) => mdvParseTime(b));
      if (!fileKeys.has("duration") && t[1] !== null && t[1] !== undefined) {
        cfg.duration = t[1]; fileKeys.add("duration");
      }
      if (!fileKeys.has("warn")) {
        cfg.warn = t[0] != null ? { on: true, before: Math.max(0, cfg.duration - t[0]) } : { ...cfg.warn, on: false };
        fileKeys.add("warn");
      }
      if (!fileKeys.has("qa")) {
        cfg.qa = t[2] != null ? { on: true, after: Math.max(0, t[2] - cfg.duration) } : { ...cfg.qa, on: false };
        fileKeys.add("qa");
      }
    }
  }
  Object.assign(mdvTimer, { settings, cfg, fileKeys, fileAnnounce, lineup });
}

// Save changed fields as your default — except ones this file's header sets.
function mdvTimerChanged(fields) {
  const t = mdvTimer;
  let saveIt = false;
  fields.forEach((f) => {
    if (f === "announce") {
      // Save the notice settings, but keep your own values for the parts the header sets.
      const copy = JSON.parse(JSON.stringify(t.cfg.announce));
      (t.fileAnnounce || new Set()).forEach((k) => { copy[k] = t.settings.timer.announce[k]; });
      delete copy.audioUrl;
      t.settings.timer.announce = copy;
      saveIt = true;
      return;
    }
    if (t.fileKeys.has(f)) return;
    t.settings.timer[f] = JSON.parse(JSON.stringify(t.cfg[f]));
    saveIt = true;
  });
  if (saveIt) mdvSaveSettings(t.settings);
  if (t.el) mdvTimerResync();
  if (t.panelRefresh) t.panelRefresh();
}

// ---------- the clock on the slides ----------
function mdvTimerStart(parent) {
  const t = mdvTimer;
  Object.assign(t, {
    started: t.cfg.autostart, running: t.cfg.autostart,
    startedAt: Date.now(), before: 0, rung: [false, false, false], root: parent,
    announced: false,
  });

  const el = mdvEl("div", "mdv-timer");
  el.title = "Click to pause / resume (P). T = restart, + / − = one minute, S = settings.";
  const timeEl = mdvEl("div", "mdv-timer-time");
  const whoEl = mdvEl("div", "mdv-timer-who");
  const sub = mdvEl("div", "mdv-timer-sub");
  const labelEl = mdvEl("span", "mdv-timer-label");
  const dotsEl = mdvEl("span", "mdv-timer-dots");
  sub.append(labelEl, dotsEl);
  el.append(whoEl, timeEl, sub);
  el.addEventListener("click", (e) => { e.stopPropagation(); mdvTimerPause(); });
  parent.append(el);

  Object.assign(t, { el, timeEl, labelEl, dotsEl, whoEl });
  mdvAudio(); // wake up sound now, while we have a click
  mdvTimerLayout();
  clearInterval(t.interval);
  t.interval = setInterval(mdvTimerTick, 250);
  mdvTimerTick();
}

function mdvTimerStop() {
  const t = mdvTimer;
  clearInterval(t.interval);
  mdvAnnounceHide(true);
  Object.assign(t, { interval: null, running: false, el: null, root: null });
  mdvTimerPanelClose();
}

function mdvTimerLayout() {
  const { el, cfg, root } = mdvTimer;
  if (!el) return;
  el.dataset.size = cfg.size;
  el.dataset.pos = cfg.position;
  el.dataset.colors = cfg.colors ? "on" : "off";
  root.dataset.timerPos = cfg.position;
  root.dataset.timerSize = cfg.size;

  // One dot per bell that is turned on.
  mdvTimer.dotsEl.replaceChildren(...mdvBells(cfg).map((b, i) => {
    const dot = mdvEl("span", "mdv-timer-dot");
    dot.dataset.bell = i;
    dot.hidden = !b.on;
    dot.title = (i + 1) + "鈴 at " + mdvFmt(b.at);
    return dot;
  }));
  mdvTimerTick();
  if (typeof mdvFitSlide === "function") mdvFitSlide();
}

function mdvTimerElapsed() {
  const t = mdvTimer;
  return (t.before + (t.running ? Date.now() - t.startedAt : 0)) / 1000;
}

function mdvTimerTick() {
  const t = mdvTimer;
  if (!t.el) return;
  const cfg = t.cfg;
  const used = Math.floor(mdvTimerElapsed());
  const bells = mdvBells(cfg);

  // Ring any bell whose time has come.
  if (t.started) {
    bells.forEach((b, i) => {
      if (b.on && !t.rung[i] && used >= b.at) {
        t.rung[i] = true;
        mdvRing(i + 1);
        t.el.classList.remove("mdv-ring");
        t.root.classList.remove("mdv-edge");
        void t.el.offsetWidth;
        t.el.classList.add("mdv-ring");
        if (cfg.colors) {           // flash the screen edge too
          t.root.dataset.bell = i + 1;
          t.root.classList.add("mdv-edge");
        }
      }
    });
  }

  // "Next presenter" notice.
  if (t.started && cfg.announce.on && !t.announced && used >= mdvAnnounceAt(cfg)) {
    t.announced = true;
    if (!mdvIsLastPresenter()) mdvAnnounceShow();
  }
  if (t.announceEl) {
    const left = cfg.duration - used;
    t.announceEl.querySelector(".mdv-announce-time").textContent =
      left > 0 ? mdvFmt(left) + " left in this talk" : "";
  }

  // Color: 0 normal, 1 after 1鈴, 2 after 2鈴 or over time, 3 after 3鈴.
  let stage = 0;
  bells.forEach((b, i) => { if (b.on && used >= b.at) stage = Math.max(stage, i + 1); });
  if (cfg.mode === "down" && used > cfg.duration) stage = Math.max(stage, 2);
  t.el.dataset.stage = t.started ? stage : 0;
  t.el.dataset.paused = t.running || !t.started ? "no" : "yes";
  t.el.dataset.ready = t.started ? "no" : "yes";

  if (cfg.mode === "down") {
    const left = cfg.duration - used;
    t.timeEl.textContent = (left < 0 ? "+" : "") + mdvFmt(Math.abs(left));
    t.labelEl.textContent = !t.started ? "click to start"
      : !t.running ? "paused" : left < 0 ? "over time" : "left";
  } else {
    t.timeEl.textContent = mdvFmt(used);
    t.labelEl.textContent = !t.started ? "click to start"
      : !t.running ? "paused" : "of " + mdvFmt(cfg.duration);
  }
  const who = mdvCurrentName();
  t.whoEl.textContent = who;
  t.whoEl.hidden = !who;
  t.dotsEl.querySelectorAll(".mdv-timer-dot").forEach((d) =>
    d.classList.toggle("rung", t.rung[d.dataset.bell]));
}

function mdvTimerPause() {
  const t = mdvTimer;
  if (!t.started) {
    Object.assign(t, { started: true, running: true, startedAt: Date.now(), before: 0 });
  } else if (t.running) {
    t.before += Date.now() - t.startedAt;
    t.running = false;
  } else {
    t.startedAt = Date.now();
    t.running = true;
  }
  mdvAudio();
  mdvTimerTick();
}

function mdvTimerReset(waitForClick) {
  const go = waitForClick !== true;
  Object.assign(mdvTimer, {
    started: go, running: go, before: 0, startedAt: Date.now(), rung: [false, false, false],
    announced: false,
  });
  mdvAnnounceHide();
  mdvTimerTick();
}

// Change the talk length by some seconds (e.g. +60 / −60).
function mdvTimerAdjust(delta) {
  const cfg = mdvTimer.cfg;
  cfg.duration = Math.max(60, cfg.duration + delta);
  mdvTimerChanged(["duration"]);
}

// After times change, don't ring bells that are already past.
function mdvTimerResync() {
  const used = mdvTimerElapsed();
  mdvTimer.rung = mdvBells(mdvTimer.cfg).map((b) => mdvTimer.started && b.on && used >= b.at);
  mdvTimer.announced = mdvTimer.started && used >= mdvAnnounceAt(mdvTimer.cfg);
  mdvTimerLayout();
}

// ---------- sound (made in the browser, no sound files) ----------
function mdvAudio() {
  try {
    if (!mdvTimer.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      mdvTimer.ctx = new AC();
    }
    if (mdvTimer.ctx.state === "suspended") mdvTimer.ctx.resume();
    return mdvTimer.ctx;
  } catch (e) {
    return null;
  }
}

const MDV_SOUNDS = {
  // [frequency ratio, loudness, how long it rings (s)]
  bell:  { base: 1640, gap: 0.55, parts: [[1, 1, 2.6], [2.32, 0.45, 1.5], [4.25, 0.2, 0.8], [6.63, 0.08, 0.4]] },
  chime: { base: 880,  gap: 0.7,  parts: [[1, 1, 2.0], [2, 0.25, 1.2], [3, 0.08, 0.6]] },
  beep:  { base: 1000, gap: 0.3,  parts: [[1, 1, 0.22]] },
};

function mdvStrike(ctx, when, kind, volume) {
  const sound = MDV_SOUNDS[kind];
  if (!sound) return;
  const out = ctx.createGain();
  out.gain.value = volume * 0.6;
  out.connect(ctx.destination);
  sound.parts.forEach(([ratio, loud, length]) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = sound.base * ratio;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(loud, when + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(env);
    env.connect(out);
    osc.start(when);
    osc.stop(when + length + 0.05);
  });
}

function mdvRing(times, kind) {
  const cfg = mdvTimer.cfg;
  if (!cfg) return;
  kind = kind || cfg.sound;
  if (kind === "off") return;
  const ctx = mdvAudio();
  if (!ctx) return;
  const gap = MDV_SOUNDS[kind].gap;
  for (let i = 0; i < times; i++) {
    mdvStrike(ctx, ctx.currentTime + 0.05 + i * gap, kind, cfg.volume);
  }
}

// ---------- settings panel ----------
// Opens on the main page (Timer button) or while presenting.
function mdvTimerPanelToggle(container, inPresent) {
  if (mdvTimer.panel) { mdvTimerPanelClose(); return; }
  const panel = mdvBuildTimerPanel();
  if (inPresent) panel.classList.add("in-present");
  container.append(panel);
  mdvTimer.panel = panel;
}

function mdvTimerPanelClose() {
  if (mdvTimer.panel) mdvTimer.panel.remove();
  mdvTimer.panel = null;
  mdvTimer.panelRefresh = null;
}

function mdvBuildTimerPanel() {
  const t = mdvTimer;
  const cfg = t.cfg;
  const panel = mdvEl("div", "mdv-panel mdv-timer-panel");
  panel.addEventListener("click", (e) => e.stopPropagation());
  const refreshers = [];

  const choose = (field, options) => {
    const row = mdvSegments(options, (v) => { cfg[field] = v; mdvTimerChanged([field]); });
    refreshers.push(() => row.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.value) === String(cfg[field]))));
    return row;
  };
  const timeInput = (get, set, field) => {
    const input = mdvEl("input", "mdv-time-input");
    input.type = "text";
    input.addEventListener("change", () => {
      const s = mdvParseTime(input.value);
      if (s !== null) { set(s); mdvTimerChanged([field]); }
      else input.value = mdvFmt(get());
    });
    refreshers.push(() => { if (document.activeElement !== input) input.value = mdvFmt(get()); });
    return input;
  };
  const label = (text) => panel.append(mdvEl("p", "mdv-panel-label", text));

  // ---- Presenters ----
  label("Presenters (in order)");
  const lu = t.lineup;
  const namesBox = mdvEl("textarea", "mdv-text-input mdv-names");
  namesBox.rows = 4;
  namesBox.placeholder = "One name per line, in speaking order\n山田 太郎\n佐藤 花子\n…";
  namesBox.addEventListener("change", () => {
    lu.names = namesBox.value.split(/\n/).map((n) => n.trim()).filter(Boolean);
    lu.current = Math.min(lu.current, Math.max(0, lu.names.length - 1));
    mdvLineupChanged(false);
  });
  panel.append(namesBox);
  if (lu.fromFile) {
    panel.append(mdvEl("p", "mdv-panel-note",
      "This list comes from the file header (presenters:). Edits here work for now only."));
  }
  const nowRow = mdvEl("div", "mdv-field");
  const nowSelect = mdvEl("select", "mdv-text-input");
  nowSelect.addEventListener("change", () => mdvLineupGo(Number(nowSelect.value)));
  const nextBtn = mdvEl("button", "mdv-mini", "Next presenter ›");
  nextBtn.title = "Move to the next presenter and restart the clock ( ] key )";
  nextBtn.addEventListener("click", () => mdvLineupGo(lu.current + 1));
  nowRow.append(mdvEl("span", null, "Now"), nowSelect, nextBtn);
  panel.append(nowRow);
  const nextLine = mdvEl("p", "mdv-panel-hint");
  panel.append(nextLine);
  refreshers.push(() => {
    if (document.activeElement !== namesBox) namesBox.value = lu.names.join("\n");
    nowSelect.replaceChildren(...lu.names.map((n, i) => {
      const o = mdvEl("option", null, (i + 1) + ". " + n);
      o.value = i;
      return o;
    }));
    nowSelect.value = lu.current;
    nowRow.hidden = lu.names.length === 0;
    nextBtn.disabled = lu.current >= lu.names.length - 1;
    const nx = mdvNextName();
    nextLine.textContent = !lu.names.length
      ? "Add names to announce the next presenter automatically."
      : nx ? "The notice will announce: " + nx
      : "This is the last presenter — no notice will be shown.";
  });

  // ---- Talk length ----
  label("Talk length");
  if (t.fileKeys.size) {
    const keys = [...t.fileKeys].filter((k) => k !== "announce").map((k) =>
      ({ duration: "timer", warn: "warning", qa: "qa" }[k]));
    const an_keys = { next: "next", before: "announce", message: "announce-message", voiceMode: "announce-audio" };
    (t.fileAnnounce || new Set()).forEach((k) => { if (an_keys[k] && !keys.includes(an_keys[k])) keys.push(an_keys[k]); });
    panel.append(mdvEl("p", "mdv-panel-note",
      "This file's header sets " + keys.join(", ") +
      ". Changes here work now, but next time the header's value is used."));
  }
  const lengthRow = mdvEl("div", "mdv-length");
  const minus = mdvEl("button", "mdv-step", "−1");
  minus.title = "One minute less (− key)";
  minus.addEventListener("click", () => mdvTimerAdjust(-60));
  const plus = mdvEl("button", "mdv-step", "+1");
  plus.title = "One minute more (+ key)";
  plus.addEventListener("click", () => mdvTimerAdjust(60));
  const lengthInput = timeInput(() => cfg.duration, (s) => { cfg.duration = Math.max(1, s); }, "duration");
  lengthInput.classList.add("mdv-length-input");
  lengthRow.append(minus, lengthInput, plus);
  panel.append(lengthRow);

  const presets = mdvEl("div", "mdv-presets");
  [5, 7, 10, 12, 15, 20, 30].forEach((m) => {
    const b = mdvEl("button", null, m + " min");
    b.addEventListener("click", () => { cfg.duration = m * 60; mdvTimerChanged(["duration"]); });
    refreshers.push(() => b.setAttribute("aria-pressed", cfg.duration === m * 60));
    presets.append(b);
  });
  panel.append(presets);

  panel.append(choose("mode", [{ id: "down", name: "Show time left" }, { id: "up", name: "Show time used" }]));

  // ---- Bells ----
  label("Bells");
  const bellRow = (i, name, field, part, word) => {
    const row = mdvEl("div", "mdv-bell-row");
    const box = mdvEl("input");
    box.type = "checkbox";
    box.addEventListener("change", () => { cfg[field].on = box.checked; mdvTimerChanged([field]); });
    const text = mdvEl("div", "mdv-bell-text");
    const title = mdvEl("span", "mdv-bell-name", (i + 1) + "鈴 · " + name);
    const when = mdvEl("span", "mdv-bell-when");
    text.append(title, when);
    row.append(box, text);
    if (part) {
      row.append(timeInput(() => cfg[field][part], (s) => { cfg[field][part] = s; }, field));
    } else {
      row.append(mdvEl("span", "mdv-bell-fixed", "at end"));
    }
    const test = mdvEl("button", "mdv-mini", "▶");
    test.title = "Hear it";
    test.addEventListener("click", () => mdvRing(i + 1));
    row.append(test);
    refreshers.push(() => {
      box.checked = cfg[field].on;
      row.classList.toggle("off", !cfg[field].on);
      const at = mdvBells(cfg)[i].at;
      when.textContent = word + " → rings at " + mdvFmt(at);
    });
    panel.append(row);
  };
  bellRow(0, "Warning", "warn", "before", "Before end");
  bellRow(1, "Time up", "end", null, "End of talk");
  bellRow(2, "Q&A over", "qa", "after", "After end");

  // ---- Next presenter notice ----
  label("Next presenter notice");
  const an = cfg.announce;
  const anRow = mdvEl("div", "mdv-bell-row");
  const anBox = mdvEl("input");
  anBox.type = "checkbox";
  anBox.addEventListener("change", () => { an.on = anBox.checked; mdvTimerChanged(["announce"]); });
  const anText = mdvEl("div", "mdv-bell-text");
  const anWhen = mdvEl("span", "mdv-bell-when");
  anText.append(mdvEl("span", "mdv-bell-name", "Show notice"), anWhen);
  const anTime = timeInput(() => an.before, (s) => { an.before = s; }, "announce");
  const anTest = mdvEl("button", "mdv-mini", "▶");
  anTest.title = "Preview it (N key while presenting)";
  anTest.addEventListener("click", () => mdvAnnounceShow());
  anRow.append(anBox, anText, anTime, anTest);
  refreshers.push(() => {
    anBox.checked = an.on;
    anRow.classList.toggle("off", !an.on);
    anWhen.textContent = "Before end → shows at " + mdvFmt(mdvAnnounceAt(cfg));
  });
  panel.append(anRow);

  const textField = (title, multi, get, set, hint) => {
    const wrap = mdvEl("label", "mdv-text-field");
    wrap.append(mdvEl("span", null, title));
    const input = mdvEl(multi ? "textarea" : "input", "mdv-text-input");
    if (!multi) input.type = "text";
    if (multi) input.rows = 2;
    if (hint) input.placeholder = hint;
    input.addEventListener("change", () => { set(input.value); mdvTimerChanged(["announce"]); });
    refreshers.push(() => { if (document.activeElement !== input) input.value = get(); });
    wrap.append(input);
    panel.append(wrap);
  };
  textField("Message ({next} = name)", true, () => an.message, (v) => { an.message = v; },
    MDV_TIMER_DEFAULTS.announce.message);
  const showFor = mdvSegments(
    [{ id: 5, name: "5 s" }, { id: 10, name: "10 s" }, { id: 20, name: "20 s" }, { id: 0, name: "Until click" }],
    (v) => { an.seconds = v; mdvTimerChanged(["announce"]); });
  refreshers.push(() => showFor.querySelectorAll("button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.value) === String(an.seconds))));
  const showRow = mdvEl("div", "mdv-text-field");
  showRow.append(mdvEl("span", null, "Show for"));
  showRow.append(showFor);
  panel.append(showRow);

  // ---- Read aloud: the built-in recording or your own audio file ----
  const modeWrap = mdvEl("div", "mdv-text-field");
  modeWrap.append(mdvEl("span", null, "Read it aloud (after the chime)"));
  const modeRow = mdvSegments(
    [{ id: "off", name: "Off" }, { id: "builtin", name: "Built-in" }, { id: "file", name: "My file" }],
    (v) => { an.voiceMode = v; mdvTimerChanged(["announce"]); });
  modeWrap.append(modeRow);
  panel.append(modeWrap);

  // Built-in recording
  const builtinBox = mdvEl("div", "mdv-voice-box");
  const builtinWrap = mdvEl("div", "mdv-text-field");
  builtinWrap.append(mdvEl("span", null, "Voice"));
  const builtinRow = mdvSegments([{ id: "f", name: "Female" }, { id: "m", name: "Male" }],
    (v) => { an.builtinVoice = v; mdvTimerChanged(["announce"]); });
  builtinWrap.append(builtinRow);
  builtinBox.append(builtinWrap, mdvEl("p", "mdv-panel-hint",
    "Says: 「次の発表者の方は、準備をお願いします。」 (sounds/next-presenter-f.mp4 / -m.mp4). " +
    "To use your own recording instead, choose “My file”."));
  panel.append(builtinBox);

  // Audio file
  const fileBox = mdvEl("div", "mdv-voice-box");
  const fileLine = mdvEl("div", "mdv-file-line");
  const pick = mdvEl("label", "mdv-mini mdv-file-pick", "Choose audio file…");
  const fileInput = mdvEl("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*,video/mp4,.mp3,.m4a,.mp4,.wav,.ogg";
  fileInput.hidden = true;
  pick.append(fileInput);
  const fileName = mdvEl("span", "mdv-file-name");
  const removeBtn = mdvEl("button", "mdv-mini", "Remove");
  fileLine.append(pick, fileName, removeBtn);
  const fileHint = mdvEl("p", "mdv-panel-hint",
    "Record the message yourself (phone, Voice Recorder…) — .mp3 / .mp4 / .m4a / .wav all work (only the sound of an .mp4 is used). " +
    "For a different file per presenter, write  announce-audio: yamada.mp3  in the .md header " +
    "(the audio file must be in the same folder as the .md file).");
  fileBox.append(fileLine, fileHint);
  panel.append(fileBox);

  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { status.textContent = "✗ That file is too big (max 50 MB)."; return; }
    const reader = new FileReader();
    reader.onload = () => {
      t.audio = { name: f.name, size: f.size, data: reader.result };
      mdvSaveAudio(t.audio);
      an.voiceMode = "file";
      mdvTimerChanged(["announce"]);
      status.textContent = "✓ Saved “" + f.name + "”. Press ▶ Test to hear it.";
    };
    reader.readAsDataURL(f);
  });
  removeBtn.addEventListener("click", () => {
    t.audio = null;
    mdvSaveAudio(null);
    t.panelRefresh();
  });

  // Say it once / twice (both kinds) + test
  const repeatWrap = mdvEl("div", "mdv-text-field");
  repeatWrap.append(mdvEl("span", null, "Say it"));
  const repeat = mdvSegments(
    [{ id: 1, name: "Once" }, { id: 2, name: "Twice" }],
    (v) => { an.repeat = v; mdvTimerChanged(["announce"]); });
  repeatWrap.append(repeat);
  panel.append(repeatWrap);

  const testLine = mdvEl("div", "mdv-file-line");
  const testBtn = mdvEl("button", "mdv-mini", "▶ Test");
  testBtn.title = "Hear it now";
  const status = mdvEl("span", "mdv-voice-status");
  testBtn.addEventListener("click", async () => {
    status.textContent = "…";
    mdvAudioStop();
    status.textContent = await mdvSayAnnouncement(an, cfg.volume);
  });
  testLine.append(testBtn, status);
  panel.append(testLine);

  refreshers.push(() => {
    modeRow.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.value === an.voiceMode));
    builtinBox.hidden = an.voiceMode !== "builtin";
    builtinRow.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.value === (an.builtinVoice || "f")));
    fileBox.hidden = an.voiceMode !== "file";
    repeatWrap.hidden = testLine.hidden = an.voiceMode === "off";
    repeat.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.value) === String(an.repeat)));
    if (an.audioUrl) {
      fileName.textContent = "From the file header: " + decodeURIComponent(an.audioUrl.split("/").pop());
      removeBtn.hidden = true;
    } else if (t.audio) {
      fileName.textContent = t.audio.name + " · " + Math.max(1, Math.round(t.audio.size / 1024)) + " KB";
      removeBtn.hidden = false;
    } else {
      fileName.textContent = "No file yet";
      removeBtn.hidden = true;
    }
    if (!status.textContent && t.lastVoiceStatus) status.textContent = "Last time: " + t.lastVoiceStatus;
  });

  // ---- Start ----
  label("Start the clock");
  panel.append(choose("autostart", [{ id: true, name: "Right away" }, { id: false, name: "When I click it" }]));

  // ---- Sound ----
  label("Sound");
  panel.append(choose("sound", [
    { id: "bell", name: "Bell" }, { id: "chime", name: "Chime" },
    { id: "beep", name: "Beep" }, { id: "off", name: "Off" },
  ]));
  const volRow = mdvEl("div", "mdv-field");
  const vol = mdvEl("input", "mdv-range");
  Object.assign(vol, { type: "range", min: 0, max: 1, step: 0.05 });
  vol.addEventListener("change", () => { cfg.volume = Number(vol.value); mdvTimerChanged(["volume"]); mdvRing(1); });
  refreshers.push(() => { vol.value = cfg.volume; });
  volRow.append(mdvEl("span", null, "Volume"), vol);
  panel.append(volRow);

  // ---- Look ----
  label("Clock size");
  panel.append(choose("size", [
    { id: "s", name: "S" }, { id: "m", name: "M" }, { id: "l", name: "L" }, { id: "xl", name: "XL" },
  ]));
  label("Position");
  const pos = choose("position", [
    { id: "tl", name: "Top left" }, { id: "tr", name: "Top right" },
    { id: "bl", name: "Bottom left" }, { id: "br", name: "Bottom right" },
  ]);
  pos.classList.add("mdv-segments-grid");
  panel.append(pos);
  label("Warning colors");
  panel.append(choose("colors", [{ id: true, name: "On" }, { id: false, name: "Off" }]));

  // ---- Controls (only while presenting) ----
  if (t.el) {
    const controls = mdvEl("div", "mdv-timer-controls");
    const pauseBtn = mdvEl("button", "mdv-reset", "Start / Pause");
    pauseBtn.addEventListener("click", mdvTimerPause);
    const resetBtn = mdvEl("button", "mdv-reset", "Restart");
    resetBtn.addEventListener("click", mdvTimerReset);
    controls.append(pauseBtn, resetBtn);
    panel.append(controls);
  }
  panel.append(mdvEl("p", "mdv-panel-hint",
    "While presenting: P pause · T restart · + / − one minute · N notice · ] next presenter · [ previous · S this panel"));

  t.panelRefresh = () => refreshers.forEach((f) => f());
  t.panelRefresh();
  return panel;
}

// ---------- "Next presenter" notice ----------
function mdvAnnounceAt(cfg) {
  return Math.max(0, cfg.duration - cfg.announce.before);
}

function mdvAnnounceText(an) {
  const name = mdvNextName();
  let msg = (an.message || "").trim() || MDV_TIMER_DEFAULTS.announce.message;
  if (!name && msg.includes("{next}")) msg = "次の発表者の方は準備をお願いします。";
  return { name, msg: msg.split("{next}").join(name) };
}

function mdvAnnounceShow() {
  const t = mdvTimer;
  if (!t.cfg) return;
  mdvAnnounceHide(true);
  const { name, msg } = mdvAnnounceText(t.cfg.announce);

  const box = mdvEl("div", "mdv-announce");
  const card = mdvEl("div", "mdv-announce-card");
  card.append(mdvEl("div", "mdv-announce-label", name ? "Next presenter" : "Announcement"));
  if (name) card.append(mdvEl("div", "mdv-announce-name", name));
  card.append(mdvEl("div", "mdv-announce-msg", msg));
  card.append(mdvEl("div", "mdv-announce-time"));
  card.append(mdvEl("div", "mdv-announce-hint", "click to close"));
  box.append(card);
  box.addEventListener("click", (e) => { e.stopPropagation(); mdvAnnounceHide(); });

  // While presenting it sits on the slides; otherwise (preview) on the page.
  (t.root || document.body).append(box);
  t.announceEl = box;
  if (!t.root) box.classList.add("mdv-announce-preview");
  mdvTimerTick();

  // A soft chime so the room notices, then the message read aloud.
  let wait = 0;
  if (t.cfg.sound !== "off") {
    const ctx = mdvAudio();
    if (ctx) { mdvStrike(ctx, ctx.currentTime + 0.05, "chime", t.cfg.volume * 0.7); wait = 900; }
  }
  clearTimeout(t.speakTimer);
  if (t.cfg.announce.voiceMode !== "off") {
    t.speakTimer = setTimeout(async () => {
      t.lastVoiceStatus = await mdvSayAnnouncement(t.cfg.announce, t.cfg.volume);
    }, wait);
  }

  const secs = Number(t.cfg.announce.seconds) || 0;
  clearTimeout(t.announceTimer);
  // Hiding by itself lets the voice finish its sentence.
  if (secs > 0) t.announceTimer = setTimeout(() => mdvAnnounceHide(false, true), secs * 1000);
}

function mdvAnnounceHide(now, keepVoice) {
  const t = mdvTimer;
  clearTimeout(t.announceTimer);
  if (!keepVoice) {
    clearTimeout(t.speakTimer);
    mdvAudioStop();
  }
  const box = t.announceEl;
  if (!box) return;
  t.announceEl = null;
  if (now) { box.remove(); return; }
  box.classList.add("leaving");
  setTimeout(() => box.remove(), 350);
}

function mdvAnnounceToggle() {
  if (mdvTimer.announceEl) mdvAnnounceHide();
  else mdvAnnounceShow();
}

// ---------- playing the notice sound ----------
// Play your own audio file (from the header, or the one saved in settings).
function mdvPlayAnnounceAudio(an, volume, builtin) {
  const src = builtin || an.audioUrl || (mdvTimer.audio && mdvTimer.audio.data);
  if (!src) return Promise.resolve("✗ No audio file chosen yet.");
  mdvAudioStop();
  const player = new Audio(src);
  player.volume = Math.max(0, Math.min(1, volume));
  let left = Math.max(1, Number(an.repeat) || 1) - 1;
  player.addEventListener("ended", () => {
    if (left-- > 0) setTimeout(() => { if (mdvTimer.player === player) player.play().catch(() => {}); }, 600);
  });
  mdvTimer.player = player;
  const label = builtin ? "the built-in voice"
    : an.audioUrl ? decodeURIComponent(an.audioUrl.split("/").pop()) : mdvTimer.audio.name;
  return player.play()
    .then(() => "✓ Playing " + label + ".")
    .catch((e) => "✗ Could not play the audio file (" + (e.name || "error") + ")." +
      (/\.mp4|\.m4a|video\/mp4|audio\/mp4/i.test(String(src).slice(0, 80)) || /\.(mp4|m4a)$/i.test(label)
        ? " If an .mp4 won't play, convert it: ffmpeg -i file.mp4 -vn file.mp3" : ""));
}

function mdvAudioStop() {
  if (mdvTimer.player) {
    try { mdvTimer.player.pause(); } catch (e) { /* already stopped */ }
    mdvTimer.player = null;
  }
}

// Say the notice the chosen way.
// The recordings that come with the extension (sounds/ folder).
function mdvSoundUrl(path) {
  try {
    if (typeof browser !== "undefined" && browser.runtime && browser.runtime.getURL) {
      return browser.runtime.getURL(path);
    }
  } catch (e) { /* not running as an extension */ }
  return path;
}

function mdvSayAnnouncement(an, volume) {
  if (an.voiceMode === "builtin") {
    const v = an.builtinVoice === "m" ? "m" : "f";
    return mdvPlayAnnounceAudio(an, volume, mdvSoundUrl("sounds/next-presenter-" + v + ".mp4"));
  }
  if (an.voiceMode === "file") return mdvPlayAnnounceAudio(an, volume);
  return Promise.resolve("");
}


// ---------- presenter list ----------
function mdvSameName(a, b) {
  const norm = (x) => String(x).normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return norm(a) === norm(b);
}

function mdvCurrentName() {
  const lu = mdvTimer.lineup;
  return lu && lu.names.length ? lu.names[lu.current] || "" : "";
}

// The name the notice announces: the header's "next:", else the next one in the list.
function mdvNextName() {
  const t = mdvTimer;
  if (t.fileAnnounce && t.fileAnnounce.has("next")) return (t.cfg.announce.next || "").trim();
  const lu = t.lineup;
  return lu && lu.names[lu.current + 1] ? lu.names[lu.current + 1] : "";
}

function mdvIsLastPresenter() {
  const t = mdvTimer;
  if (t.fileAnnounce && t.fileAnnounce.has("next")) return false;
  const lu = t.lineup;
  return !!(lu && lu.names.length && lu.current >= lu.names.length - 1);
}

// Save the list (unless it came from the file header) and update the screen.
function mdvLineupChanged(restart) {
  const t = mdvTimer;
  if (!t.lineup.fromFile) {
    t.settings.lineup = { names: t.lineup.names, current: t.lineup.current };
    mdvSaveSettings(t.settings);
  }
  if (restart && t.el) mdvTimerReset(!t.cfg.autostart);
  mdvTimerTick();
  if (t.panelRefresh) t.panelRefresh();
}

// Switch to presenter number i and restart the clock for their talk.
function mdvLineupGo(i) {
  const lu = mdvTimer.lineup;
  if (!lu.names.length) return;
  const to = Math.max(0, Math.min(lu.names.length - 1, i));
  if (to === lu.current) return;
  lu.current = to;
  mdvAnnounceHide();
  mdvLineupChanged(true);
}
