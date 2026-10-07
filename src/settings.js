// Your style choices, and remembering them between visits.

const MDV_DEFAULTS = { theme: "auto", font: "sans", size: 17, width: "normal", numbers: "off" };

// Presentation timer (see timer.js). Times are in seconds.
// Bells follow the usual conference style and move with the talk length:
//   1鈴 = warning, some time before the end
//   2鈴 = time is up (end of talk)
//   3鈴 = Q&A over, some time after the end
const MDV_TIMER_DEFAULTS = {
  mode: "down",                    // "down" = time left, "up" = time used
  duration: 420,                   // talk length: 7:00
  warn: { on: true, before: 120 }, // 1鈴 2:00 before the end (5:00 for a 7-minute talk)
  end: { on: true },               // 2鈴 at the end
  qa: { on: true, after: 300 },    // 3鈴 5:00 after the end (Q&A time)
  autostart: true,                 // false = wait until the clock is clicked
  sound: "bell",                   // bell | chime | beep | off
  volume: 0.7,
  size: "l",                       // s | m | l | xl
  position: "tr",                  // tr = top right, tl, br, bl
  colors: true,                    // turn amber / red as the bells ring
  // "Next presenter" notice in the middle of the slide, near the end of the talk.
  announce: {
    on: true,
    before: 180,                   // show 3:00 before the end
    next: "",                      // next presenter's name
    message: "次の発表者は {next} さんです。準備をお願いします。",
    seconds: 10,                   // hide after 10 s (0 = stay until clicked)
    voiceMode: "builtin",          // after the chime: "off" | "builtin" (sounds/*.mp4) | "file" (your file)
    builtinVoice: "f",             // built-in recording: "f" female / "m" male
    repeat: 1,                     // say it (or play the file) once or twice
  },
};

// Shown as color dots in the Style panel. The real colors live in viewer.css.
const MDV_THEMES = [
  { id: "auto",     name: "Auto",     bg: "linear-gradient(135deg,#ffffff 50%,#0d1117 50%)", dot: "#4493f8" },
  { id: "journal",  name: "Journal",  bg: "#fdfdfb", dot: "#8b1a1a" },
  { id: "paper",    name: "Paper",    bg: "#ffffff", dot: "#0969da" },
  { id: "midnight", name: "Midnight", bg: "#0d1117", dot: "#58a6ff" },
  { id: "slate",    name: "Slate",    bg: "#1e2329", dot: "#f0b429" },
  { id: "sepia",    name: "Sepia",    bg: "#f4ecd8", dot: "#a0522d" },
  { id: "navy",     name: "Navy",     bg: "#ffffff", dot: "#004098" },
  // Kwansei Gakuin colors from its public VI guidelines: KG Blue #1E3C91, KG Yellow #FFF000.
  // (Not affiliated with or endorsed by the university.)
  { id: "kg",       name: "KG",       bg: "#ffffff", dot: "#1E3C91" },
];

const MDV_FONTS = [
  { id: "sans",  name: "Clean" },
  { id: "mono",  name: "Code" },
];

const MDV_NUMBERS = [
  { id: "off", name: "Plain" },
  { id: "on",  name: "Numbered 1.1" },
];

const MDV_WIDTHS = [
  { id: "narrow", name: "Narrow" },
  { id: "normal", name: "Normal" },
  { id: "wide",   name: "Wide" },
];

function mdvHasStorage() {
  return typeof browser !== "undefined" && browser.storage && browser.storage.local;
}

function mdvTimerDefaults() {
  return JSON.parse(JSON.stringify(MDV_TIMER_DEFAULTS));
}

// Fill in anything missing and drop values that no longer exist.
// (When a future version renames or removes an option, convert the old
//  saved value here so people's settings keep working.)
function mdvCleanSettings(saved) {
  const s = { ...MDV_DEFAULTS, ...(saved || {}) };
  if (!MDV_THEMES.some((t) => t.id === s.theme)) s.theme = "auto";
  if (!MDV_FONTS.some((f) => f.id === s.font)) s.font = "sans";

  const saved_t = s.timer || {};
  const t = { ...mdvTimerDefaults(), ...saved_t };
  t.announce = { ...mdvTimerDefaults().announce, ...(saved_t.announce || {}) };
  delete t.announce.audioUrl;   // comes from a file header, never saved
  s.timer = t;

  // Presenter list: names in speaking order, and who is presenting now.
  const lu = s.lineup || {};
  s.lineup = {
    names: Array.isArray(lu.names) ? lu.names.map(String).filter(Boolean) : [],
    current: Number(lu.current) || 0,
  };
  return s;
}

async function mdvLoadSettings() {
  try {
    if (mdvHasStorage()) {
      const saved = await browser.storage.local.get("mdvSettings");
      return mdvCleanSettings(saved.mdvSettings);
    }
    return mdvCleanSettings(JSON.parse(localStorage.getItem("mdvSettings") || "{}"));
  } catch (e) {
    return mdvCleanSettings({});
  }
}

function mdvSaveSettings(settings) {
  try {
    if (mdvHasStorage()) browser.storage.local.set({ mdvSettings: settings });
    else localStorage.setItem("mdvSettings", JSON.stringify(settings));
  } catch (e) {
    // Not saved, but the page still works.
  }
}

function mdvApplySettings(settings) {
  const b = document.body;
  b.dataset.theme = settings.theme;
  b.dataset.font = settings.font;
  b.dataset.width = settings.width;
  b.dataset.numbers = settings.numbers;
  b.style.setProperty("--size", settings.size + "px");
}

// Your own announcement recording, kept apart from the other settings (it can be big).
async function mdvLoadAudio() {
  try {
    if (mdvHasStorage()) {
      const saved = await browser.storage.local.get("mdvAnnounceAudio");
      return saved.mdvAnnounceAudio || null;
    }
    return JSON.parse(localStorage.getItem("mdvAnnounceAudio") || "null");
  } catch (e) {
    return null;
  }
}

function mdvSaveAudio(audio) {
  try {
    if (mdvHasStorage()) {
      if (audio) browser.storage.local.set({ mdvAnnounceAudio: audio });
      else browser.storage.local.remove("mdvAnnounceAudio");
    } else if (audio) {
      localStorage.setItem("mdvAnnounceAudio", JSON.stringify(audio));
    } else {
      localStorage.removeItem("mdvAnnounceAudio");
    }
  } catch (e) {
    // Not saved, but it still plays this time.
  }
}
