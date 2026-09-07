const RING_CIRCUMFERENCE = 2 * Math.PI * 100;
const SETTINGS_KEY = "focusSprint.settings";
const STATS_KEY = "focusSprint.stats";
const THEME_KEY = "focusSprint.theme";

const MODE_LABELS = { work: "Lavoro", short: "Pausa breve", long: "Pausa lunga" };

const defaultSettings = { work: 25, short: 5, long: 15 };

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

const state = {
  settings: loadSettings(),
  stats: loadStats(),
  mode: "work",
  cycleCount: 1,
  remaining: 0,
  running: false,
  timerId: null,
  soundOn: false,
};

const el = {
  timeDisplay: document.getElementById("timeDisplay"),
  cycleLabel: document.getElementById("cycleLabel"),
  ringProgress: document.getElementById("ringProgress"),
  startPauseBtn: document.getElementById("startPauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  soundBtn: document.getElementById("soundBtn"),
  themeToggle: document.getElementById("themeToggle"),
  modeTabs: document.getElementById("modeTabs"),
  statToday: document.getElementById("statToday"),
  statMinutes: document.getElementById("statMinutes"),
  statStreak: document.getElementById("statStreak"),
  weekChart: document.getElementById("weekChart"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsCard: document.getElementById("settingsCard"),
  workInput: document.getElementById("workInput"),
  shortInput: document.getElementById("shortInput"),
  longInput: document.getElementById("longInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
};

el.ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

function modeDurationSeconds(mode) {
  return state.settings[mode] * 60;
}

function setMode(mode, resetRemaining = true) {
  state.mode = mode;
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  if (resetRemaining) state.remaining = modeDurationSeconds(mode);
  el.cycleLabel.textContent = mode === "work"
    ? `Ciclo ${state.cycleCount} di 4`
    : MODE_LABELS[mode];
  render();
}

function render() {
  const total = modeDurationSeconds(state.mode);
  const mins = String(Math.floor(state.remaining / 60)).padStart(2, "0");
  const secs = String(state.remaining % 60).padStart(2, "0");
  el.timeDisplay.textContent = `${mins}:${secs}`;
  const progress = total > 0 ? state.remaining / total : 0;
  el.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
  el.startPauseBtn.textContent = state.running ? "Pausa" : (state.remaining < total ? "Riprendi" : "Avvia");
  document.title = state.running ? `${mins}:${secs} · ${MODE_LABELS[state.mode]}` : "Focus Sprint";
}

function tick() {
  state.remaining -= 1;
  if (state.remaining <= 0) {
    completeSession();
    return;
  }
  render();
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    osc.onended = () => ctx.close();
  } catch {}
}

function recordCompletedWorkSession() {
  const key = todayKey();
  const day = state.stats[key] || { sessions: 0, minutes: 0 };
  day.sessions += 1;
  day.minutes += state.settings.work;
  state.stats[key] = day;
  saveStats(state.stats);
  refreshStats();
}

function completeSession() {
  clearInterval(state.timerId);
  state.timerId = null;
  state.running = false;
  beep();

  if (state.mode === "work") {
    recordCompletedWorkSession();
    if (state.cycleCount >= 4) {
      state.cycleCount = 1;
      setMode("long");
    } else {
      state.cycleCount += 1;
      setMode("short");
    }
  } else {
    setMode("work");
  }
  render();
}

function startPause() {
  if (state.running) {
    state.running = false;
    clearInterval(state.timerId);
    state.timerId = null;
    render();
    return;
  }
  if (state.remaining <= 0) state.remaining = modeDurationSeconds(state.mode);
  state.running = true;
  state.timerId = setInterval(tick, 1000);
  render();
}

function resetTimer() {
  state.running = false;
  clearInterval(state.timerId);
  state.timerId = null;
  state.remaining = modeDurationSeconds(state.mode);
  render();
}

function refreshStats() {
  const today = state.stats[todayKey()] || { sessions: 0, minutes: 0 };
  el.statToday.textContent = today.sessions;
  el.statMinutes.textContent = today.minutes;

  let streak = 0;
  for (let i = 0; ; i++) {
    const day = state.stats[todayKey(i)];
    if (day && day.sessions > 0) streak++;
    else break;
  }
  el.statStreak.textContent = streak;

  el.weekChart.innerHTML = "";
  const dayLabels = ["D", "L", "M", "M", "G", "V", "S"];
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(i);
  const maxSessions = Math.max(1, ...days.map((i) => (state.stats[todayKey(i)]?.sessions || 0)));

  days.forEach((i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const sessions = state.stats[todayKey(i)]?.sessions || 0;
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    const fill = document.createElement("div");
    fill.className = "chart-bar-fill" + (sessions > 0 ? " filled" : "");
    const heightPct = sessions > 0 ? Math.max(12, (sessions / maxSessions) * 100) : 6;
    fill.style.height = `${heightPct}%`;
    const label = document.createElement("span");
    label.className = "chart-bar-day";
    label.textContent = dayLabels[d.getDay()];
    bar.appendChild(fill);
    bar.appendChild(label);
    el.weekChart.appendChild(bar);
  });
}

let ambientCtx = null;
let ambientNodes = null;

function makePinkNoiseBuffer(ctx) {
  const bufferSize = 4 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = pink * 0.11;
  }
  return buffer;
}

function startAmbientSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  const noise = ctx.createBufferSource();
  noise.buffer = makePinkNoiseBuffer(ctx);
  noise.loop = true;

  // gentle lowpass wash, like waves rolling onto sand
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  filter.Q.value = 0.5;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.09;

  // slow LFO breathes the filter open/closed
  const filterLfo = ctx.createOscillator();
  filterLfo.type = "sine";
  filterLfo.frequency.value = 0.06;
  const filterLfoDepth = ctx.createGain();
  filterLfoDepth.gain.value = 220;
  filterLfo.connect(filterLfoDepth).connect(filter.frequency);

  // slightly offset LFO swells the volume like a wave washing in
  const swellLfo = ctx.createOscillator();
  swellLfo.type = "sine";
  swellLfo.frequency.value = 0.045;
  const swellLfoDepth = ctx.createGain();
  swellLfoDepth.gain.value = 0.045;
  swellLfo.connect(swellLfoDepth).connect(masterGain.gain);

  noise.connect(filter).connect(masterGain).connect(ctx.destination);
  noise.start();
  filterLfo.start();
  swellLfo.start();

  ambientCtx = ctx;
  ambientNodes = { noise, filterLfo, swellLfo };
}

function stopAmbientSound() {
  if (!ambientCtx) return;
  ambientNodes.noise.stop();
  ambientNodes.filterLfo.stop();
  ambientNodes.swellLfo.stop();
  ambientCtx.close();
  ambientCtx = null;
  ambientNodes = null;
}

function toggleAmbientSound() {
  state.soundOn = !state.soundOn;
  el.soundBtn.classList.toggle("active", state.soundOn);
  el.soundBtn.textContent = state.soundOn ? "🔊" : "🔈";

  if (state.soundOn) startAmbientSound();
  else stopAmbientSound();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  el.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

function initTheme() {
  let theme;
  try { theme = localStorage.getItem(THEME_KEY); } catch {}
  if (!theme) theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(theme);
}

function initSettingsForm() {
  el.workInput.value = state.settings.work;
  el.shortInput.value = state.settings.short;
  el.longInput.value = state.settings.long;
}

el.startPauseBtn.addEventListener("click", startPause);
el.resetBtn.addEventListener("click", resetTimer);
el.soundBtn.addEventListener("click", toggleAmbientSound);

el.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

el.modeTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-tab");
  if (!btn) return;
  state.running = false;
  clearInterval(state.timerId);
  state.timerId = null;
  setMode(btn.dataset.mode);
});

el.settingsToggle.addEventListener("click", () => {
  el.settingsCard.hidden = !el.settingsCard.hidden;
});

el.saveSettingsBtn.addEventListener("click", () => {
  const work = Math.min(120, Math.max(1, parseInt(el.workInput.value, 10) || defaultSettings.work));
  const short = Math.min(60, Math.max(1, parseInt(el.shortInput.value, 10) || defaultSettings.short));
  const long = Math.min(90, Math.max(1, parseInt(el.longInput.value, 10) || defaultSettings.long));
  state.settings = { work, short, long };
  saveSettings(state.settings);
  el.settingsCard.hidden = true;
  if (!state.running) resetTimer();
});

initTheme();
initSettingsForm();
setMode("work");
refreshStats();
