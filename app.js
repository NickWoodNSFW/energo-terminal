"use strict";
/* Энерго-Терминал v3 — модель, состояние, интерфейс. */
(function () {

  // ─────────────────────────────── утилиты ───────────────────────────────
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const nowISO = () => new Date().toISOString();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  const fmtClock = (ms) => new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const fmtHm = (ms) => {
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 60) return min + " мин";
    return Math.floor(min / 60) + " ч " + String(min % 60).padStart(2, "0") + " мин";
  };
  const clockBig = (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    const cell = (str, cls) => str.split("").map((c) =>
      "<i" + (cls ? ' class="' + cls + '"' : "") + ">" + c + "</i>").join("");
    return cell(String(Math.floor(t / 3600)).padStart(2, "0")) +
      "<s>:</s>" + cell(String(Math.floor(t / 60) % 60).padStart(2, "0")) +
      "<s>:</s>" + cell(String(t % 60).padStart(2, "0"), "sec");
  };
  const hhmm = (ms) => { const m = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const toMin = (t) => { const p = String(t || "0:0").split(":"); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const round2 = (v) => Math.round(v * 100) / 100;
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const ICONS = {
    bolt: '<path d="M13 2 5 13h5l-1 9 8-11h-5l1-9z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6l-7-3z"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-13 0 9-5 14-13 14"/><path d="M5 19c3-4 6-6 10-7"/>',
    down: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    pencil: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="m14 6 4 4"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>'
  };
  function icon(name, size) {
    const s = size || 16;
    return '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }
  const BUILD = "et-v63";

  const STATS = { ram_clarity: "Оперативка", start_initiative: "Старт", focus_hold: "Фокус", evening_resource: "Ресурс" };
  const DEBUFFS = { morning_scroll: "Утренний захват", unstructured_avoid: "Непереносимость пустого времени", news_reflex: "Новостной рефлекс", task_paralysis: "Паралич перед стартом" };
  const TAGS = ["Ремонт", "Аврал", "Недосып", "Отпуск", "Болезнь", "Высокий фоновый шум", "Много встреч"];
  const TABS = [["home", "Состояние"], ["capture", "Захват"], ["checkpoint", "Чекпоинт"], ["stats", "Статистика"], ["mirror", "Зеркало"]];

  // ─────────────────────────────── состояние ───────────────────────────────
  const KEY = "et_state_v3";
  const LEGACY = ["et_state_v2"];
  const BACKUP_KEY = "et_state_backup";

  function fresh() {
    return {
      meta: { schema_version: "3.1", app: "Энерго-Терминал", device_id: uuid(), created_at: nowISO() },
      config: {
        checkpoint_interval_days: 14, legit_window_limit: 2, legit_window_min: 45, scout_min: 5,
        drain_coef: 0.06, stab_coef: 0.05, entry_cost: 0.6, residue_min: 20, merge_gap_min: 10,
        recovery_min: 30, max_gap_h: 6,
        night_recharge: 3.0, micro_pause: 1.5, micro_pause_limit: 3, work_weight: 8,
        sleep_from: "23:00", sleep_to: "07:00", sleep_target: 7.5, sleep_drain_k: 0.5,
        window_rate: 0.15, debt_floor: -20, session_soft_min: 30, session_mult: 1.5
      },
      checkpoints: [], checks: [], quests: [], captures: [], sessions: [], interruptions: [],
      sync: { clientId: "", token: "", lastSync: null, lastDevice: null, auto: true, lastError: null, mode: "gist", cmtSeen: -1, ghToken: "", gistId: "" },
      slots: [
        { id: uuid(), updated_at: nowISO(), kind: "drain", mode: "capture", title: "Новостные проверки", trigger: "в течение дня", weight: 8, context: "any", active: true, replaces: null },
        { id: uuid(), updated_at: nowISO(), kind: "drain", mode: "capture", title: "Рилсы в паузах", trigger: "пауза в течение дня", weight: 7, context: "any", active: true, replaces: null },
        { id: uuid(), updated_at: nowISO(), kind: "drain", mode: "ambient", title: "Голосовой YouTube фоном", trigger: "приехал на работу", weight: 7, context: "any", active: true, replaces: null },
        { id: uuid(), updated_at: nowISO(), kind: "stab", mode: null, title: "Знакомая аудиокнига", trigger: "приехал на квартиру", weight: 6, context: "mechanical", active: true, replaces: null },
        { id: uuid(), updated_at: nowISO(), kind: "stab", mode: null, title: "Вечернее легитимное окно", trigger: "вечер", weight: 5, context: "any", active: true, replaces: null },
        { id: uuid(), updated_at: nowISO(), kind: "stab", mode: null, title: "Пустой слот", trigger: "своё", weight: 0, context: "any", active: false, replaces: null }
      ],
      runtime: {
        base: null, battery: null, battery_at: nowISO(), cp_at: null, status: "active", updated_at: nowISO(),
        window_end: null, window_start: null, window_day: null, window_count: 0,
        scout_end: null, scout_start: null, scout_pending: null,
        focus_start: null, last_work_end: null, emergency: false,
        work: { active: false, started_at: null, weight: 8, updated_at: null },
        pause_day: null, pause_count: 0, sleep_override: null, sleep_last: null, morning: null,
        drain_start: null, drain_slot: null, pending_entry: false, merged: false,
        residue_until: null, recovery_until: null, last_entry_at: null, hook_log: [],
        slot_on: {}, warned: {}, samples: [], days: {}, _sig: ""
      }
    };
  }

  function migrate(p) {
    const d = fresh();
    if (!p || typeof p !== "object" || !p.meta) return d;
    p.config = Object.assign(d.config, p.config || {});
    p.runtime = Object.assign(d.runtime, p.runtime || {});
    p.sync = Object.assign(d.sync, p.sync || {});
    p.runtime.work = Object.assign({ active: false, started_at: null, weight: 8 }, p.runtime.work || {});
    for (const k of ["checkpoints", "checks", "quests", "captures", "sessions", "interruptions", "slots"]) {
      p[k] = Array.isArray(p[k]) ? p[k] : [];
      p[k] = p[k].filter((r) => r && typeof r === "object").map((r) =>
        Object.assign({ updated_at: r.updated_at || r.date || r.started_at || r.declared_at || r.created_at || nowISO() }, r));
    }
    p.config.drain_coef = 0.06;
    p.config.entry_cost = 0.6;
    for (const s of p.slots) {
      if (s.title === "Утренние новости") { s.title = "Новостные проверки"; s.trigger = "в течение дня"; }
      if (s.kind === "drain" && !s.mode) s.mode = s.title === "Голосовой YouTube фоном" ? "ambient" : "capture";
      if (!s.updated_at) s.updated_at = nowISO();
    }
    const cap = Date.now() + p.config.residue_min * 60000;
    if (p.runtime.residue_until && p.runtime.residue_until > cap) p.runtime.residue_until = cap;
    const rcap = Date.now() + (Number(p.config.recovery_min) || 0) * 60000;
    if (p.runtime.recovery_until && p.runtime.recovery_until > rcap) p.runtime.recovery_until = rcap;
    return p;
  }

  let S = null;
  let restoredFromLegacy = false;
  const readErrors = [];
  let writesBlocked = 0;
  let persistedFlag = null;

  function countRecords(s) {
    if (!s) return 0;
    return (s.checkpoints || []).length + (s.checks || []).length + (s.captures || []).length + (s.sessions || []).length +
      (s.quests || []).length + (s.interruptions || []).length;
  }
  function hasData(s) {
    if (!s) return false;
    return countRecords(s) > 0 || !!(s.runtime && s.runtime.base != null);
  }
  function storedHasData() {
    for (const k of [KEY, BACKUP_KEY].concat(LEGACY)) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        if (hasData(JSON.parse(raw))) return true;
      } catch (e) { /* ключ битый — считаем пустым */ }
    }
    return false;
  }

  function readKey(k) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (e) {
      readErrors.push(k + ": " + (e && e.message ? e.message : "не читается"));
      console.warn("битый ключ " + k, e);
      return null;
    }
  }

  function initialState() {
    const states = [];
    for (const k of [KEY].concat(LEGACY)) {
      const st = readKey(k);
      if (st) states.push({ key: k, state: st });
    }
    const backup = readKey(BACKUP_KEY);
    if (backup) states.push({ key: BACKUP_KEY, state: backup });

    const hasRecords = (s) => !!(s && (s.checkpoints.length + s.captures.length + s.sessions.length > 0));
    const withData = states.filter((x) => hasRecords(x.state));
    if (!withData.length) return states.length ? states[0].state : fresh();
    if (withData.length === 1) {
      restoredFromLegacy = withData[0].key !== KEY && withData[0].state.checkpoints.length > 0;
      return withData[0].state;
    }
    restoredFromLegacy = true;
    return withData.slice(1).reduce((acc, x) => mergeStates(acc, x.state), withData[0].state);
  }

  function runtimeSignature(r) {
    if (!r) return "";
    const c = {};
    for (const k of Object.keys(r).sort()) {
      if (k === "updated_at" || k === "battery" || k === "battery_at" || k === "samples" || k === "_sig") continue;
      c[k] = r[k];
    }
    return JSON.stringify(c);
  }

  function save(opts) {
    try {
      if (!hasData(S) && storedHasData()) {
        writesBlocked++;
        console.warn("защита: пустое состояние не перезаписывает сохранённые данные");
        if (!opts || opts.sync !== false) scheduleSync();
        return;
      }
      // Время правки состояния поднимается только при настоящем изменении:
      // иначе обе стороны всегда «свежее» и затирают друг друга целиком.
      if (S.runtime) {
        const sig = runtimeSignature(S.runtime);
        if (sig !== S.runtime._sig) { S.runtime._sig = sig; S.runtime.updated_at = nowISO(); }
      }
      localStorage.setItem(KEY, JSON.stringify(S));
      if (S.checkpoints.length > 0) localStorage.setItem(BACKUP_KEY, JSON.stringify(S));
    } catch (e) { toast("Не удалось сохранить: хранилище заполнено"); }
    if (!opts || opts.sync !== false) scheduleSync();
  }

  // ─────────────────────────────── модель ───────────────────────────────
  function sleepWindowHours() { return sleepHours(S.config.sleep_from, S.config.sleep_to); }

  function sleepHours(from, toTime) {
    const a = toMin(from), b = toMin(toTime);
    if (!isFinite(a) || !isFinite(b) || a === b) return 0;
    const d = b > a ? b - a : 1440 - a + b;
    return Math.round((d / 60) * 100) / 100;
  }
  function fmtDur(h) {
    const m = Math.max(0, Math.round((Number(h) || 0) * 60));
    return Math.floor(m / 60) + " ч " + String(m % 60).padStart(2, "0") + " мин";
  }
  function nextOccurrence(timeStr, afterTs) {
    const a = toMin(timeStr);
    const d = new Date(afterTs);
    d.setHours(Math.floor(a / 60), a % 60, 0, 0);
    if (d.getTime() <= afterTs) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function isNightAt(ts) {
    const d = new Date(ts == null ? Date.now() : ts), cur = d.getHours() * 60 + d.getMinutes();
    const a = toMin(S.config.sleep_from), b = toMin(S.config.sleep_to);
    return a <= b ? (cur >= a && cur < b) : (cur >= a || cur < b);
  }
  function isNight() { return isNightAt(Date.now()); }
  function sleepRef() {
    const o = S.runtime.sleep_last;
    if (!o || !o.from || !o.to) return null;
    const at = Date.parse(o.at);
    if (!isFinite(at)) return null;
    const limit = Math.min(nextOccurrence(S.config.sleep_from, at + 8 * 3600e3), at + 30 * 3600e3);
    return Date.now() <= limit ? o : null;
  }
  function lastNightHours() {
    const o = sleepRef();
    if (o) return sleepHours(o.from, o.to);
    return sleepWindowHours();
  }
  function sleepFactorFrom(h, target) {
    const t = Number(target) || 7.5;
    if (!(h > 0)) return 0;
    if (h >= t) return clamp(1 - Math.max(0, h - t - 1) * 0.05, 0.9, 1);
    return clamp(h / t, 0, 1);
  }
  function sleepFactor() { return sleepFactorFrom(lastNightHours(), S.config.sleep_target); }

  function drainMult() { return 1 + (1 - sleepFactor()) * Number(S.config.sleep_drain_k || 0.5); }
  function workActive() { return !!(S.runtime.work && S.runtime.work.active); }
  function residueEnd() {
    const a = Number(S.runtime.residue_until) || 0;
    const b = Number(S.runtime.recovery_until) || 0;
    return Math.max(a, b);
  }
  function isResidue() { return Date.now() < residueEnd(); }
  function isRecovery() {
    return (Number(S.runtime.recovery_until) || 0) >= residueEnd() && isResidue();
  }

  const CIRCADIAN = [[0, 0.10], [4, 0.15], [6, 0.35], [8, 0.75], [10, 0.95], [12, 0.80],
    [14, 0.60], [16, 0.72], [18, 0.76], [20, 0.64], [22, 0.40], [24, 0.10]];

  function circadianAt(ts) {
    const d = new Date(ts), h = d.getHours() + d.getMinutes() / 60;
    const n = CIRCADIAN.length;
    for (let i = 1; i < n; i++) {
      if (h <= CIRCADIAN[i][0]) {
        const p0 = CIRCADIAN[Math.max(0, i - 2)], p1 = CIRCADIAN[i - 1];
        const p2 = CIRCADIAN[i], p3 = CIRCADIAN[Math.min(n - 1, i + 1)];
        const span = (p2[0] - p1[0]) || 1;
        const t = (h - p1[0]) / span;
        const m1 = ((p2[1] - p0[1]) / ((p2[0] - p0[0]) || 1)) * span;
        const m2 = ((p3[1] - p1[1]) / ((p3[0] - p1[0]) || 1)) * span;
        const t2 = t * t, t3 = t2 * t;
        const v = (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 +
          (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
        return clamp(v, 0, 1);
      }
    }
    return CIRCADIAN[n - 1][1];
  }

  function wakeAt(ts) {
    const to = toMin(S.config.sleep_to);
    const w = new Date(ts);
    w.setHours(Math.floor(to / 60), to % 60, 0, 0);
    if (w.getTime() > ts) w.setDate(w.getDate() - 1);
    return w.getTime();
  }

  function sleepPressureAt(ts) {
    const awakeH = Math.max(0, (ts - wakeAt(ts)) / 3600e3);
    const load = clamp(awakeH / 18, 0, 1);
    const debt = clamp(1 - sleepFactor(), 0, 1);
    return clamp(0.6 * load + 0.4 * debt, 0, 1);
  }

  function formAt(ts) {
    return clamp(circadianAt(ts) * (1 - 0.55 * sleepPressureAt(ts)), 0.05, 1);
  }
  function formNow() { return formAt(Date.now()); }
  function formMult() { return clamp(1 + 0.9 * (1 - formNow()), 1, 1.8); }

  const FORM_FROM = 7, FORM_TO = 23, FORM_H = 56;
  const DIP_FROM = 12, DIP_TO = 17;

  function formMarkerX(ts) {
    const d = new Date(ts), h = d.getHours() + d.getMinutes() / 60;
    return clamp(((h - FORM_FROM) / (FORM_TO - FORM_FROM)) * 240, 0, 240);
  }

  function smoothD(pts) {
    if (!pts.length) return "";
    let d = "M" + pts[0].x.toFixed(1) + "," + pts[0].y.toFixed(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += " C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " + c2x.toFixed(1) + "," + c2y.toFixed(1) +
        " " + p2.x.toFixed(1) + "," + p2.y.toFixed(1);
    }
    return d;
  }

  function formCard() {
    const pts = [];
    let best = { v: -1, h: FORM_FROM }, worst = { v: 2, h: FORM_FROM };
    for (let h = FORM_FROM; h <= FORM_TO; h += 0.25) {
      const d = new Date();
      d.setHours(Math.floor(h), Math.round((h - Math.floor(h)) * 60), 0, 0);
      const v = formAt(d.getTime());
      const x = ((h - FORM_FROM) / (FORM_TO - FORM_FROM)) * 240;
      const y = FORM_H - v * FORM_H;
      pts.push({ x: x, y: y });
      if (v > best.v) best = { v: v, h: h };
      if (h >= DIP_FROM && h <= DIP_TO && v < worst.v) worst = { v: v, h: h };
    }
    const line = smoothD(pts);
    const nx = formMarkerX(Date.now()).toFixed(1);
    const ny = (FORM_H - formNow() * FORM_H).toFixed(1);
    const at = (h) => xd(h);
    const ticks = [8, 12, 16, 20].map((h) =>
      '<span style="left:' + (((h - FORM_FROM) / (FORM_TO - FORM_FROM)) * 100).toFixed(2) + '%">' + h + ":00</span>").join("");
    const grid = [8, 12, 16, 20].map((h) =>
      '<line x1="' + (((h - FORM_FROM) / (FORM_TO - FORM_FROM)) * 240).toFixed(1) + '" y1="0" x2="' +
        (((h - FORM_FROM) / (FORM_TO - FORM_FROM)) * 240).toFixed(1) + '" y2="' + FORM_H +
        '" stroke="#16131f" stroke-opacity=".12" vector-effect="non-scaling-stroke"/>').join("");
    return '<section class="card card--ink">' +
      '<div class="form-top"><div><span class="label">форма дня</span>' +
        '<div class="form-big" id="formVal">' + Math.round(formNow() * 100) + "<small>%</small></div></div>" +
        '<div class="form-mult"><span>расход</span><b class="mono">×<span id="formMul">' + formMult().toFixed(2) + "</span></b></div></div>" +
      '<div class="form-chart">' +
        '<svg viewBox="0 0 240 ' + FORM_H + '" width="100%" height="76" preserveAspectRatio="none" aria-hidden="true">' +
          grid +
          '<path d="' + line + " L240," + FORM_H + " L0," + FORM_H + ' Z" style="fill:rgba(22,19,31,.09);stroke:none" />' +
          '<path d="' + line + '" fill="none" stroke="rgba(22,19,31,.62)" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke" />' +
          '<line id="formNow" x1="' + nx + '" y1="0" x2="' + nx + '" y2="' + FORM_H + '" stroke="#16131f" stroke-width="1" stroke-opacity=".45" stroke-dasharray="3 3" />' +
          '<circle id="formDot" cx="' + nx + '" cy="' + ny + '" r="3.4" fill="#16131f" />' +
        "</svg>" +
        '<div class="ink-axis">' + ticks + "</div>" +
      "</div>" +
      '<div class="form-facts">' +
        '<div><span class="ff-k">пик</span><b class="mono">' + at(best.h) + " · " + Math.round(best.v * 100) + "%</b></div>" +
        '<div><span class="ff-k">провал</span><b class="mono">' + at(worst.h) + " · " + Math.round(worst.v * 100) + "%</b></div>" +
        '<div><span class="ff-k">сейчас</span><b class="mono" id="formNowTxt">' + fmtClock(Date.now()) + "</b></div>" +
      "</div>" +
      '<p class="note" style="margin-top:var(--s3)">Чем ниже форма, тем дороже тот же расход. Кривая калибровочная.</p>' +
      "</section>";
  }

  function xd(h) {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  function slotMinutes(id) {
    const t = S.runtime.slot_on && S.runtime.slot_on[id];
    return t ? (Date.now() - t) / 60000 : 0;
  }
  function slotMult(id) {
    const soft = Number(S.config.session_soft_min) || 30;
    return slotMinutes(id) > soft ? (Number(S.config.session_mult) || 1.5) : 1;
  }

  function rateMode(night) {
    if (S.runtime.status === "cooling") return -Math.abs(Number(S.config.window_rate) || 0.15);
    const drainsOn = S.slots.some((s) => s.active && s.kind === "drain");
    if (night && isNight() && !drainsOn && !workActive()) return S.config.night_recharge;
    const mult = drainMult() * formMult();
    let r = 0;
    if (workActive()) r -= S.config.drain_coef * (Number(S.runtime.work.weight) || 0) * mult;
    for (const s of S.slots) {
      if (!s.active) continue;
      const w = Number(s.weight) || 0;
      if (s.kind === "drain") { r -= S.config.drain_coef * w * mult * slotMult(s.id); }
      else {
        if (isResidue()) continue;
        r += S.config.stab_coef * w * (s.context === "cognitive" ? -0.8 : 1);
      }
    }
    return r;
  }
  function rateOf() { return rateMode(true); }

  function ceiling() {
    if (S.runtime.base == null) return 100;
    return Math.max(S.runtime.base * sleepFactor(), S.runtime.battery || 0);
  }
  function wakeMoment(ts) {
    const o = sleepRef();
    const a = toMin((o && o.to) || S.config.sleep_to);
    const w = new Date(ts);
    w.setHours(Math.floor(a / 60), a % 60, 0, 0);
    if (w.getTime() > ts) w.setDate(w.getDate() - 1);
    return w.getTime();
  }
  function morningMarks() {
    const wake = wakeMoment(Date.now());
    const to = wake + 90 * 60000;
    let n = 0;
    for (const e of S.runtime.hook_log || []) {
      if (!e.on) continue;
      const t = Date.parse(e.at);
      if (t >= wake && t <= to) n++;
    }
    return n;
  }
  function autoMorningLevel() {
    const n = morningMarks();
    return n >= 2 ? 2 : n === 1 ? 1 : 0;
  }
  function morningManual() {
    const m = S.runtime.morning;
    return !!(m && m.day === todayKey() && m.manual);
  }
  function morningLevel() {
    const m = S.runtime.morning;
    if (morningManual()) return clamp(Number(m.level) || 0, 0, 2);
    return autoMorningLevel();
  }
  function morningPenalty() { return [0, 5, 12][morningLevel()] || 0; }
  function dayCeiling() { return Math.max(0, ceiling() - morningPenalty()); }
  function floorValue() { const f = Number(S.config.debt_floor); return isNaN(f) ? 0 : Math.min(0, f); }

  function gapHours() {
    const t = Date.parse(S.runtime.battery_at);
    if (!t) return 0;
    return Math.max(0, (Date.now() - t) / 3600000);
  }
  function gapLimit() {
    const g = Number(S.config.max_gap_h);
    return isNaN(g) || g <= 0 ? 6 : g;
  }
  function isStale() { return S.runtime.base != null && gapHours() > gapLimit(); }

  // Разрыв считается по отрезкам: ночные часы дают сон, дневные — расход.
  // Иначе утреннее открытие приложения записывало бы всю ночь по дневной ставке.
  function gapSplit(from, to) {
    const t0 = from || 0, t1 = to == null ? Date.now() : to;
    if (!t0 || !(t1 > t0)) return { night: 0, day: 0 };
    const step = 5 * 60000;
    let night = 0, day = 0;
    for (let s = t0; s < t1; s += step) {
      const dt = Math.min(step, t1 - s) / 3600000;
      if (isNightAt(s + step / 2)) night += dt; else day += dt;
    }
    return { night: night, day: day };
  }
  function nightRateFor() {
    if (S.runtime.status === "cooling") return rateMode(false);
    const drainsOn = S.slots.some((s) => s.active && s.kind === "drain");
    if (drainsOn || workActive()) return rateMode(false);
    return Number(S.config.night_recharge) || 0;
  }
  function accrueFrom(b0, from, to, ceil) {
    const g = gapSplit(from, to);
    const v = b0 + g.night * nightRateFor() + Math.min(g.day, gapLimit()) * rateMode(false);
    return clamp(v, floorValue(), ceil == null ? ceiling() : ceil);
  }

  function liveValueAt(ceil) {
    const r = S.runtime;
    if (r.base == null) return null;
    const b0 = r.battery == null ? r.base : r.battery;
    return accrueFrom(b0, Date.parse(r.battery_at) || 0, Date.now(), ceil == null ? ceiling() : ceil);
  }
  function liveValue() { return liveValueAt(ceiling()); }

  function projection() {
    const v = liveValue(); if (v == null) return null;
    return clamp(v + rateOf() * hoursToEvening().hours, 0, Math.max(dayCeiling(), v));
  }

  function projectionRaw() {
    const v = liveValue(); if (v == null) return null;
    return v + rateOf() * hoursToEvening().hours;
  }

  function projDelta(before, after) {
    if (before == null || after == null) return "";
    const b = Math.round(before), a = Math.round(after);
    if (b === a) return " · к вечеру без изменений";
    return " · к вечеру " + (a < 0 ? "−" : "") + Math.abs(a) + "% вместо " +
      (b < 0 ? "−" : "") + Math.abs(b) + "%";
  }


  function pushSample(v) {
    const arr = S.runtime.samples || (S.runtime.samples = []);
    const now = Date.now();
    arr.push({ t: now, v: round1(v) });
    const cutoff = now - 2 * 3600e3;
    S.runtime.samples = arr.filter((x) => x.t >= cutoff && x.v != null).slice(-400);
  }

  function accrue() {
    const v = liveValueAt(ceiling());
    if (v == null) return;
    S.runtime.battery = round2(v);
    S.runtime.battery_at = nowISO();
    pushSample(v);
    digestValue21();
    save();
  }

  // ─────────────────────────── дневная сводка по часам ───────────────────────────
  // Модель линейна, поэтому значение можно посчитать назад во времени:
  // отсюда вечерний ресурс восстанавливается, даже если приложение не было открыто.
  function valueAt(ts) {
    const r = S.runtime;
    if (r.base == null) return null;
    const t0 = Date.parse(r.battery_at) || 0;
    if (!t0) return null;
    const b0 = r.battery == null ? r.base : r.battery;
    return accrueFrom(b0, t0, ts, ceiling());
  }

  function dayRec(ts) {
    const t = ts == null ? Date.now() : ts;
    const key = localDayKey(t);
    const days = S.runtime.days || (S.runtime.days = {});
    let rec = days[key];
    if (!rec || typeof rec !== "object") rec = days[key] = {};
    if (!Array.isArray(rec.e) || rec.e.length !== 24) rec.e = new Array(24).fill(0);
    if (!Array.isArray(rec.m) || rec.m.length !== 24) rec.m = new Array(24).fill(0);
    if (typeof rec.f !== "number") rec.f = 0;
    if (typeof rec.w !== "number") rec.w = 0;
    if (rec.v21 === undefined) rec.v21 = null;
    return rec;
  }

  function pruneDays() {
    const days = S.runtime.days || {};
    const cut = Date.now() - 60 * 864e5;
    for (const k of Object.keys(days)) {
      const t = Date.parse(k + "T00:00:00");
      if (!isNaN(t) && t < cut) delete days[k];
    }
  }

  function digestAdd(kind, n, ts) {
    const t = ts == null ? Date.now() : ts;
    if (!t || isNaN(t)) return;
    const rec = dayRec(t);
    const h = new Date(t).getHours();
    if (kind === "entry") rec.e[h] += Math.max(1, Number(n) || 1);
    else if (kind === "mark") rec.m[h] += Math.max(1, Number(n) || 1);
    else if (kind === "focus") rec.f += Number(n) || 0;
    else if (kind === "work") rec.w += Number(n) || 0;
    pruneDays();
  }

  function digestValue21() {
    if (S.runtime.base == null) return false;
    const now = new Date();
    if (now.getHours() < 21) return false;
    const rec = dayRec(now.getTime());
    if (rec.v21 != null) return false;
    const t21 = new Date(now);
    t21.setHours(21, 0, 0, 0);
    const v = valueAt(t21.getTime());
    if (v == null) return false;
    rec.v21 = round1(v);
    return true;
  }

  // ─────────────────── профиль по часам и факты-предупреждения ───────────────────
  function profileWindow(n) {
    const span = n || 28;
    const all = S.runtime.days || {};
    const keys = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < span; i++) {
      const k = localDayKey(today.getTime() - i * 864e5);
      if (all[k]) keys.push(k);
    }
    const hours = new Array(24).fill(0);
    const daysWithE = new Array(24).fill(0);
    const evenings = [];
    let totalEntries = 0, withEntries = 0;
    for (const k of keys) {
      const rec = all[k] || {};
      const ee = Array.isArray(rec.e) ? rec.e : [];
      let day = 0;
      for (let h = 0; h < 24; h++) {
        const v = Number(ee[h]) || 0;
        if (v > 0) { hours[h] += v; daysWithE[h]++; day += v; }
      }
      totalEntries += day;
      if (day > 0) withEntries++;
      if (rec.v21 != null) evenings.push(Number(rec.v21));
    }
    let peak = 0;
    for (let h = 1; h < 24; h++) if (hours[h] > hours[peak]) peak = h;
    return {
      span: span, days: keys.length, withEntries: withEntries,
      hours: hours, daysWithE: daysWithE, totalEntries: totalEntries, peak: peak,
      perDay: withEntries ? Math.round((totalEntries / withEntries) * 10) / 10 : null,
      evening: median(evenings)
    };
  }

  function hh(h) { return String(h).padStart(2, "0") + ":00"; }

  // Дни с метками утром против тихих — по вечернему заряду.
  function morningSplit() {
    const all = S.runtime.days || {};
    const noisy = [], calm = [];
    for (const k of Object.keys(all)) {
      const rec = all[k] || {};
      if (rec.v21 == null) continue;
      const mm = Array.isArray(rec.m) ? rec.m : [];
      let mk = 0;
      for (let h = 5; h <= 10; h++) mk += Number(mm[h]) || 0;
      (mk >= 2 ? noisy : calm).push(Number(rec.v21));
    }
    if (noisy.length < 3 || calm.length < 3) return null;
    const a = median(noisy), b = median(calm);
    if (a == null || b == null) return null;
    return { noisy: noisy.length, calm: calm.length, d: round1(a - b) };
  }

  // Один факт на действие: без оценки, только то, что видно в журнале.
  function adviceForEntry(when) {
    const p = profileWindow(28);
    if (p.days < 3) return null;
    const at = when || new Date();
    const h = at.getHours();
    const rec = (S.runtime.days || {})[localDayKey(Date.now())] || {};
    const ee = Array.isArray(rec.e) ? rec.e : [];
    const hStart = new Date(at);
    hStart.setMinutes(0, 0, 0);
    let inHour = Number(ee[h]) || 0;
    for (const x of S.interruptions || []) {
      const t = Date.parse(x.started_at);
      if (!isNaN(t) && t >= hStart.getTime() && t <= at.getTime()) inHour++;
    }
    if (inHour >= 1) {
      return "Второй вход за этот час: первый стоил " + S.config.entry_cost + " %, и " +
        S.config.recovery_min + " минут фокус не возвращается.";
    }
    const hits = p.daysWithE[h];
    if (hits >= 3 && hits >= p.days * 0.4) {
      return "За " + p.days + " дн. в " + hh(h) + " вы включали в " + hits + " из них" +
        (p.evening != null ? ". Обычный вечер — " + round1(p.evening) + " %" : "") + ".";
    }
    return null;
  }

  function baseFrom(cp) {
    if (!cp) return null;
    const st = Object.values(cp.stats || {}), db = Object.values(cp.debuffs || {});
    if (!st.length) return null;
    const aS = st.reduce((a, b) => a + b, 0) / st.length;
    const aD = db.length ? db.reduce((a, b) => a + b, 0) / db.length : 5;
    return round1(70 * (aS / 10) + 30 * (1 - aD / 10));
  }

  function lastCP() { return S.checkpoints.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-1)[0] || null; }
  function daysToCheckpoint() {
    const cp = lastCP(); if (!cp) return null;
    return Math.ceil((new Date(cp.date).getTime() + S.config.checkpoint_interval_days * 864e5 - Date.now()) / 864e5);
  }
  function cycleDay() {
    const cp = lastCP(); if (!cp) return null;
    const day = Math.floor((Date.now() - new Date(cp.date).getTime()) / 864e5) + 1;
    return clamp(day, 1, S.config.checkpoint_interval_days);
  }
  function hoursToEvening() {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    if (h >= 6 && h < 23) return { hours: Math.max(0.5, 23 - h), label: "к 23:00" };
    return { hours: 8, label: "через 8 ч" };
  }

  function chargeBattery(pp) {
    const r = S.runtime;
    if (r.base == null) { toast("Сначала нужен чекпоинт: без базы заряд не считается"); return false; }
    accrue();
    const v = pp < 0 ? Math.min(ceiling(), r.battery - pp) : r.battery - pp;
    r.battery = round2(clamp(v, floorValue(), 100));
    r.battery_at = nowISO();
    pushSample(r.battery);
    save();
    return true;
  }

  function chargeEntry() {
    const t = Date.now();
    if (S.runtime.last_entry_at && t - Date.parse(S.runtime.last_entry_at) < S.config.merge_gap_min * 60000) return false;
    if (!chargeBattery(S.config.entry_cost)) return false;
    S.runtime.last_entry_at = nowISO();
    S.runtime.residue_until = t + S.config.residue_min * 60000;
    save();
    return true;
  }

  // После выключения потребителя внимание возвращается не сразу:
  // пока идёт окно восстановления, стабилизаторы не работают.
  function startRecovery(s) {
    if (!s || s.kind !== "drain" || s.mode === "ambient") return false;
    const min = Number(S.config.recovery_min) || 0;
    if (min <= 0) return false;
    const until = Date.now() + min * 60000;
    if (until > (Number(S.runtime.recovery_until) || 0)) S.runtime.recovery_until = until;
    return true;
  }

  function recoveryAsk(s, onGo) {
    if (!s || s.active) return false;
    if (s.kind !== "drain" || s.mode === "ambient") return false;
    if (!isRecovery()) return false;
    const key = Number(S.runtime.recovery_until) || 0;
    if (!S.runtime.rec_warn || S.runtime.rec_warn.until !== key) S.runtime.rec_warn = { until: key, ids: {} };
    if (S.runtime.rec_warn.ids[s.id]) return false;
    S.runtime.rec_warn.ids[s.id] = true;
    save();
    openModal({
      title: "Внимание сгорит",
      html: "<p>То, что возвращается сейчас, уйдёт обратно. Возвращать придётся заново.</p>",
      actions: [
        { label: "Оставить выключенным", kind: "primary", onClick: closeModal },
        { label: "Включить всё равно", onClick: () => { closeModal(); onGo(); } },
      ],
    });
    return true;
  }

  // ─────────────────────────────── тост и шторки ───────────────────────────────
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }
  const CP = ["чекпоинт", "чекпоинта", "чекпоинтов"];
  const CAP = ["запись", "записи", "записей"];

  let toastT = null;
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove("is-on"), 2600);
  }

  let modalCleanup = null;
  function openModal(o) {
    const m = $("#modal"), box = $("#modalBox");
    box.innerHTML =
      '<h2 class="modal__title" id="modalTitle">' + esc(o.title || "") + "</h2>" +
      '<div class="modal__body">' + (o.html || "") + "</div>" +
      (o.fields || []).map((f) =>
        f.type === "custom" ? "" :
        '<div class="field"><label for="mf_' + esc(f.key) + '">' + esc(f.label) + "</label>" +
        (f.type === "textarea"
          ? '<textarea id="mf_' + esc(f.key) + '" rows="3">' + esc(f.value || "") + "</textarea>"
          : f.type === "select"
            ? '<select id="mf_' + esc(f.key) + '">' + (f.options || []).map((op) =>
                '<option value="' + esc(op.v) + '"' + (String(op.v) === String(f.value) ? " selected" : "") + ">" + esc(op.l) + "</option>").join("") + "</select>"
            : '<input id="mf_' + esc(f.key) + '" type="' + esc(f.type || "text") + '" ' +
              (f.type === "number" ? 'inputmode="decimal" step="any" ' : 'autocomplete="off" ') +
              'value="' + esc(f.value == null ? "" : f.value) + '">') + "</div>"
      ).join("") +
      '<div class="modal__foot">' +
      (o.actions || []).map((a, i) =>
        '<button type="button" data-modal-act="' + i + '" class="' + (a.kind || "") + '">' + esc(a.label) + "</button>"
      ).join("") + "</div>";

    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    const read = () => { const out = {}; (o.fields || []).forEach((f) => { const el = $("#mf_" + f.key); out[f.key] = el ? el.value : ""; }); return out; };
    (o.actions || []).forEach((a, i) => { const b = $('[data-modal-act="' + i + '"]', box); if (b) b.onclick = () => { if (a.onClick) a.onClick(read()); }; });
    if (o.after) o.after(box);
    const first = box.querySelector("input,textarea,button");
    if (first) first.focus();
    modalCleanup = () => { m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true"); box.innerHTML = ""; };
    m.onclick = (e) => { if (e.target === m) closeModal(); };
    document.addEventListener("keydown", onModalKey);
  }
  function onModalKey(e) {
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key !== "Tab") return;
    const box = $("#modalBox");
    const f = $$('button,input,textarea,select,[tabindex]:not([tabindex="-1"])', box);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function closeModal() {
    if (modalCleanup) modalCleanup();
    modalCleanup = null;
    document.removeEventListener("keydown", onModalKey);
  }

  // ─────────────────────────────── компоненты ───────────────────────────────
  function levelOf(b) {
    if (b < 0) return { c1: "#ff7a6b", c2: "#7a2216" };
    if (b >= 60) return { c1: "#e2f163", c2: "#8ea52b" };
    if (b >= 35) return { c1: "#cfe07a", c2: "#63731f" };
    if (b >= 15) return { c1: "#f0d98a", c2: "#8a6f24" };
    return { c1: "#ff9f6b", c2: "#a04a1c" };
  }

  function statusBadge(value) {
    const debt = value != null && value < 0 ? '<span class="badge badge--pause"><span class="dot"></span>долг</span> ' : "";
    if (isResidue()) return debt + '<span class="badge badge--pause"><span class="dot"></span>' +
      (isRecovery() ? "восстановление " : "пауза ") + hhmm(residueEnd() - Date.now()) + "</span>";
    const r = rateOf();
    if (r > 0.02) return debt + '<span class="badge badge--up"><span class="dot"></span>+' + r.toFixed(2) + " %/ч" + (isNight() ? " · сон" : "") + "</span>";
    if (r < -0.02) return debt + '<span class="badge badge--down"><span class="dot"></span>' + r.toFixed(2) + " %/ч</span>";
    return debt + '<span class="badge badge--flat"><span class="dot"></span>баланс</span>';
  }

  function sparkBlock() {
    const arr = (S.runtime.samples || []).slice();
    const v = liveValue();
    if (v != null) arr.push({ t: Date.now(), v });
    const now = Date.now();
    const win = arr.filter((p) => p.t >= now - 3600e3);
    if (win.length < 2) {
      return '<div class="spark" id="sparkBox"><div class="spark-empty">график заполняется по мере работы</div></div>';
    }
    const W = 300, H = 44, pad = 3;
    const t0 = win[0].t, t1 = win[win.length - 1].t;
    const ys = win.map((p) => p.v);
    const lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    const span = Math.max(0.15, hi - lo);
    const px = (t) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad);
    const py = (y) => H - pad - ((y - lo) / span) * (H - 2 * pad);
    const path = win.map((p, i) => (i ? "L" : "M") + px(p.t).toFixed(1) + " " + py(p.v).toFixed(1)).join(" ");
    const last = win[win.length - 1];
    const delta = last.v - win[0].v;
    const sign = delta > 0.004 ? "+" : delta < -0.004 ? "−" : "±";
    return '<div class="spark" id="sparkBox">' +
      '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<line x1="0" x2="' + W + '" y1="' + (H * .25) + '" y2="' + (H * .25) + '" stroke="currentColor" stroke-opacity=".1" vector-effect="non-scaling-stroke"/>' +
        '<line x1="0" x2="' + W + '" y1="' + (H * .5) + '" y2="' + (H * .5) + '" stroke="currentColor" stroke-opacity=".1" vector-effect="non-scaling-stroke"/>' +
        '<line x1="0" x2="' + W + '" y1="' + (H * .75) + '" y2="' + (H * .75) + '" stroke="currentColor" stroke-opacity=".1" vector-effect="non-scaling-stroke"/>' +
        '<path d="' + path + " L" + px(last.t).toFixed(1) + " " + (H - pad) + " L" + px(win[0].t).toFixed(1) + " " + (H - pad) + ' Z" fill="currentColor" opacity=".14"/>' +
        '<path d="' + path + '" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
        '<circle cx="' + px(last.t).toFixed(1) + '" cy="' + py(last.v).toFixed(1) + '" r="2.5" fill="currentColor"/>' +
      "</svg>" +
      '<div class="spark-legend">за час ' + sign + Math.abs(delta).toFixed(2) + " % · " + lo.toFixed(1) + "…" + hi.toFixed(1) + "%</div>" +
    "</div>";
  }

  function heroBlock() {
    const v = liveValue();
    if (v == null) {
      return '<section class="card hero"><div class="hero-top"><div>' +
        '<div class="label">заряд</div>' +
        '<div class="hero-num hero-num--empty">—<span>%</span></div>' +
        '<div class="hero-sub">Заряд считается от последней точки сохранения</div></div>' +
        '<span class="badge badge--flat"><span class="dot"></span>база не задана</span></div>' +
        '<div class="divider"></div>' +
        '<p class="dim">Первый чекпоинт — 15 минут, дальше раз в две недели. После него появится живая телеметрия.</p>' +
        '<div class="row"><button type="button" class="primary" data-go="checkpoint">Сделать чекпоинт</button>' +
        '<button type="button" data-act="seed">Стартовый профиль</button></div></section>';
    }
    const lv = levelOf(v), ceil = dayCeiling(), proj = projection(), ep = hoursToEvening();
    const f = sleepFactor();
    const lockAt = Math.max(ceil, v);
    const cells = Array.from({ length: 10 }, (_, i) => {
      const cur = clamp((v - i * 10) / 10, 0, 1) * 100;
      const fut = clamp((proj - i * 10) / 10, 0, 1) * 100;
      const locked = i * 10 >= lockAt ? " is-locked" : "";
      return '<span class="cell' + locked + '"><i class="wane" style="height:' + cur.toFixed(1) + '%"></i><i class="deep" style="height:' + fut.toFixed(1) + '%"></i></span>';
    }).join("");
    return '<section class="card hero" style="--lvl:' + lv.c1 + ';--lvl-2:' + lv.c2 + '">' +
      '<div class="hero-top"><div>' +
        '<div class="label">заряд</div>' +
        '<div class="hero-num" id="heroVal">' + v.toFixed(2) + "<span>%</span></div>" +
        '<div class="hero-sub" id="heroSpent">потрачено ' + Math.max(0, (S.runtime.base || 0) - v).toFixed(2) + " %</div>" +
      "</div><div id=\"heroBadge\">" + statusBadge(v) + "</div></div>" +
      '<div class="battery">' +
        '<div class="bat-shell"><div class="bat-cells" id="batCells">' + cells + "</div></div>" +
        '<div class="bat-nub"></div>' +
        '<div class="bat-fx" id="heroZone" aria-hidden="true"></div>' +
      "</div>" +
      '<div class="bars-axis"><span>0 %</span><b style="left:' + clamp(v, 0, 100).toFixed(1) + '%">сейчас</b><span>100 %</span></div>' +
      '<div class="legend">' +
        '<span><i class="lg lg--deep"></i>останется к вечеру</span>' +
        '<span><i class="lg lg--wane"></i>уйдёт</span>' +
        '<span><i class="lg lg--lock"></i>выше потолка</span>' +
        '<span class="live"><i class="dot"></i><span id="heroProj">' + proj.toFixed(1) + "</span>% " + ep.label.toLowerCase() + "</span>" +
      "</div>" +
      sparkBlock() +
      (isStale() ? '<p class="note" id="staleNote">Опора старше ' + Math.round(gapHours()) +
        " ч — расход после неё не досчитывается, чтобы не выдумывать долг.</p>" : "") +
      '<div class="sleepline"><span>Сон <b class="mono">' + fmtDur(lastNightHours()) + "</b> · потолок <b class=\"mono\">" +
        Math.round(f * 100) + "%</b> · расход <b class=\"mono\">×" + drainMult().toFixed(2) + "</b></span>" +
        '<button type="button" class="link" data-sheet="sleep">Изменить</button></div>' +
      '<div class="morningrow"><button type="button" class="morningtag" data-sheet="morning">' + morningLabel() +
        (morningPenalty() ? " −" + morningPenalty() + " %" : "") + "</button></div>" +
    "</section>";
  }

  function pausesLeftToday() {
    const r = S.runtime;
    return Math.max(0, S.config.micro_pause_limit - (r.pause_day === todayKey() ? (r.pause_count || 0) : 0));
  }

  function protocolInfo(key) {
    const c = S.config;
    if (key === "scout") return {
      word: "разведка",
      title: "Разведка",
      body: c.scout_min + " минут на то, чтобы осознанно посмотреть отвлечение. Когда время выйдет, приложение спросит: продолжили работу или остановились. Это выбор, а не срыв — вход за разведку не списывается.",
      foot: "Работает один раз за раз, потом ждёт ответа."
    };
    if (key === "window") return {
      word: "окно",
      title: "Окно",
      body: "Осознанная пауза на " + c.legit_window_min + " минут. Начисление останавливается целиком, заряд почти не тает: " + c.window_rate + " %/час. Окно возвращает к базе, но выше базы не поднимает.",
      foot: "В день не больше " + c.legit_window_limit + ". Дальше фиксируется как автопилот."
    };
    return {
      word: "пауза",
      title: "Пятнадцать минут без экрана",
      body: "Микропауза возвращает " + c.micro_pause + " % к заряду и снимает накопленное напряжение. Экран при этом лучше действительно отложить.",
      foot: "Осталось сегодня: " + pausesLeftToday() + " из " + c.micro_pause_limit + "."
    };
  }

  function protocolsRow() {
    const r = S.runtime;
    const item = (key, ico, on, tail) =>
      '<button type="button" class="proto' + (on ? " is-on" : "") + '" data-act="' + key + '" data-hold="' + key + '">' +
        icon(ico, 14) + "<span>" + protocolInfo(key).word + (tail ? " " + tail : "") + "</span></button>";
    return '<section class="card card--tight"><div class="between" style="margin-bottom:var(--s2)">' +
      '<span class="label">протоколы</span>' +
      '<span class="hint-mini">удержание — что это</span></div><div class="protos">' +
      item("scout", "bolt", !!r.scout_end, r.scout_end ? hhmm(r.scout_end - Date.now()).slice(0, 5) : "") +
      item("window", "shield", !!r.window_end, r.window_end ? hhmm(r.window_end - Date.now()).slice(0, 5) : "") +
      item("microPause", "leaf", false, "") +
    "</div></section>";
  }

  function openProtocolSheet(key) {
    const info = protocolInfo(key);
    const r = S.runtime;
    const busy = (key === "scout" && r.scout_end) || (key === "window" && r.window_end);
    openModal({
      title: info.title,
      html: '<p class="note">' + info.body + "</p><p class=\"note dim\">" + info.foot + "</p>",
      actions: [
        { label: "Закрыть", onClick: closeModal },
        busy
          ? { label: "Уже идёт", kind: "primary", onClick: closeModal }
          : { label: "Запустить", kind: "primary", onClick: () => { closeModal(); act(key); } }
      ]
    });
  }

  function weightWord(w) {
    return w <= 4 ? "лёгкий" : w <= 7 ? "средний" : "тяжёлый";
  }

  function weightTone(w) {
    return w <= 4 ? "easy" : w <= 7 ? "mid" : "hard";
  }

  function workCard() {
    const w = S.runtime.work;
    const weight = clamp(Number(w.weight) || 8, 1, 10);
    const pct = ((weight - 1) / 9) * 100;
    return '<section class="card"><div class="between"><h2 style="margin:0">Рабочий день</h2>' +
      '<span class="chip">' + (w.active ? "идёт" : "не начат") + "</span></div>" +
      (w.active
        ? '<div class="clock" id="workClock">' + clockBig(Date.now() - Date.parse(w.started_at)) + "</div>"
        : '<p class="dim">Работа и дорога тратят ресурс сами по себе.</p>') +
      '<div class="row"><button type="button" class="primary" data-act="work">' +
        (w.active ? "Завершить день" : "Начать рабочий день") + "</button></div>" +
      '<div class="sld sld--' + weightTone(weight) + '" id="workSld" style="--p:' + pct + '%">' +
        '<div class="sld-top"><label for="workW">тяжесть дня</label>' +
          '<span class="sld-val"><small id="workTone">' + weightWord(weight) + '</small><b id="workW-v">' + weight + "</b></span></div>" +
        '<input type="range" id="workW" min="1" max="10" step="1" value="' + weight + '" data-workw>' +
      "</div></section>";
  }


  function slotRate(s) {
    const w = Number(s.weight) || 0;
    return s.kind === "drain"
      ? -S.config.drain_coef * w
      : S.config.stab_coef * w * (s.context === "cognitive" ? -0.8 : 1);
  }

  function slotLive(s) {
    if (!s.active) return 0;
    if (S.runtime.status === "cooling") return 0;
    if (isResidue() && s.kind === "stab") return 0;
    return slotRate(s) * slotMult(s.id);
  }

  function flowRow(s) {
    const inWin = S.runtime.status === "cooling";
    const residue = isResidue();
    const zeroed = !s.active || inWin || (residue && s.kind === "stab");
    const live = s.active && slotMinutes(s.id) >= 1 ? hhmm(slotMinutes(s.id) * 60000).slice(0, 5) : "";
    const sub = [esc(s.trigger),
      s.context !== "any" ? (s.context === "mechanical" ? "механика" : "когнитивная") : "",
      s.mode === "ambient" ? "фон" : "",
      live ? "идёт " + live : "",
      zeroed && s.active ? "не влияет" : ""].filter(Boolean).join(" · ");

    return '<div class="flow flow--' + s.kind + (s.active ? " is-on" : "") + (s.id === toggledId ? " is-just" : "") + '">' +
      '<button type="button" class="flow-main" data-tog="' + s.id + '" aria-pressed="' + (s.active ? "true" : "false") + '"' +
        ' aria-label="' + esc(s.title) + ": " + (s.active ? "включён" : "выключен") + '">' +
        '<span class="flow-tile">' + (s.kind === "drain" ? icon("down", 14) : icon("up", 14)) + "</span>" +
        '<span class="flow-body">' +
          '<span class="flow-name">' + esc(s.title) + "</span>" +
          '<span class="flow-sub">' + sub + "</span>" +
        "</span>" +
        '<span class="flow-switch" aria-hidden="true"><i></i></span>' +
      "</button></div>";
  }

  function flowGroup(kind, title) {
    const arr = S.slots.filter((s) => s.kind === kind);
    if (!arr.length) return "";
    const sum = arr.reduce((a, s) => a + slotLive(s), 0);
    const tail = Math.abs(sum) < 0.005
      ? "тишина"
      : (sum > 0 ? "+" : "−") + Math.abs(sum).toFixed(2) + " %/ч";
    return '<div class="flow-group"><span>' + title + "</span>" +
      '<span class="mono' + (Math.abs(sum) < 0.005 ? " is-off" : "") + '">' + tail + "</span></div>" +
      arr.map(flowRow).join("");
  }

  function slotsBlock() {
    const on = S.slots.filter((s) => s.active).length;
    return '<section class="card"><div class="between"><h2 style="margin:0">Потоки</h2>' +
      '<span class="chip mono">' + on + " / " + S.slots.length + "</span></div>" +
      '<div class="flows-topline"><span class="hint-mini">тап — включить, удержание — настройка</span></div>' +
      '<div class="flows">' +
        flowGroup("drain", "съедают") +
        flowGroup("stab", "возвращают") +
      "</div></section>";
  }

  function switchRow() {
    const r = S.runtime;
    if (!r.drain_start) return "";
    return '<section class="card"><div class="between"><h2 style="margin:0">Эпизод идёт</h2>' +
      '<span class="mono" id="drainClock" style="font-size:22px">' + hhmm(Date.now() - r.drain_start).slice(0, 5) + "</span></div>" +
      '<p class="note">' + (r.pending_entry ? "Вход " + S.config.entry_cost + " % уже списан." : "Вход не списан: склейка с предыдущим эпизодом.") + "</p>" +
      '<div class="row"><button type="button" class="primary" data-act="return">Вернулся</button></div></section>';
  }

  function patchBody(lines) {
    return lines.map((l) => '<div class="pl--' + l.cls + '"><span class="tag">' + l.tag + '</span><span class="txt">' + esc(l.t) + "</span></div>").join("");
  }

  function patchNote(from, to) {
    const out = [];
    for (const k in STATS) {
      const a = from.stats[k], b = to.stats[k], d = b - a;
      if (d > 0) out.push({ cls: "b", tag: "[BUFF]", t: STATS[k] + ": " + a + " → " + b + " (+" + d + ")" });
      else if (d < 0) out.push({ cls: "n", tag: "[NERF]", t: STATS[k] + ": " + a + " → " + b + " (" + d + ")" });
      else out.push({ cls: "h", tag: "[HOLD]", t: STATS[k] + ": " + b });
    }
    for (const k in DEBUFFS) {
      const a = from.debuffs[k], b = to.debuffs[k], d = b - a;
      if (d < 0) out.push({ cls: "f", tag: "[FIX]", t: DEBUFFS[k] + ": " + a + " → " + b + " (" + d + ")" });
      else if (d > 0) out.push({ cls: "o", tag: "[OVERLOAD]", t: DEBUFFS[k] + ": " + a + " → " + b + " (+" + d + ")" });
      else out.push({ cls: "h", tag: "[HOLD]", t: DEBUFFS[k] + ": " + b });
    }
    return out;
  }

  // ─────────────────────────────── экраны ───────────────────────────────
  let activeTab = "home";

  let toggledId = null;
  let lastHeroVal = null;

  let touchedSliders = new Set();

  function marksBlock() {
    const counts = hookCounts();
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    if (!keys.length) return "";
    return '<div class="marks"><div class="between" style="margin-bottom:var(--s2)">' +
      '<span class="label">метки за день</span>' +
      '<span class="chip">' + keys.reduce((a, h) => a + counts[h], 0) + " шт.</span></div>" +
      keys.map((h) => '<span class="mark-chip"><b class="mono">' + counts[h] + "</b> " + esc(hookLabel(h)) + "</span>").join("") +
      "</div>";
  }

  function journalOpen() {
    try { return localStorage.getItem("et_journal_open") === "1"; } catch (e) { return false; }
  }

  function journalCard() {
    const r = S.runtime;
    const live = !!(r.focus_start || r.scout_end || r.window_end);
    const open = journalOpen();
    const fLabel = r.focus_start ? "Фокус · " + hhmm(Date.now() - r.focus_start) : "Засечь фокус";
    const head = '<button type="button" class="journal-head" data-journal="1" aria-expanded="' + (open ? "true" : "false") + '">' +
      '<span class="label">журнал дня</span>' +
      '<span class="journal-tail"><span class="chip">' + timelineEvents().length + " соб.</span>" +
      '<span class="journal-chev' + (open ? " is-open" : "") + '">' + icon("chevron", 16) + "</span></span></button>";
    if (!open) return '<section class="card card--tight">' + head + "</section>";
    return '<section class="card card--tight">' + head +
      '<div class="row" style="margin:var(--s3) 0">' +
        '<button type="button" class="pill ' + (live ? "is-live" : "") + '" data-act="focus" id="focusPill"><span>' +
          icon("bolt", 15) + " " + fLabel + "</span><span class=\"pill-meta\">" +
          (r.focus_start ? "стоп" : "замер") + "</span></button></div>" +
      timeline(6) +
      marksBlock() +
      '<div class="sleepline"><span>ёмкость внимания за неделю <b class="mono">' + avgFocus() + '</b></span></div>' +
      '<div class="journal-foot"><button type="button" class="link" data-act="manualInt">записать переключение задним числом</button></div>' +
    "</section>";
  }

  function morningLabel() {
    const lv = morningLevel();
    const n = morningMarks();
    const base = lv === 0 ? "утро чисто" : lv === 1 ? "утро до 15 мин" : "утро больше 15 мин";
    if (morningManual()) return base + " · вручную";
    return n === 0 ? "утро без меток" : base;
  }

  function setMorning(lv) {
    const already = morningManual() && morningLevel() === lv;
    S.runtime.morning = already ? null : { day: todayKey(), level: lv, manual: true };
    save();
    closeModal();
    render();
    toast(already ? "Снова считаю по меткам" : (morningPenalty() ? "Потолок дня −" + morningPenalty() + " %" : "Утро чистое, потолок полный"));
  }

  function openMorningSheet() {
    const n = morningMarks(), lv = morningLevel();
    const wake = wakeMoment(Date.now());
    const upto = fmtClock(wake + 90 * 60000);
    const head = n > 0
      ? "Датчик дал " + n + " " + plural(n, ["метку", "метки", "меток"]) + " с " + fmtClock(wake) + " до " + upto + ". Это и есть уровень залипания."
      : "С " + fmtClock(wake) + " до " + upto + " меток нет: ПК был выключен или Ярлыки не сработали. Пока ничего не выбрано, утро считается чистым.";
    openModal({
      title: "Утро после подъёма",
      html: '<p class="note">' + head + (morningManual() ? " Сейчас стоит ручная отметка — тап по выбранному варианту вернёт к расчёту по меткам." : "") + "</p>",
      actions: [
        { label: "Чисто" + (lv === 0 ? " ✓" : ""), onClick: () => setMorning(0) },
        { label: "До 15 мин" + (lv === 1 ? " ✓" : ""), onClick: () => setMorning(1) },
        { label: "Больше" + (lv === 2 ? " ✓" : ""), onClick: () => setMorning(2) }
      ]
    });
  }


  function renderHome() {
    const r = S.runtime;
    let h = heroBlock() + slotsBlock() + formCard() + protocolsRow() + workCard() + switchRow();
    if (r.scout_pending) {
      h += '<section class="card"><h2>Разведка завершена</h2><p class="dim">Продолжили работу после сигнала?</p>' +
        '<div class="row"><button type="button" class="primary" data-scout="yes">Продолжил</button>' +
        '<button type="button" data-scout="no">Остановился</button></div></section>';
    }
    if (r.window_end) {
      h += '<section class="card"><div class="between"><span class="badge badge--flat"><span class="dot"></span>охлаждение</span>' +
        '<span class="mono" style="font-size:22px">' + hhmm(r.window_end - Date.now()) + "</span></div>" +
        '<div class="divider"></div><div class="hint"><span class="bar"></span><span>Начисление остановлено целиком. Окно возвращает к базе и снимает вину, но выше базы не поднимает.</span></div></section>';
    }
    return h + journalCard();
  }

  function timelineEvents() {
    const names = { scout: "Разведка", window: "Окно", focus: "Фокус", work: "Работа и дорога" };
    const ev = [];
    for (const x of S.sessions) {
      ev.push({ at: x.started_at, kind: names[x.type] || x.type, tail: fmtHm(x.duration_min * 60000),
        sub: x.type === "scout" ? (x.extended ? "продолжил" : "остановился") : x.type === "work" ? "рабочий день" : "" });
    }
    for (const x of S.interruptions) {
      ev.push({ at: x.started_at, kind: "Переключение", tail: fmtHm(x.duration_min * 60000),
        sub: (x.entry_charged ? "вход −" + S.config.entry_cost : "без входа") + (x.merged ? " · склейка" : "") });
    }
    for (const c of S.captures) ev.push({ at: c.created_at, kind: "Захват", tail: "", sub: c.text.slice(0, 60) });
    ev.sort((a, b) => (a.at < b.at ? 1 : -1));
    return ev;
  }

  function timeline(n) {
    const ev = timelineEvents().slice(0, n || 12);
    if (!ev.length) return '<p class="note">Пока пусто. События появятся здесь по мере работы.</p>';
    return '<div class="timeline">' + ev.map((x) =>
      '<div class="tl-item"><span class="tl-time">' + fmtTime(x.at) + "</span>" +
      '<span class="tl-what">' + esc(x.kind) + (x.sub ? "<small>" + esc(x.sub) + "</small>" : "") + "</span>" +
      '<span class="tl-dur">' + esc(x.tail) + "</span></div>").join("") + "</div>";
  }

  function avgFocus() {
    const wk = S.sessions.filter((s) => s.type === "focus" && Date.now() - Date.parse(s.started_at) < 7 * 864e5);
    if (!wk.length) return "— нет замеров";
    return Math.round(wk.reduce((a, s) => a + s.duration_min, 0) / wk.length) + " мин · " + wk.length + " подх.";
  }

  function clockHTML(t, live) {
    const p = String(t).split(":");
    return '<div class="clock' + (live ? " is-live" : "") + '">' +
      '<span class="clock-mm">' + (p[0] || "00") + '</span><span class="clock-ss">:' + (p[1] || "00") + "</span></div>";
  }

  function renderCapture() {
    const items = S.captures.slice().sort((a, b) => {
      const da = a.done_at ? 1 : 0, db = b.done_at ? 1 : 0;
      if (da !== db) return da - db;
      return a.created_at < b.created_at ? 1 : -1;
    });
    const done = items.filter((c) => c.done_at).length;
    return '<div class="stack">' +
      '<section class="card"><div class="label">внешняя память</div>' +
      '<h2 style="margin:var(--s2) 0 var(--s3)">Захват</h2>' +
      '<p class="note">Выгрузили — и держать в голове не нужно.</p>' +
      '<label for="capText">Что нужно не забыть</label>' +
      '<textarea id="capText" placeholder="Любая мысль или дело, без сроков и оценок"></textarea>' +
      '<div class="row" style="margin-top:var(--s3)"><button type="button" class="primary" data-act="capture">Выгрузить из головы</button></div></section>' +
      '<section class="card"><div class="between"><div><div class="label">в списке</div>' +
      '<div class="big">' + items.length + "<small>зап.</small></div></div>" +
      (done ? '<button type="button" class="link" data-act="capClear">Убрать отработанные</button>' : "") + "</div>" +
      '<div style="margin-top:var(--s3)">' + (items.length
        ? items.map((c) => '<div class="item"><div class="between">' +
            '<span' + (c.done_at ? ' style="text-decoration:line-through;color:var(--mute)"' : "") + ">" + esc(c.text) + "</span>" +
            '<button type="button" class="ghost sm" data-capdone="' + c.id + '">' + (c.done_at ? "Вернуть" : "Отметить") + "</button></div>" +
            '<div class="d">' + fmtDate(c.created_at) + " " + fmtTime(c.created_at) + "</div></div>").join("")
        : '<p class="note">Пока пусто. Одно касание кнопки «+» — и мысль выгружена.</p>') + "</div></section></div>";
  }

  function slider(group, key, label, val, prev, hint) {
    const id = group + "-" + key;
    const d = prev == null ? null : val - prev;
    const dtxt = d == null || d === 0 ? "" : (d > 0 ? "+" + d : String(d));
    return '<div class="sld">' +
      '<div class="sld-top"><label for="' + id + '">' + label + "</label>" +
        '<span class="sld-val"><b id="' + id + '-v">' + val + "</b>" +
        (dtxt ? '<small>' + dtxt + "</small>" : "") + "</span></div>" +
      '<input type="range" id="' + id + '" min="1" max="10" step="1" value="' + val + '" data-slider="' + group + ":" + key + '">' +
      '<div class="hintline" id="hint-' + id + '">' + (hint || "") + "</div>" +
    "</div>";
  }

  // ── подсказки из собранных данных ──
  function median(arr) {
    const a = (arr || []).filter((x) => typeof x === "number" && !isNaN(x)).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // Сводка по дням: утренние метки, время до первого дела, заряд в 21:00.
  function digestStats(from) {
    const all = S.runtime.days || {};
    const keys = Object.keys(all).filter((k) => {
      const t = Date.parse(k + "T00:00:00");
      return !isNaN(t) && t >= from;
    }).sort();
    const marks = [], starts = [], evenings = [];
    for (const k of keys) {
      const rec = all[k] || {};
      const noon = Date.parse(k + "T12:00:00");
      if (isNaN(noon)) continue;
      const wake = wakeMoment(noon);
      const h0 = new Date(wake).getHours();
      let mk = 0;
      for (let i = 0; i < 2; i++) {
        const h = h0 + i;
        if (h >= 0 && h < 24 && rec.m) mk += Number(rec.m[h]) || 0;
      }
      marks.push(mk);
      let first = null;
      for (const s of S.sessions || []) {
        if (s.type !== "focus" && s.type !== "work") continue;
        const t = Date.parse(s.started_at);
        if (isNaN(t) || localDayKey(t) !== k) continue;
        if (first == null || t < first) first = t;
      }
      if (first != null) starts.push(Math.round((first - wake) / 60000));
      if (rec.v21 != null) evenings.push(Number(rec.v21));
    }
    return {
      days: keys.length,
      marks: median(marks),
      initiativeMin: median(starts),
      evening: median(evenings)
    };
  }

  function cycleStats() {
    const cp = lastCP();
    const from = cp ? Date.parse(cp.date) : 0;
    const days = Math.max(1, Math.ceil((Date.now() - from) / 864e5));
    const intr = S.interruptions.filter((x) => Date.parse(x.started_at) >= from && x.entry_charged);
    const focus = S.sessions.filter((x) => x.type === "focus" && Date.parse(x.started_at) >= from);
    return {
      days,
      entriesPerDay: Math.round((intr.length / days) * 10) / 10,
      focusAvg: focus.length ? Math.round(focus.reduce((a, x) => a + x.duration_min, 0) / focus.length) : null,
      focusCount: focus.length,
      newsChecks: cp && cp.behaviors && cp.behaviors.news_checks != null ? Number(cp.behaviors.news_checks) : null,
      minutesToPhone: cp && cp.behaviors && cp.behaviors.minutes_to_phone != null ? Number(cp.behaviors.minutes_to_phone) : null,
      digest: digestStats(from)
    };
  }
  function suggestNewsReflex(n) { return n == null || isNaN(n) ? null : clamp(Math.round(1 + n * 0.6), 1, 10); }
  function suggestMorning(m) { if (m == null || isNaN(m)) return null; return m >= 60 ? 2 : m >= 30 ? 4 : m >= 15 ? 6 : m >= 5 ? 8 : 9; }
  function suggestUnstructured(e) { return e == null ? null : e >= 7 ? 9 : e >= 4 ? 7 : e >= 2 ? 5 : 3; }
  function suggestFocus(avg) { return avg == null ? null : avg >= 40 ? 8 : avg >= 20 ? 7 : avg >= 10 ? 5 : 3; }
  function suggestClarity(marks, sleep) {
    if (marks == null) return null;
    let s = marks <= 0 ? 8 : marks === 1 ? 7 : marks === 2 ? 6 : marks <= 4 ? 5 : 4;
    if (sleep != null && sleep < 0.85) s -= 1;
    return clamp(Math.round(s), 1, 10);
  }
  function suggestInitiative(min) {
    if (min == null) return null;
    return clamp(Math.round(min <= 20 ? 9 : min <= 40 ? 8 : min <= 60 ? 7 : min <= 90 ? 6 : min <= 150 ? 5 : 4), 1, 10);
  }
  function suggestEvening(v) {
    if (v == null) return null;
    return clamp(Math.round(v >= 18 ? 8 : v >= 14 ? 7 : v >= 10 ? 6 : v >= 6 ? 5 : 4), 1, 10);
  }

  function checksBlock() {
    const all = (S.checks || []).slice().sort((a, b) => (String(a.at || "") < String(b.at || "") ? 1 : -1));
    if (!all.length) return "";
    const shown = all.slice(0, 4);
    return '<section class="card"><div class="between"><div class="label">локальные чеки</div>' +
      '<span class="chip">' + all.length + " шт.</span></div>" +
      '<p class="note">Состояние на момент замера. Цикл не двигают и заряд не трогают.</p>' +
      '<div style="margin-top:var(--s2)">' + shown.map((c, i) => {
        const prev = shown[i + 1];
        const d = prev && prev.base != null && c.base != null ? round1(c.base - prev.base) : null;
        const dtxt = d == null || d === 0 ? "" : (d > 0 ? "+" : "") + d.toFixed(1);
        const sub = ["заряд " + (c.battery == null ? "—" : c.battery.toFixed(1) + "%")];
        if (c.note) sub.push(c.note.length > 60 ? c.note.slice(0, 60) + "…" : c.note);
        return '<div class="item"><div class="between">' +
          "<span>" + fmtDate(c.at) + " " + fmtTime(c.at) + " · " + (c.base == null ? "—" : c.base.toFixed(1) + "%") + "</span>" +
          (dtxt ? '<span class="chip">' + dtxt + " %</span>" : "") +
          '</div><div class="d">' + esc(sub.join(" · ")) + "</div></div>";
      }).join("") + "</div></section>";
  }

  function renderCheckpoint() {
    touchedSliders = new Set();
    const cps = S.checkpoints.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const last = cps[0], prev = cps[1];
    const quest = S.quests.find((q) => q.status === "active");
    const cur = last || {
      stats: { ram_clarity: 3, start_initiative: 2, focus_hold: 3, evening_resource: 2 },
      debuffs: { morning_scroll: 9, unstructured_avoid: 9, news_reflex: 8, task_paralysis: 8 },
      behaviors: { minutes_to_phone: 30, news_checks: 12 }, tags: [], note: ""
    };
    const prevStats = prev ? prev.stats : null;
    const prevDebuffs = prev ? prev.debuffs : null;

    const cs = cycleStats();
    const ds = cs.digest || { days: 0 };
    const sug = {
      ram_clarity: suggestClarity(ds.marks, sleepFactor()),
      start_initiative: suggestInitiative(ds.initiativeMin),
      focus_hold: suggestFocus(cs.focusAvg),
      evening_resource: suggestEvening(ds.evening),
      morning_scroll: suggestMorning(cs.minutesToPhone),
      news_reflex: suggestNewsReflex(cs.newsChecks),
      unstructured_avoid: suggestUnstructured(cs.entriesPerDay)
    };
    const sv = Object.assign({}, cur.stats);
    const dv = Object.assign({}, cur.debuffs);
    // Расчёт не может двигать стат больше чем на два пункта за период:
    // иначе ползунок становится эхом заряда, а не оценкой.
    const capShift = (next, was) => (next == null || was == null ? next : clamp(next, was - 2, was + 2));
    ["ram_clarity", "start_initiative", "focus_hold", "evening_resource"].forEach((k) => {
      const v = capShift(sug[k], cur.stats[k]);
      if (v != null) sv[k] = v;
    });
    ["morning_scroll", "news_reflex", "unstructured_avoid"].forEach((k) => { if (sug[k] != null) dv[k] = sug[k]; });
    const hints = {
      ram_clarity: ds.marks != null
        ? "из данных: " + Math.round(ds.marks) + " " + plural(Math.round(ds.marks), ["метка", "метки", "меток"]) + " за утро, по " + ds.days + " дн."
        : "мало данных — оцените сами",
      start_initiative: ds.initiativeMin != null
        ? "из данных: первый фокус через " + ds.initiativeMin + " мин после подъёма"
        : "мало данных — оцените сами",
      focus_hold: cs.focusCount ? "из данных: подход " + cs.focusAvg + " мин, их " + cs.focusCount : "нет замеров фокуса",
      evening_resource: ds.evening != null
        ? "из данных: в 21:00 — " + round1(ds.evening) + " %"
        : "мало данных — оцените сами",
      morning_scroll: cs.minutesToPhone != null ? "из данных: телефон через " + cs.minutesToPhone + " мин" : "нет данных",
      news_reflex: cs.newsChecks != null ? "из данных: " + cs.newsChecks + " проверок в день" : "нет данных",
      unstructured_avoid: "из данных: " + cs.entriesPerDay + " переключений в день"
    };

    let h = '<section class="card"><div class="between"><div><div class="label">цикл</div>' +
      '<div class="big">' + (cycleDay() == null ? "—" : cycleDay()) + '<small>день из ' + S.config.checkpoint_interval_days + "</small></div></div>" +
      (quest ? '<span class="chip"><span class="dot"></span>квест идёт</span>' : '<span class="chip">не начат</span>') + "</div>";
    if (quest) {
      h += '<div class="divider"></div><p style="margin-top:var(--s3)">' + esc(quest.hypothesis) + '</p>' +
        '<p class="note">объявлен ' + fmtDate(quest.declared_at) + "</p>" +
        '<div class="row" style="margin-top:var(--s3)"><button type="button" class="primary" data-verdict="worked">Сработало</button>' +
        '<button type="button" data-verdict="hard">Сложно</button><button type="button" data-verdict="no">Не подошло</button></div>';
    } else {
      h += '<div class="divider"></div><p class="note" style="margin-top:var(--s3)">Один эксперимент на цикл. Без него сравнение двух настроений не даёт знания.</p>' +
        '<label for="questText">Гипотеза на две недели</label>' +
        '<input id="questText" placeholder="Первые 40 минут работы без фонового звука">' +
        '<div class="row" style="margin-top:var(--s3)"><button type="button" data-act="questStart">Объявить квест</button></div>';
    }
    h += "</section>";

    h += checksBlock();

    h += '<section class="card"><div class="label">' + (last ? "точка сохранения" : "первая точка") + "</div>" +
      '<h2 style="margin:var(--s2) 0 var(--s3)">Ресурс</h2>' +
      '<p class="note">Состояние на сегодня, не оценка. Дельта — к прошлому чекпоинту. Шаг ползунка — 1.75 % базы.</p>' +
      Object.keys(STATS).map((k) => slider("stats", k, STATS[k], sv[k], prevStats ? prevStats[k] : null, hints[k] || "")).join("") +
      "</section>";

    h += '<section class="card"><div class="label">дебаффы</div>' +
      '<h2 style="margin:var(--s2) 0 var(--s3)">Что тянет вниз</h2>' +
      '<p class="note">Шаг ползунка — 0.75 % базы. Пометка «из данных» подставлена из журнала, её можно поправить.</p>' +
      Object.keys(DEBUFFS).map((k) => slider("debuffs", k, DEBUFFS[k], dv[k], prevDebuffs ? prevDebuffs[k] : null, hints[k] || "")).join("") +
      "</section>";

    h += '<section class="card"><div class="label">числовые прокси</div>' +
      '<h2 style="margin:var(--s2) 0 var(--s3)">Утро и новости</h2>' +
      '<div class="grid2">' +
        '<div><label for="behMin">Минут до первого телефона</label><input id="behMin" type="number" inputmode="numeric" value="' + (cur.behaviors && cur.behaviors.minutes_to_phone != null ? cur.behaviors.minutes_to_phone : "") + '"></div>' +
        '<div><label for="behNews">Проверок новостей за день</label><input id="behNews" type="number" inputmode="numeric" value="' + (cur.behaviors && cur.behaviors.news_checks != null ? cur.behaviors.news_checks : "") + '"></div>' +
      "</div></section>";

    h += '<section class="card"><div class="label">контекст</div>' +
      '<h2 style="margin:var(--s2) 0 var(--s3)">Что было вокруг</h2>' +
      '<div class="tags" id="tagBox">' + TAGS.map((t) => '<button type="button" class="tagchip" aria-pressed="false" data-tag="' + esc(t) + '">' + esc(t) + "</button>").join("") + "</div>" +
      '<label for="cpNote">Заметка</label><textarea id="cpNote">' + esc(cur.note || "") + "</textarea></section>";

    h += '<section class="card"><div class="label">новая база</div>' +
      '<div id="basePreview" style="margin-top:var(--s2)"><span class="big" id="basePreviewVal">—</span>' +
      '<div class="note" id="basePrevNote">до сохранения точки</div></div>' +
      '<div class="row" style="margin-top:var(--s4)"><button type="button" data-act="saveCheck">Локальный чек</button></div>' +
      '<p class="hintline">Запомнить состояние на сейчас. Цикл не сдвигает, заряд не обнуляет.</p>' +
      '<div class="row" style="margin-top:var(--s4)"><button type="button" class="primary" data-act="saveCP">Сохранить точку</button></div>' +
      '<p class="hintline">Полный чекпоинт: новая база, заряд с нуля, следующий день цикла.</p></section>';

    if (last && prev) {
      h += '<section class="card"><div class="between"><h2 style="margin:0">Патч-ноут</h2>' +
        '<span class="chip">' + esc(prev.version_tag) + " → " + esc(last.version_tag) + "</span></div>" +
        '<p class="note">' + fmtDate(prev.date) + " → " + fmtDate(last.date) + "</p>" +
        '<div class="patch">' + patchBody(patchNote(prev, last)) + "</div>" +
        (last.note ? '<div class="divider"></div><p class="note">Заметка периода: ' + esc(last.note) + "</p>" : "") + "</section>";
    }
    return h;
  }

  const STATS_DAYS = 14;

  function cap(s) {
    const t = String(s || "");
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  function localDayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function statsWindow(days) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const rows = [];
    for (let i = days - 1; i >= 0; i--) {
      const t = start.getTime() - i * 864e5, d = new Date(t);
      rows.push({
        key: localDayKey(t),
        label: String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0"),
        intr: 0, entry: 0, focus: 0, focusN: 0, work: 0, workN: 0, window: 0, scout: 0, marks: 0
      });
    }
    const map = new Map(rows.map((r) => [r.key, r]));
    const rowOf = (iso) => {
      const t = Date.parse(iso || "");
      return isNaN(t) ? null : map.get(localDayKey(t));
    };
    for (const x of S.interruptions || []) {
      const r = rowOf(x.started_at);
      if (!r) continue;
      r.intr++;
      if (x.entry_charged) r.entry += S.config.entry_cost;
    }
    for (const x of S.sessions || []) {
      const r = rowOf(x.started_at);
      if (!r) continue;
      const m = Number(x.duration_min) || 0;
      if (x.type === "focus") { r.focus += m; r.focusN++; }
      else if (x.type === "work") { r.work += m; r.workN++; }
      else if (x.type === "window") r.window++;
      else if (x.type === "scout") r.scout++;
    }
    for (const hk of S.runtime.hook_log || []) {
      if (hk.on !== true) continue;
      const r = rowOf(hk.at);
      if (r) r.marks++;
    }
    return rows;
  }

  function barRow(label, value, max, kind) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return '<div class="stat-row"><span class="stat-day">' + label + "</span>" +
      '<span class="stat-track"><span class="stat-fill' + (kind ? " stat-fill--" + kind : "") + '" style="width:' + pct.toFixed(1) + '%"></span></span>' +
      '<span class="stat-num">' + value + "</span></div>";
  }

  function hourProfileBlock() {
    const p = profileWindow(28);
    if (!p.days) return "";
    const max = Math.max(1, ...p.hours);
    let body = "";
    for (let h = 6; h <= 23; h++) {
      if (!p.hours[h] && h !== p.peak) continue;
      body += barRow(hh(h), p.hours[h], max, h === p.peak && p.hours[h] > 0 ? "warm" : "");
    }
    const ms = morningSplit();
    return '<section class="card"><div class="between"><div class="label">профиль</div>' +
      '<span class="chip">' + p.days + " дн.</span></div>" +
      '<h2 style="margin:var(--s2) 0 var(--s3)">Когда я это делаю</h2>' +
      '<p class="note">' + (p.days < 5
        ? "Данных пока мало: картина станет честной после пяти дней."
        : "Входов " + p.totalEntries + " за " + p.withEntries + " дн." +
          (p.perDay != null ? " · " + p.perDay + " в день" : "") +
          ". Пик — " + hh(p.peak) + ", " + p.hours[p.peak] + " шт.") + "</p>" +
      '<div class="stat" style="margin-top:var(--s3)">' + body + "</div>" +
      (ms ? '<p class="note" style="margin-top:var(--s3)">Дни с метками утром заканчивались на ' +
        Math.abs(ms.d).toFixed(1) + " пп " + (ms.d < 0 ? "ниже" : "выше") +
        " (" + ms.noisy + " против " + ms.calm + " дн.). Это совпадение, а не причина.</p>" : "") +
      "</section>";
  }

  function baseSpark(days) {
    const from = Date.now() - days * 864e5;
    const pts = [];
    for (const c of S.checkpoints || []) {
      if (c.base_battery != null && Date.parse(c.date) >= from) pts.push({ t: Date.parse(c.date), v: c.base_battery });
    }
    for (const c of S.checks || []) {
      if (c.base != null && Date.parse(c.at) >= from) pts.push({ t: Date.parse(c.at), v: c.base });
    }
    pts.sort((a, b) => a.t - b.t);
    if (pts.length < 2) return "";
    const vs = pts.map((p) => p.v);
    const lo = Math.min.apply(null, vs) - 2, hi = Math.max.apply(null, vs) + 2;
    const W = 300, H = 56, pad = 6;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const X = (t) => pad + (W - pad * 2) * ((t - t0) / Math.max(1, t1 - t0));
    const Y = (v) => H - pad - (H - pad * 2) * ((v - lo) / Math.max(0.1, hi - lo));
    const d = pts.map((p, i) => (i ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + '" fill="none" stroke="var(--lime)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  function renderStats() {
    const rows = statsWindow(STATS_DAYS);
    const tot = rows.reduce((a, r) => {
      a.intr += r.intr; a.entry += r.entry; a.focus += r.focus; a.focusN += r.focusN;
      a.work += r.work; a.workN += r.workN; a.window += r.window; a.scout += r.scout; a.marks += r.marks;
      return a;
    }, { intr: 0, entry: 0, focus: 0, focusN: 0, work: 0, workN: 0, window: 0, scout: 0, marks: 0 });

    let h = '<section class="card"><div class="between"><div class="label">статистика</div>' +
      '<span class="chip">' + STATS_DAYS + " дней</span></div>" +
      '<h2 style="margin:var(--s2) 0 var(--s3)">Что было на самом деле</h2>' +
      '<p class="note">Считается по журналу, а не по памяти. Пустой день — это отсутствие записей, а не ноль.</p></section>';

    if (!tot.intr && !tot.focusN && !tot.workN && !tot.marks && !tot.window && !tot.scout) {
      return h + '<section class="card"><div class="label">пока пусто</div>' +
        '<p class="note" style="margin-top:var(--s2)">Статистика появится, когда в журнале будут переключения, сессии фокуса или метки с датчика.</p></section>';
    }

    h += '<section class="card"><div class="label">итоги</div>' +
      '<div class="totals" style="margin-top:var(--s4)">' +
        '<div><div class="label">переключений</div><div class="big">' + tot.intr + "</div></div>" +
        '<div><div class="label">минут входа</div><div class="big">' + round1(tot.entry) + "</div></div>" +
        '<div><div class="label">фокус и работа</div><div class="big">' + round1((tot.focus + tot.work) / 60) + "<small>ч</small></div></div>" +
        '<div><div class="label">меток залипания</div><div class="big">' + tot.marks + "</div></div>" +
      "</div></section>";

    h += hourProfileBlock();

    const maxIntr = Math.max(1, ...rows.map((r) => r.intr));
    h += '<section class="card"><div class="between"><div class="label">переключения</div>' +
      '<span class="chip">' + tot.intr + " шт.</span></div>" +
      '<p class="note">Каждый вход стоит ' + S.config.entry_cost + " %. Входы ближе " + S.config.merge_gap_min + " минут считаются одним.</p>" +
      '<div class="stat" style="margin-top:var(--s3)">' +
      rows.map((r) => barRow(r.label, r.intr, maxIntr, "")).join("") + "</div></section>";

    const maxMarks = Math.max(1, ...rows.map((r) => r.marks));
    h += '<section class="card"><div class="between"><div class="label">метки</div>' +
      '<span class="chip">' + tot.marks + " шт.</span></div>" +
      '<p class="note">Срабатывания датчиков: ПК-правила и Ярлыки. Метка — это включение слота, а не минуты.</p>' +
      '<div class="stat" style="margin-top:var(--s3)">' +
      rows.map((r) => barRow(r.label, r.marks, maxMarks, "warm")).join("") + "</div></section>";

    const bySlot = new Map();
    for (const hk of S.runtime.hook_log || []) {
      if (hk.on === true) bySlot.set(hk.h, (bySlot.get(hk.h) || 0) + 1);
    }
    if (bySlot.size) {
      const list = Array.from(bySlot.entries()).sort((a, b) => b[1] - a[1]);
      const top = list[0][1];
      h += '<section class="card"><div class="label">по слотам</div>' +
        '<div class="dumbbell" style="margin-top:var(--s3)">' + list.map(([k, v]) =>
          '<div class="db-row"><div class="db-head"><span class="db-name">' + esc(cap(hookLabel(k))) + "</span>" +
          '<span class="db-val">' + v + "</span></div>" +
          '<div class="db-track"><span class="stat-fill ms" style="width:' + (v / top * 100).toFixed(1) + '%"></span></div></div>').join("") +
        "</div></section>";
    }

    const proto = [
      ["Окно 45 минут", tot.window, null],
      ["Разведка 5 минут", tot.scout, null],
      ["Сессии фокуса", tot.focusN, tot.focus],
      ["Рабочий день", tot.workN, tot.work]
    ].filter((r) => r[1] > 0);
    if (proto.length) {
      h += '<section class="card"><div class="between"><div class="label">протоколы</div>' +
        '<span class="chip">' + (tot.window + tot.scout + tot.focusN + tot.workN) + " шт.</span></div>" +
        '<div style="margin-top:var(--s2)">' + proto.map((r) =>
          '<div class="item"><div class="between"><span>' + r[0] + "</span>" +
          '<span class="stat-num">' + r[1] + " " + plural(r[1], ["раз", "раза", "раз"]) + "</span></div>" +
          (r[2] ? '<div class="d">' + Math.round(r[2]) + " мин всего</div>" : "") + "</div>").join("") +
        "</div></section>";
    }

    const spark = baseSpark(STATS_DAYS);
    const checksIn = (S.checks || []).filter((c) => c.base != null && Date.parse(c.at) >= Date.now() - STATS_DAYS * 864e5);
    if (spark || checksIn.length) {
      h += '<section class="card"><div class="between"><div class="label">база</div>' +
        '<span class="chip">' + (S.runtime.base == null ? "нет" : S.runtime.base + "%") + "</span></div>" +
        (spark ? '<div class="spark" style="margin-top:var(--s3)">' + spark + "</div>" : "") +
        '<p class="note">' + (checksIn.length ? "по " + checksIn.length + " " + plural(checksIn.length, ["локальному чеку", "локальным чекам", "локальным чекам"]) : "точек мало") +
        " · кривая калибровочная</p></section>";
    }
    return h;
  }

  function renderMirror() {
    const cps = S.checkpoints.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (cps.length < 2) {
      return '<section class="card"><div class="label">нужны две точки</div>' +
        '<h2 style="margin:var(--s2) 0 var(--s3)">Зеркало прошлого</h2>' +
        '<p class="note">Первая точка уже есть. Вторая — через две недели: только тогда станет видно, что именно сдвинулось.</p>' +
        '<div class="row" style="margin-top:var(--s4)"><button type="button" class="primary" data-go="checkpoint">Сделать вторую</button></div></section>';
    }
    const a = cps[0], b = cps[cps.length - 1];
    const ba = baseFrom(a) || 0, bb = baseFrom(b) || 0;
    const db = round1(bb - ba);
    const days = Math.max(1, Math.round((Date.parse(b.date) - Date.parse(a.date)) / 864e5));

    function row(l, x, y, max, up) {
      const d = y - x;
      const good = up ? d > 0 : d < 0;
      const dt = (d > 0 ? "+" : "") + d;
      return '<div class="db-row">' +
        '<div class="db-head"><span class="db-name">' + esc(l) + "</span>" +
        '<span class="db-val">' + x + " → " + y +
        (d === 0 ? "" : ' <b class="' + (good ? "db-good" : "db-bad") + '">' + dt + "</b>") +
        "</span></div>" +
        '<div class="db-track"><span class="db-prev" style="left:' + (x / max * 100).toFixed(1) + '%"></span>' +
        '<span class="db-cur" style="left:' + (y / max * 100).toFixed(1) + '%"></span></div>' +
        "</div>";
    }

    return '<section class="card"><div class="label">база заряда</div>' +
      '<div class="big ' + (db > 0 ? "big--lime" : db < 0 ? "" : "big--mute") + '" style="margin-top:var(--s2)">' +
        (db > 0 ? "+" : "") + db.toFixed(1) + '<small>%</small></div>' +
      '<p class="note" style="margin-top:var(--s3)">' + ba + "% → " + bb + "% · " +
        (days === 1 ? "день" : days + " дн.") + " между точками</p>" +
      '<div class="tabs-text" style="margin:var(--s4) 0 0"><span class="chip">' + fmtDate(a.date) + " → " + fmtDate(b.date) + "</span></div></section>" +

      '<section class="card"><div class="label">статы</div>' +
      '<h2 style="margin:var(--s2) 0 var(--s4)">Чем выше, тем лучше</h2>' +
      '<div class="dumbbell">' + Object.keys(STATS).map((k) => row(STATS[k], a.stats[k], b.stats[k], 10, true)).join("") + "</div></section>" +

      '<section class="card"><div class="label">дебаффы</div>' +
      '<h2 style="margin:var(--s2) 0 var(--s4)">Что тянет вниз</h2>' +
      '<div class="dumbbell">' + Object.keys(DEBUFFS).map((k) => row(DEBUFFS[k], a.debuffs[k], b.debuffs[k], 10, false)).join("") + "</div>" +
      '<p class="hintline" style="margin-top:var(--s4)">Мутная точка — тогда, лаймовая — сейчас. Цифра справа — сдвиг.</p></section>' +

      '<section class="card"><div class="label">патч-ноут</div>' +
      '<h2 style="margin:var(--s2) 0 var(--s3)">Что менялось в периоде</h2>' +
      '<div class="patch">' + patchBody(patchNote(a, b)) + "</div></section>" +
      (b.note ? '<section class="card"><div class="label">заметка</div>' +
        '<p class="dim" style="margin-top:var(--s2)">' + esc(b.note) + "</p></section>" : "");
  }

  // ─────────────────────────────── отрисовка ───────────────────────────────
  function renderTabs() {
    const box = $("#tabs");
    if (!box) return;
    if (!box.querySelector(".tabs__pill")) box.insertAdjacentHTML("afterbegin", '<i class="tabs__pill" aria-hidden="true"></i>');
    $$("#tabs button").forEach((b) => b.remove());
    box.insertAdjacentHTML("beforeend", TABS.map(([k, l]) =>
      '<button type="button" role="tab" aria-selected="' + (k === activeTab) + '" data-tab="' + k + '">' + l + "</button>").join(""));
    $$("#tabs button").forEach((b) => { b.onclick = () => goTab(b.dataset.tab); });
    movePill();
  }

  function movePill() {
    const box = $("#tabs");
    const pill = box && box.querySelector(".tabs__pill");
    const btn = box && box.querySelector('button[aria-selected="true"]');
    if (!pill || !btn) return;
    const first = pill.dataset.placed !== "1";
    if (first) pill.style.transition = "none";
    pill.style.width = btn.offsetWidth + "px";
    pill.style.transform = "translateX(" + btn.offsetLeft + "px)";
    if (first) {
      pill.dataset.placed = "1";
      void pill.offsetWidth;
      pill.style.transition = "";
    }
  }

  function goTab(k) {
    if (!k || k === activeTab || !TABS.some((t) => t[0] === k)) return;
    activeTab = k;
    render();
  }

  function initSwipe() {
    const BAN = "input,textarea,select,button,a,[contenteditable],.tabs,.modal.is-open,.modal__box";
    let st = null;
    document.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) { st = null; return; }
      if (e.target.closest(BAN)) { st = null; return; }
      st = { x: e.clientX, y: e.clientY, t: Date.now(), ok: false };
    }, { passive: true });
    document.addEventListener("pointermove", (e) => {
      if (!st) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) st.ok = true;
    }, { passive: true });
    document.addEventListener("pointerup", (e) => {
      const s = st; st = null;
      if (!s || !s.ok) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Date.now() - s.t > 900) return;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      const i = TABS.findIndex((t) => t[0] === activeTab);
      const j = dx < 0 ? i + 1 : i - 1;
      if (j < 0 || j >= TABS.length) return;
      buzz(6);
      goTab(TABS[j][0]);
    });
    document.addEventListener("pointercancel", () => { st = null; });
  }

  let painted = false;
  let lastTab = null;

  function render() {
    renderTabs();
    accrue();
    tick();
    const v = $("#view");
    if (!v) return;
    if (document.body) document.body.dataset.paint = painted ? "ready" : "first";
    const prev = lastTab;
    lastTab = activeTab;
    v.innerHTML = activeTab === "home" ? renderHome()
      : activeTab === "capture" ? renderCapture()
      : activeTab === "checkpoint" ? renderCheckpoint()
      : activeTab === "stats" ? renderStats()
      : renderMirror();
    if (prev != null && prev !== activeTab) {
      const from = TABS.findIndex((t) => t[0] === prev);
      const to = TABS.findIndex((t) => t[0] === activeTab);
      v.classList.remove("slide-l", "slide-r");
      void v.offsetWidth;
      v.classList.add(to > from ? "slide-l" : "slide-r");
    }
    bind();
    const fab = $("#fabBtn");
    if (fab) fab.classList.toggle("is-off", activeTab === "stats");
    if (activeTab === "checkpoint") updateBasePreview();
    updateLive();
    animateHero();
    startFx();
    toggledId = null;
    painted = true;
  }

  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  function animateHero() {
    if (activeTab !== "home") return;
    const el = $("#heroVal");
    const v = liveValue();
    if (!el || v == null) { lastHeroVal = v; return; }
    const from = lastHeroVal;
    lastHeroVal = v;
    if (from == null || Math.abs(v - from) < 0.005) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    flashDelta(v - from, el);
    const t0 = performance.now(), dur = 460;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.innerHTML = (from + (v - from) * e).toFixed(2) + "<span>%</span>";
      if (k < 1) requestAnimationFrame(step);
      else el.innerHTML = v.toFixed(2) + "<span>%</span>";
    };
    requestAnimationFrame(step);
  }

  function flashDelta(d, anchor) {
    const card = anchor.closest(".hero");
    if (!card) return;
    const old = card.querySelector(".delta");
    if (old) old.remove();
    const chip = document.createElement("span");
    chip.className = "delta" + (d > 0 ? " is-plus" : "");
    chip.textContent = (d > 0 ? "+" : "−") + Math.abs(d).toFixed(2) + " %";
    card.appendChild(chip);
    setTimeout(() => chip.remove(), 1200);
  }

  // трата на экране: искры у кромки уровня и целое число
  let fxOn = false, lastSpentInt = null;
  const fxDemo = (typeof location !== "undefined" && /[?&]fx=demo/.test(location.search || ""));
  function fxReduce() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  function batGeo() {
    if (activeTab !== "home") return null;
    const zone = $("#heroZone");
    const v = liveValue();
    if (!zone || !zone.isConnected || v == null) return null;
    const cells = zone.parentElement.querySelector(".bat-cells");
    if (!cells) return null;
    const cb = cells.getBoundingClientRect(), zb = zone.getBoundingClientRect();
    if (cb.width < 20) return null;
    return { zone: zone, cb: cb, zb: zb, v: v };
  }

  // угли тлеют внутри пилюли над заливкой, срез даёт overflow самой ячейки
  const EMBER_TONES = ["#ff7a6b", "#ff9f5a", "#ffc46b", "#f2e08a", "#ff6a58"];

  function emberSpot() {
    if (activeTab !== "home") return null;
    const cells = $("#batCells");
    const v = liveValue();
    if (!cells || v == null || cells.children.length !== 10) return null;
    const idx = clamp(Math.floor(clamp(v, 0, 99.99) / 10), 0, 9);
    const cell = cells.children[idx];
    if (!cell) return null;
    const cur = clamp(v - idx * 10, 0, 10) * 10;
    const free = 100 - cur;
    if (free < 12) return null;
    const top = 100 - cur;
    const band = Math.min(free, 52);
    const lo = Math.max(3, top - band);
    const hi = Math.min(96, top - 5);
    return hi > lo ? { cell: cell, lo: lo, hi: hi } : null;
  }

  let emberN = 0;

  function emitEmber() {
    const s = emberSpot();
    if (!s) return;
    const e = document.createElement("span");
    e.className = "ember";
    const tone = EMBER_TONES[(Math.random() * EMBER_TONES.length) | 0];
    const size = 3.2 + Math.random() * (Math.random() < 0.28 ? 5.4 : 3);
    const lane = (emberN++ % 5);
    e.style.left = (lane * 18 + 5 + Math.random() * 11).toFixed(1) + "%";
    e.style.top = (s.lo + Math.random() * (s.hi - s.lo)).toFixed(1) + "%";
    e.style.width = size.toFixed(1) + "px";
    e.style.height = size.toFixed(1) + "px";
    e.style.background = "radial-gradient(circle,#fff7e6 0%,#ffd9a0 34%," + tone + " 72%)";
    e.style.boxShadow = "0 0 " + Math.round(7 + size * 1.6) + "px " + tone + ",0 0 " + Math.round(3 + size * .6) + "px rgba(255,240,210,.9)";
    s.cell.appendChild(e);
    const dx = (Math.random() * 2 - 1) * 5, dy = -(6 + Math.random() * 20);
    const d = 1000 + Math.random() * 800;
    e.animate([
      { transform: "translate(0,2px) scale(.5)", opacity: 0 },
      { transform: "translate(" + (dx * .3) + "px," + (dy * .25) + "px) scale(1)", opacity: 1, offset: .2 },
      { transform: "translate(" + (dx * .7) + "px," + (dy * .6) + "px) scale(.95)", opacity: .85, offset: .55 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(.7)", opacity: 0 }
    ], { duration: d, easing: "cubic-bezier(.3,.5,.4,1)" });
    setTimeout(() => e.remove(), d + 80);
  }

  function spendChip(n) {
    const g = batGeo();
    if (!g || !n) return;
    const el = document.createElement("span");
    el.className = "bat-chip";
    el.textContent = "−" + n + " %";
    const edge = g.cb.left - g.zb.left + g.cb.width * clamp(g.v, 0, 100) / 100;
    el.style.left = clamp(g.v > 74 ? edge - 58 : edge + 10, 4, Math.max(4, g.zb.width - 58)).toFixed(1) + "px";
    el.style.top = (g.cb.top - g.zb.top + g.cb.height * 0.26).toFixed(1) + "px";
    g.zone.appendChild(el);
    el.animate([
      { transform: "translateY(4px) scale(.9)", opacity: 0 },
      { transform: "translateY(0) scale(1)", opacity: 1, offset: .16 },
      { transform: "translateY(-14px) scale(1)", opacity: .95, offset: .62 },
      { transform: "translateY(-26px) scale(.96)", opacity: 0 }
    ], { duration: 1700, easing: "cubic-bezier(.22,1,.36,1)" });
    setTimeout(() => el.remove(), 1780);
  }

  function fxLoop(demoLeft) {
    if (!fxOn) return;
    const r = rateOf(), home = activeTab === "home" && !document.hidden && !fxReduce();
    if (home && (r < -0.02 || demoLeft > 0)) {
      const power = Math.abs(r);
      emitEmber();
      if (power > 1.2 || demoLeft > 0) emitEmber();
      if (power > 2.4 || demoLeft > 0) emitEmber();
      if (demoLeft > 0 && demoLeft % 4 === 1) spendChip(1);
      setTimeout(() => fxLoop(demoLeft > 0 ? demoLeft - 1 : 0),
        demoLeft > 0 ? 520 : clamp(1500 / (1 + power * 1.1), 280, 1400));
    } else {
      setTimeout(() => fxLoop(demoLeft), home ? 700 : 2200);
    }
  }

  function startFx() {
    if (fxOn) return;
    if (fxReduce() || liveValue() == null) return;
    fxOn = true;
    fxLoop(fxDemo ? 40 : 0);
  }

  function updateLive() {
    const wc = $("#workClock");
    if (wc && workActive() && S.runtime.work.started_at) {
      wc.innerHTML = clockBig(Date.now() - Date.parse(S.runtime.work.started_at));
    }
    if (activeTab !== "home") return;

    const val = $("#heroVal"); if (!val) return;
    const fv = $("#formVal");
    if (fv) fv.innerHTML = Math.round(formNow() * 100) + "<small>%</small>";
    const ft = $("#formNowTxt");
    if (ft) ft.textContent = fmtClock(Date.now());
    const fmul = $("#formMul");
    if (fmul) fmul.textContent = formMult().toFixed(2);
    const fm = $("#formNow");
    if (fm) {
      const fx = formMarkerX(Date.now()).toFixed(1);
      fm.setAttribute("x1", fx); fm.setAttribute("x2", fx);
    }
    const v = liveValue(); if (v == null) return;
    val.innerHTML = v.toFixed(2) + "<span>%</span>";
    const sp = $("#heroSpent");
    const spent = Math.max(0, (S.runtime.base || 0) - v);
    if (sp) sp.textContent = "потрачено " + spent.toFixed(2) + " %";
    const spentInt = Math.floor(spent);
    if (lastSpentInt != null && spentInt > lastSpentInt) spendChip(spentInt - lastSpentInt);
    lastSpentInt = spentInt;
    const bd = $("#heroBadge"); if (bd) bd.innerHTML = statusBadge(v);
    const proj = projection(), ep = hoursToEvening();
    const pv = $("#heroProj"); if (pv) pv.textContent = proj.toFixed(1);
    const cells = $("#batCells");
    if (cells && cells.children.length === 10) {
      for (let i = 0; i < 10; i++) {
        const cur = clamp((v - i * 10) / 10, 0, 1) * 100;
        const fut = clamp((proj - i * 10) / 10, 0, 1) * 100;
        const wane = cells.children[i].children[0], deep = cells.children[i].children[1];
        if (wane) wane.style.height = cur.toFixed(1) + "%";
        if (deep) deep.style.height = fut.toFixed(1) + "%";
      }
    }
    const sb = $("#sparkBox");
    if (sb) sb.outerHTML = sparkBlock();
    checkLongSessions();
  }

  // ─────────────────────────────── действия ───────────────────────────────
  function tick() {
    const r = S.runtime, t = Date.now();
    let changed = false;
    if (r.window_end && t >= r.window_end) {
      S.sessions.push({ id: uuid(), updated_at: nowISO(), started_at: new Date(r.window_start).toISOString(), finished_at: nowISO(), type: "window", duration_min: Math.round((r.window_end - r.window_start) / 60000), completed: true });
      r.window_end = null; r.window_start = null; r.status = r.emergency ? "recovery" : "active";
      changed = true; toast("Окно закрыто");
    }
    if (r.scout_end && t >= r.scout_end) {
      r.scout_pending = { started_at: r.scout_start, end_at: r.scout_end };
      r.scout_end = null; r.scout_start = null;
      changed = true;
    }
    if (changed) save();
    return changed;
  }

  function startEpisode() {
    const r = S.runtime;
    if (r.drain_start) { toast("Эпизод уже идёт"); return; }
    const charged = chargeEntry();
    r.drain_start = Date.now(); r.pending_entry = charged; r.merged = !charged;
    save(); render();
    toast(charged ? "Вход −" + S.config.entry_cost + " % · пауза восстановления " + S.config.residue_min + " мин" : "Склейка с прошлым эпизодом, вход не списан");
  }

  function endEpisode() {
    const r = S.runtime;
    if (!r.drain_start) return;
    accrue();
    const dur = Math.max(1, Math.round((Date.now() - r.drain_start) / 60000));
    S.interruptions.push({ id: uuid(), updated_at: nowISO(), started_at: new Date(r.drain_start).toISOString(), ended_at: nowISO(), duration_min: dur, entry_charged: !!r.pending_entry, merged: !!r.merged });
    digestAdd("entry", 1, r.drain_start);
    r.drain_start = null; r.pending_entry = false; r.merged = false;
    save(); render(); toast("Эпизод записан: " + dur + " мин");
  }

  const WHEEL_MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  let sleepDraft = null;

  function wheelHTML(t) {
    const p = String(t || "00:00").split(":");
    const hh = clamp(Number(p[0]) || 0, 0, 23);
    const mm = clamp(Math.round((Number(p[1]) || 0) / 5) * 5, 0, 55);
    const col = (unit, arr, cur) => '<div class="wheel-col" data-unit="' + unit + '">' +
      arr.map((v) => '<button type="button" tabindex="-1" class="wheel-item' + (v === cur ? " is-on" : "") +
        '" data-v="' + v + '">' + String(v).padStart(2, "0") + "</button>").join("") + "</div>";
    return '<div class="wheel">' +
      col("h", Array.from({ length: 24 }, (_, i) => i), hh) +
      '<span class="wheel-colon">:</span>' +
      col("m", WHEEL_MINS, mm) + "</div>";
  }

  function openSleepSheet() {
    const o = sleepRef();
    sleepDraft = {
      from: (o && o.from) || S.config.sleep_from,
      to: (o && o.to) || S.config.sleep_to,
      edit: "from"
    };
    openModal({
      title: "Прошлая ночь",
      html: "<p>Отбой и подъём. Длительность считается сама и задаёт потолок дня.</p>" +
        '<div class="seg" role="group" aria-label="Какое время меняется">' +
          '<button type="button" data-sk="from" aria-pressed="true"><span>отбой</span><b class="mono">' + esc(sleepDraft.from) + "</b></button>" +
          '<button type="button" data-sk="to" aria-pressed="false"><span>подъём</span><b class="mono">' + esc(sleepDraft.to) + "</b></button>" +
        "</div>" +
        '<div class="sleeppick"><div class="wheel-band" aria-hidden="true"></div><div id="sleepWheel"></div></div>' +
        '<div class="sleep-dur" id="sleepDur"></div>' +
        '<input type="hidden" id="mf_from" value="' + esc(sleepDraft.from) + '">' +
        '<input type="hidden" id="mf_to" value="' + esc(sleepDraft.to) + '">',
      fields: [
        { key: "from", type: "custom" },
        { key: "to", type: "custom" },
        { key: "target", label: "Цель сна, часов", type: "number", value: S.config.sleep_target }
      ],
      after: bindSleepWheel,
      actions: [
        { label: "Отмена", onClick: closeModal },
        { label: "Сохранить", kind: "primary", onClick: saveSleep }
      ]
    });
  }

  function bindSleepWheel(box) {
    const slot = $("#sleepWheel", box), durBox = $("#sleepDur", box);

    const sync = () => {
      const f = $("#mf_from"), t = $("#mf_to");
      if (f) f.value = sleepDraft.from;
      if (t) t.value = sleepDraft.to;
      $$("[data-sk]", box).forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.sk === sleepDraft.edit));
        const val = $("b", b);
        if (val) val.textContent = sleepDraft[b.dataset.sk];
      });
      const h = sleepHours(sleepDraft.from, sleepDraft.to);
      if (durBox) durBox.innerHTML = fmtDur(h) + "<small>сна · потолок " +
        Math.round(sleepFactorFrom(h, S.config.sleep_target) * 100) + "%</small>";
    };

    const setPart = (unit, v) => {
      const p = String(sleepDraft[sleepDraft.edit]).split(":");
      if (unit === "h") p[0] = String(v).padStart(2, "0");
      else p[1] = String(v).padStart(2, "0");
      sleepDraft[sleepDraft.edit] = p[0] + ":" + p[1];
      sync();
    };

    const draw = () => {
      slot.innerHTML = wheelHTML(sleepDraft[sleepDraft.edit]);
      $$(".wheel-col", slot).forEach((c) => {
        const items = $$(".wheel-item", c);
        const ih = items[0] ? (items[0].getBoundingClientRect().height || 44) : 44;
        const idx = items.findIndex((x) => x.classList.contains("is-on"));
        c.scrollTop = Math.max(0, idx) * ih;
        let timer = null;
        c.onscroll = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            const i = clamp(Math.round(c.scrollTop / ih), 0, items.length - 1);
            items.forEach((x, n) => x.classList.toggle("is-on", n === i));
            setPart(c.dataset.unit, Number(items[i].dataset.v));
          }, 110);
        };
        items.forEach((x, n) => {
          x.onclick = () => {
            items.forEach((y, k) => y.classList.toggle("is-on", k === n));
            c.scrollTop = n * ih;
            setPart(c.dataset.unit, Number(x.dataset.v));
          };
        });
      });
    };

    $$("[data-sk]", box).forEach((b) => {
      b.onclick = () => { sleepDraft.edit = b.dataset.sk; draw(); };
    });
    draw();
    sync();
  }

  function saveSleep(v) {
    const norm = (s, fb) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
      if (!m) return fb;
      return String(clamp(Number(m[1]), 0, 23)).padStart(2, "0") + ":" + String(clamp(Number(m[2]), 0, 59)).padStart(2, "0");
    };
    const from = norm(v.from, S.config.sleep_from), to = norm(v.to, S.config.sleep_to);
    if (sleepHours(from, to) <= 0) { toast("Отбой и подъём совпадают — длительность не считается"); return; }
    S.config.sleep_from = from;
    S.config.sleep_to = to;
    S.config.sleep_target = clamp(Number(v.target) || 7.5, 4, 12);
    S.runtime.sleep_last = { from: from, to: to, at: nowISO() };
    S.runtime.sleep_override = null;
    save(); closeModal(); render();
    toast("Сон " + fmtDur(lastNightHours()) + " · потолок " + Math.round(sleepFactor() * 100) + "%");
  }


  function openCaptureSheet() {
    openModal({
      title: "Захват мысли",
      html: "<p>Выгрузите и забудьте. Держать в голове не нужно.</p>",
      fields: [{ key: "text", label: "Мысль или дело", type: "textarea", value: "" }],
      actions: [
        { label: "Отмена", onClick: closeModal },
        { label: "Сохранить", kind: "primary", onClick: (v) => {
            const t = (v.text || "").trim();
            if (!t) { toast("Пустая запись"); return; }
            S.captures.push({ id: uuid(), updated_at: nowISO(), created_at: nowISO(), text: t, done_at: null });
            save(); closeModal(); render(); toast("Записано");
          } }
      ]
    });
  }

  function openDataSheet() {
    openModal({
      title: "Данные и синхронизация",
      html: "<p>Всё хранится в этом браузере. Перенос между устройствами — файлом, со слиянием по записям.</p>" +
        '<div class="hint"><span class="bar"></span><span>Чекпоинтов: ' + S.checkpoints.length +
        " · записей: " + S.captures.length + " · событий: " + (S.sessions.length + S.interruptions.length) + "</span></div>",
      actions: [
        { label: "Экспорт", onClick: () => exportFile() },
        { label: "Импорт", onClick: () => { closeModal(); const f = $("#impFile"); if (f) f.click(); } },
        { label: "Синхронизация", onClick: () => { closeModal(); openSyncSheet(); } },
        { label: "Диагностика", onClick: () => { closeModal(); showDiag(); } },
        { label: "Закрыть", kind: "primary", onClick: closeModal }
      ]
    });
  }

  function act(name) {
    const r = S.runtime;
    switch (name) {
      case "scout":
        r.scout_start = Date.now(); r.scout_end = Date.now() + S.config.scout_min * 60000;
        buzz(10); save(); render(); toast("Разведка: " + S.config.scout_min + " мин"); break;
      case "window": {
        if (r.window_day !== todayKey()) { r.window_day = todayKey(); r.window_count = 0; }
        r.window_count++;
        r.window_start = Date.now(); r.window_end = Date.now() + S.config.legit_window_min * 60000;
        r.status = "cooling"; buzz(10); save(); render();
        toast(r.window_count > S.config.legit_window_limit ? "Окно сверх лимита: фиксируется как автопилот" : "Окно открыто");
        break;
      }
      case "focus":
        if (!r.focus_start) { r.focus_start = Date.now(); save(); render(); return; }
        {
          const dur = Math.round((Date.now() - r.focus_start) / 60000);
          S.sessions.push({ id: uuid(), updated_at: nowISO(), started_at: new Date(r.focus_start).toISOString(), finished_at: nowISO(), type: "focus", duration_min: dur, completed: true });
          digestAdd("focus", dur, r.focus_start);
          r.focus_start = null; r.last_work_end = nowISO(); save(); render(); toast("Подход: " + dur + " мин");
        }
        break;
      case "switch": startEpisode(); break;
      case "return": endEpisode(); break;
      case "manualInt":
        openModal({
          title: "Переключение задним числом",
          html: "<p>Сколько минут вы были вне работы? Любое значение.</p>",
          fields: [{ key: "min", label: "Минут", type: "number", value: "7" }],
          actions: [
            { label: "Отмена", onClick: closeModal },
            { label: "Записать", kind: "primary", onClick: (v) => {
                const m = Number(v.min);
                if (!m || m <= 0) { toast("Нужна длительность"); return; }
                const charged = chargeEntry();
                S.interruptions.push({ id: uuid(), updated_at: nowISO(), started_at: new Date(Date.now() - m * 60000).toISOString(), ended_at: nowISO(), duration_min: m, entry_charged: charged, merged: !charged });
                digestAdd("entry", 1, Date.now() - m * 60000);
                save(); closeModal(); render();
                toast("Записано " + m + " мин, вход " + (charged ? "−" + S.config.entry_cost + " %" : "не списан"));
              } }
          ]
        });
        break;
      case "work":
        if (!r.work.active) {
          r.work.active = true; r.work.started_at = nowISO(); r.work.updated_at = nowISO(); save(); render();
          toast("Рабочий день начат · тяжесть " + (r.work.weight || 8));
        } else {
          const dur = Math.round((Date.now() - Date.parse(r.work.started_at)) / 60000);
          S.sessions.push({ id: uuid(), updated_at: nowISO(), started_at: r.work.started_at, finished_at: nowISO(), type: "work", duration_min: dur, completed: true });
          digestAdd("work", dur, Date.parse(r.work.started_at));
          r.work.active = false; r.work.started_at = null; r.work.updated_at = nowISO(); r.last_work_end = nowISO();
          save(); render(); toast("Рабочий день закончен: " + round1(dur / 60) + " ч");
        }
        break;
      case "workWeight":
        openModal({
          title: "Вес рабочего дня",
          html: "<p>Насколько работа и дорога тратят ресурс, от 1 до 10.</p>",
          fields: [{ key: "w", label: "Вес", type: "number", value: r.work.weight || 8 }],
          actions: [
            { label: "Отмена", onClick: closeModal },
            { label: "Сохранить", kind: "primary", onClick: (v) => { r.work.weight = clamp(Number(v.w) || 8, 1, 10); r.work.updated_at = nowISO(); save(); closeModal(); render(); } }
          ]
        });
        break;
      case "microPause":
        if (r.pause_day !== todayKey()) { r.pause_day = todayKey(); r.pause_count = 0; }
        if (r.pause_count >= S.config.micro_pause_limit) { toast("Лимит микропауз на сегодня: " + S.config.micro_pause_limit); return; }
        if (!chargeBattery(-S.config.micro_pause)) return;
        buzz(10);
        r.pause_count++; save(); render();
        toast("Микропауза +" + S.config.micro_pause + " % · " + r.pause_count + " из " + S.config.micro_pause_limit);
        break;
      case "emergency":
        r.emergency = !r.emergency; r.status = r.emergency ? "recovery" : "active";
        save(); render(); toast(r.emergency ? "Режим восстановления включён" : "Обычный режим"); break;
      case "capture": {
        const el = $("#capText"), t = el ? el.value.trim() : "";
        if (!t) { toast("Пустая запись"); return; }
        S.captures.push({ id: uuid(), updated_at: nowISO(), created_at: nowISO(), text: t, done_at: null });
        save(); render(); toast("Записано"); break;
      }
      case "capClear": S.captures = S.captures.filter((c) => !c.done_at); save(); render(); break;
      case "questStart": {
        const el = $("#questText"), t = el ? el.value.trim() : "";
        if (!t) { toast("Опишите гипотезу"); return; }
        const last = lastCP();
        S.quests.push({ id: uuid(), updated_at: nowISO(), declared_at: nowISO(), checkpoint_from: last ? last.id : null, hypothesis: t, status: "active", closed_at: null });
        save(); render(); toast("Квест объявлен"); break;
      }
      case "saveCP": saveCheckpoint(); break;
      case "saveCheck": saveCheck(); break;
      case "export": exportFile(); break;
      case "seed": seed(); break;
      case "diag": showDiag(); break;
      case "restoreBackup": {
        const bk = readKey(BACKUP_KEY);
        if (!bk) { toast("Резервная копия не найдена"); return; }
        S = mergeStates(S, bk); save(); render();
        toast("Копия восстановлена: " + S.checkpoints.length + " " + plural(S.checkpoints.length, CP)); break;
      }
    }
  }

  function applySuggestion(key, val, hint) {
    const id = key.replace(":", "-");
    const hintEl = $("#hint-" + id);
    if (hintEl && hint) hintEl.textContent = hint;
    if (val == null || touchedSliders.has(key)) return;
    const el = $("#" + id);
    if (!el) return;
    el.value = val;
    const out = $("#" + id + "-v");
    if (out) {
      const prev = out.dataset.prev ? Number(out.dataset.prev) : null;
      const d = prev == null ? null : val - prev;
      const dtxt = d == null ? "" : (d > 0 ? " (+" + d + ")" : d < 0 ? " (" + d + ")" : " (=)");
      out.innerHTML = val + "<small>" + dtxt + "</small>";
    }
    updateBasePreview();
  }

  function updateBasePreview() {
    const el = $("#basePreviewVal");
    if (!el) return;
    const stats = {}, debuffs = {};
    $$("[data-slider]").forEach((s) => {
      const [g, k] = s.dataset.slider.split(":");
      (g === "stats" ? stats : debuffs)[k] = Number(s.value);
    });
    const nb = baseFrom({ stats, debuffs });
    const old = S.runtime.base;
    const d = old != null && nb != null ? nb - old : null;
    el.textContent = nb == null ? "—" : nb.toFixed(1) + "%";
    const note = $("#basePrevNote");
    if (note) {
      note.textContent = d == null
        ? "первая база цикла: " + (old != null ? "было " + old + "%" : "нет прошлой точки")
        : (d > 0 ? "+" : "") + d.toFixed(1) + " % к базе" + (old != null ? " " + old + "%" : "");
    }
  }

  function readCheckForm() {
    const stats = {}, debuffs = {};
    $$("[data-slider]").forEach((el) => {
      const [g, k] = el.dataset.slider.split(":");
      (g === "stats" ? stats : debuffs)[k] = Number(el.value);
    });
    const tags = $$('[data-tag][aria-pressed="true"]').map((t) => t.dataset.tag);
    const noteEl = $("#cpNote");
    const beh = {};
    const m = $("#behMin"), n = $("#behNews");
    if (m && m.value) beh.minutes_to_phone = Number(m.value);
    if (n && n.value) beh.news_checks = Number(n.value);
    return { stats, debuffs, behaviors: beh, tags, note: noteEl ? noteEl.value.trim() : "" };
  }

  function saveCheckpoint() {
    const f = readCheckForm();
    const cp = {
      id: uuid(), updated_at: nowISO(), version_tag: "v1." + S.checkpoints.length, date: nowISO(),
      stats: f.stats, debuffs: f.debuffs, behaviors: f.behaviors, tags: f.tags, note: f.note,
      quest_id: (S.quests.find((q) => q.status === "active") || {}).id || null
    };
    cp.base_battery = baseFrom(cp);
    S.checkpoints.push(cp);
    S.runtime.base = cp.base_battery;
    S.runtime.battery = cp.base_battery;
    S.runtime.battery_at = nowISO();
    S.runtime.cp_at = cp.date;
    S.runtime.emergency = false;
    S.runtime.status = S.runtime.window_end ? "cooling" : "active";
    save();
    activeTab = "mirror"; render();
    toast("Точка сохранения: база " + cp.base_battery + "%");
  }

  function saveCheck() {
    const f = readCheckForm();
    if (!Object.keys(f.stats).length) { toast("Нет данных формы"); return; }
    const at = nowISO();
    const check = {
      id: uuid(), updated_at: at, at: at,
      stats: f.stats, debuffs: f.debuffs, behaviors: f.behaviors, tags: f.tags, note: f.note,
      base: baseFrom(f), battery: S.runtime.battery
    };
    S.checks.push(check);
    if (S.checks.length > 200) S.checks = S.checks.slice(-200);
    save();
    render();
    toast("Чек записан: " + (check.base == null ? "—" : check.base + "%") + " · цикл не сдвинут");
  }

  function seed() {
    const cp = {
      id: uuid(), updated_at: nowISO(), version_tag: "v1.0", date: nowISO(),
      stats: { ram_clarity: 3, start_initiative: 2, focus_hold: 3, evening_resource: 2 },
      debuffs: { morning_scroll: 9, unstructured_avoid: 9, news_reflex: 8, task_paralysis: 8 },
      behaviors: { minutes_to_phone: 5, news_checks: 14 }, tags: ["Ремонт", "Высокий фоновый шум"],
      note: "Стартовый профиль: утро начинается с новостей, днём фон, вечером залипание перед ремонтом."
    };
    cp.base_battery = baseFrom(cp);
    S.checkpoints = [cp];
    S.runtime.base = cp.base_battery; S.runtime.battery = cp.base_battery; S.runtime.battery_at = nowISO(); S.runtime.cp_at = cp.date;
    save(); render(); toast("Стартовый профиль: " + cp.base_battery + "%");
  }

  function checkLongSessions() {
    if (modalCleanup) return;
    const soft = Number(S.config.session_soft_min) || 30;
    if (!S.runtime.warned) S.runtime.warned = {};
    for (const s of S.slots) {
      if (!s.active || s.kind !== "drain") continue;
      const m = slotMinutes(s.id);
      if (m > soft && !S.runtime.warned[s.id]) {
        S.runtime.warned[s.id] = true; save();
        openModal({
          title: "Всё ещё смотришь?",
          html: "<p>«" + esc(s.title) + "» включён уже " + Math.round(m) + " минут. После получаса непрерывного потребления модель считает минуту дороже: в исследованиях именно на этом рубеже пропадает выгода от подготовки к задаче.</p>",
          actions: [
            { label: "Да, продолжаю", onClick: closeModal },
            { label: "Выключить", kind: "primary", onClick: () => {
                s.active = false; s.updated_at = nowISO();
                delete S.runtime.slot_on[s.id];
                const rec = startRecovery(s);
                save(); closeModal(); render();
                toast("Слот выключен" + (rec ? " · восстановление " + S.config.recovery_min + " мин" : ""));
              } }
          ]
        });
        return;
      }
    }
  }

  function openEpisodeDialog(slotId) {
    const s = S.slots.find((x) => x.id === slotId);
    if (!s) return;
    if (s.kind !== "drain") { editSlot(slotId); return; }
    openModal({
      title: "Записать эпизод",
      html: "<p>Сколько минут вы были в «" + esc(s.title) + "»? Вход и объём спишутся сразу, слот останется выключенным.</p>",
      fields: [{ key: "min", label: "Минут", type: "number", value: "5" }],
      actions: [
        { label: "Отмена", onClick: closeModal },
        { label: "Записать", kind: "primary", onClick: (v) => {
            const m = Number(v.min);
            if (!m || m <= 0) { toast("Нужна длительность"); return; }
            let entry = 0;
            if (s.mode !== "ambient" && chargeEntry()) entry = S.config.entry_cost;
            const pp = S.config.drain_coef * (Number(s.weight) || 0) * drainMult() * (m / 60);
            if (pp > 0) chargeBattery(pp);
            save(); closeModal(); render();
            toast("Эпизод " + m + " мин · " + (entry ? "вход −" + entry + " · " : "") + "объём −" + pp.toFixed(2) + " %");
          } }
      ]
    });
  }

  function editSlot(id) {
    const s = S.slots.find((x) => x.id === id); if (!s) return;
    const fields = [
      { key: "title", label: "Название", value: s.title },
      { key: "trigger", label: "Триггер", value: s.trigger },
      { key: "weight", label: "Вес 0–10", type: "number", value: s.weight }
    ];
    if (s.kind === "drain") {
      fields.push({ key: "mode", label: "Как используется", type: "select", value: s.mode || "capture",
        options: [
          { v: "capture", l: "Захват внимания — за вход списывается " + S.config.entry_cost + " %" },
          { v: "ambient", l: "Фон — только объём, без входа" }
        ] });
    }
    fields.push({ key: "hook", label: "Метки автоматизации", value: s.hook || "" });
    const lr = slotLive(s);
    const rateTxt = Math.abs(lr) < 0.005 ? "0.00" : (lr > 0 ? "+" : "−") + Math.abs(lr).toFixed(2);
    openModal({
      title: "Настроить слот",
      html: '<p class="note">Сейчас слот даёт <b>' + rateTxt + " %/ч</b>" +
        (s.active ? "" : " — выключен") + "</p>",
      fields,
      actions: [
        { label: "Отмена", onClick: closeModal },
        { label: "Записать эпизод", onClick: () => { closeModal(); openEpisodeDialog(id); } },
        { label: "Сохранить", kind: "primary", onClick: (v) => {
            s.title = (v.title || s.title).trim();
            s.trigger = (v.trigger || s.trigger).trim();
            s.weight = clamp(Number(v.weight) || 0, 0, 10);
            if (s.kind === "drain" && (v.mode === "capture" || v.mode === "ambient")) s.mode = v.mode;
            s.hook = String(v.hook || "").trim().toLowerCase();
            s.updated_at = nowISO();
            save(); closeModal(); render();
          } }
      ]
    });
  }

  function replaceSlot(drainId) {
    const drain = S.slots.find((x) => x.id === drainId);
    const cands = S.slots.filter((x) => x.kind === "stab");
    openModal({
      title: "Чем заменить",
      html: "<p>Выберите стабилизатор вместо «" + esc(drain.title) + "».</p>" +
        cands.map((c, i) => '<label for="rp' + i + '" style="text-transform:none;font-size:15px;color:var(--txt);display:flex;align-items:center;gap:8px;min-height:44px">' +
          '<input type="radio" name="rp" id="rp' + i + '" value="' + i + '" style="width:20px;min-height:20px"' + (i === 0 ? " checked" : "") + ">" +
          esc(c.title) + (c.replaces ? " (занят)" : "") + "</label>").join(""),
      actions: [
        { label: "Отмена", onClick: closeModal },
        { label: "Заменить", kind: "primary", onClick: () => {
            const sel = document.querySelector('input[name="rp"]:checked');
            if (!sel) return;
            const s = cands[Number(sel.value)];
            const before = projectionRaw();
            if (s.replaces && s.replaces !== drainId) { const o = S.slots.find((x) => x.id === s.replaces); if (o) o.active = true; }
            drain.active = false;
            s.replaces = drainId; s.active = true;
            drain.updated_at = nowISO(); s.updated_at = nowISO();
            save(); closeModal(); render();
            const after = projectionRaw();
            toast("Замена: " + s.title + projDelta(before, after));
          } }
      ]
    });
  }

  function storageReport() {
    const rows = [];
    for (const k of [KEY].concat(LEGACY, [BACKUP_KEY])) {
      let raw = null;
      try { raw = localStorage.getItem(k); } catch (e) { raw = null; }
      if (!raw) { rows.push(k + " — нет"); continue; }
      try {
        const p = JSON.parse(raw);
        rows.push(k + " — " + Math.round(raw.length / 1024) + " КБ · чекпоинтов " + (p.checkpoints || []).length +
          " · записей " + (p.captures || []).length + " · база " + (p.runtime && p.runtime.base != null ? p.runtime.base + "%" : "нет"));
      } catch (e) { rows.push(k + " — файл повреждён"); }
    }
    rows.push("");
    rows.push("запись: " + (writesBlocked ? "заблокирована защитой " + writesBlocked + " раз (пустое состояние не затирает данные)" : "обычная"));
    rows.push("ошибки чтения: " + (readErrors.length ? "\n  " + readErrors.join("\n  ") : "нет"));
    rows.push("хранилище закреплено: " + (persistedFlag === null ? "неизвестно" : persistedFlag ? "да" : "нет"));
    rows.push("сборка: " + BUILD);
    return rows.join("\n");
  }

  function showDiag() {
    openModal({
      title: "Диагностика хранилища",
      html: "<p class=\"note\">Что лежит в памяти браузера прямо сейчас.</p>" +
        "<pre class=\"mono\" style=\"white-space:pre-wrap;font-size:13px;color:var(--dim);margin:0\">" + esc(storageReport()) + "</pre>",
      actions: [{ label: "Закрыть", kind: "primary", onClick: closeModal }]
    });
  }

  function stateForCloud() {
    const copy = JSON.parse(JSON.stringify(S));
    if (copy.sync) { copy.sync.ghToken = ""; copy.sync.token = ""; copy.sync.clientId = ""; }
    return copy;
  }

  function exportFile() {
    S.meta.last_updated = nowISO();
    const blob = new Blob([JSON.stringify(stateForCloud(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "energo-terminal-" + todayKey() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast("Файл сохранён");
  }

  function mergeStates(a, b) {
    const out = JSON.parse(JSON.stringify(a));
    const skew = (((b.sync && b.sync.clock_offset) || 0) - ((a.sync && a.sync.clock_offset) || 0));
    const at = (iso, shift) => (Date.parse(iso || 0) || 0) + (shift || 0);
    for (const key of ["checkpoints", "checks", "quests", "captures", "sessions", "interruptions"]) {
      const map = new Map();
      for (const r of out[key] || []) map.set(r.id, r);
      for (const r of b[key] || []) {
        const cur = map.get(r.id);
        if (!cur) { map.set(r.id, r); continue; }
        if (at(r.updated_at, skew) > at(cur.updated_at, 0)) map.set(r.id, r);
      }
      out[key] = Array.from(map.values());
    }
    const newest = (arr, shift) => Math.max(0, ...(arr || []).map((s) => at(s.updated_at, shift)));
    out.slots = newest(b.slots, skew) > newest(a.slots, 0) ? b.slots : a.slots;
    out.config = Object.assign({}, a.config, b.config);
    // Состояние дня берём целиком у того устройства, которое менялось позже:
    // иначе заряд считается по разным входным данным (slot_on, утро, сон) и расходится.
    const ra = at((a.runtime && a.runtime.updated_at) || a.runtime.battery_at, 0);
    const rb = at((b.runtime && b.runtime.updated_at) || b.runtime.battery_at, skew);
    const pick = rb > ra ? b.runtime : a.runtime;
    const samples = (a.runtime.samples || []).slice();
    out.runtime = Object.assign({}, a.runtime, JSON.parse(JSON.stringify(pick)));
    out.runtime.samples = samples;
    out.runtime.updated_at = pick.updated_at || a.runtime.updated_at;
    // Заряд — отдельно от остального runtime: побеждает не «кто позже записал»,
    // а тот снимок, у которого свежее опорная точка battery_at.
    const ba = at(a.runtime.battery_at, 0);
    const bb = at(b.runtime.battery_at, skew);
    if (bb > ba) { out.runtime.battery = b.runtime.battery; out.runtime.battery_at = b.runtime.battery_at; }
    const wa = at(a.runtime.work && a.runtime.work.updated_at, 0);
    const wb = at(b.runtime.work && b.runtime.work.updated_at, skew);
    if (wb > wa) {
      out.runtime.work = JSON.parse(JSON.stringify(b.runtime.work));
    }
    const ea = at(a.runtime.last_entry_at, 0);
    const eb = at(b.runtime.last_entry_at, skew);
    if (eb > ea) {
      out.runtime.last_entry_at = b.runtime.last_entry_at;
      out.runtime.residue_until = b.runtime.residue_until;
    }
    const cpsAll = (out.checkpoints || []).slice().sort((x, y) => (String(x.date || "") < String(y.date || "") ? -1 : 1));
    const cpNew = cpsAll[cpsAll.length - 1];
    if (cpNew && cpNew.base_battery != null && at(cpNew.date, 0) > at(out.runtime.cp_at, 0)) {
      out.runtime.base = cpNew.base_battery;
      out.runtime.cp_at = cpNew.date;
      // База чекпоинта подхватывается только как опора на будущее.
      // Переякоревать заряд задним числом нельзя: иначе пересчёт от старой
      // даты выдумывает сутки расхода (22 % на 25.11 → −0.69 % на 26.11).
      if (at(cpNew.date, 0) > at(out.runtime.battery_at, 0)) {
        out.runtime.battery = cpNew.base_battery;
        out.runtime.battery_at = cpNew.date;
      }
    }
    return migrate(out);
  }

  function importFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let data;
      try {
        data = JSON.parse(rd.result);
        if (!data.meta || !Array.isArray(data.checkpoints)) throw new Error("не тот формат файла");
      } catch (err) {
        openModal({
          title: "Файл не читается",
          html: "<p>" + esc(err.message) + ". Проверьте, что это экспорт из этого приложения.</p>",
          actions: [{ label: "Понятно", kind: "primary", onClick: closeModal }]
        });
        return;
      }
      openModal({
        title: "Импорт данных",
        html: "<p>В файле " + data.checkpoints.length + " " + plural(data.checkpoints.length, CP) + " и " + (data.captures || []).length + " " + plural((data.captures || []).length, CAP) + ". " +
          "Слияние сохранит и текущие данные, и данные из файла: при совпадении записей останется более свежая версия.</p>" +
          '<p class="note">Замена удалит текущие данные без возможности отмены.</p>',
        actions: [
          { label: "Отмена", onClick: closeModal },
          { label: "Слить", kind: "primary", onClick: () => { S = mergeStates(S, data); save(); closeModal(); render(); toast("Слито: " + S.checkpoints.length + " " + plural(S.checkpoints.length, CP)); } },
          { label: "Заменить", kind: "danger", onClick: () => { S = migrate(data); save(); closeModal(); render(); toast("Заменено: " + S.checkpoints.length + " " + plural(S.checkpoints.length, CP)); } }
        ]
      });
    };
    rd.readAsText(f);
    e.target.value = "";
  }

  // ── синхронизация через Яндекс.Диск ──
  const YD_API = "https://cloud-api.yandex.net/v1/disk";
  function ydFile() { return "app:/energo-terminal.json"; }
  function ydHeaders() { return { Authorization: "OAuth " + S.sync.token }; }

  async function ydDownload() {
    const r = await fetch(YD_API + "/resources/download?path=" + encodeURIComponent(ydFile()), { headers: ydHeaders() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("Диск ответил " + r.status);
    const j = await r.json();
    const urls = [j.href];
    try {
      const u = new URL(j.href);
      if (u.searchParams.has("direct_zip_experiment")) {
        u.searchParams.delete("direct_zip_experiment");
        urls.push(u.toString());
      }
    } catch (e) { /* ссылка нестандартная — пробуем как есть */ }
    let lastErr = null;
    for (const u of urls) {
      try {
        const f = await fetch(u);
        if (!f.ok) throw new Error("файл не скачался: " + f.status);
        return await f.text();
      } catch (e) { lastErr = e; }
    }
    throw new Error("не удалось скачать файл: " + (lastErr && lastErr.message ? lastErr.message : "сеть"));
  }

  async function ydUpload(text) {
    const r = await fetch(YD_API + "/resources/upload?path=" + encodeURIComponent(ydFile()) + "&overwrite=true", { headers: ydHeaders() });
    if (!r.ok) throw new Error("Диск ответил " + r.status + " (проверьте токен и права)");
    const j = await r.json();
    const u = await fetch(j.href, { method: "PUT", headers: { "Content-Type": "application/json" }, body: text });
    if (!u.ok) throw new Error("загрузка не прошла: " + u.status);
  }

  const GH_API = "https://api.github.com";
  const GH_FILE = "energo-terminal.json";

  function ghHeaders() {
    return {
      Authorization: "Bearer " + S.sync.ghToken,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    };
  }

  async function ghFetch(url, opts) {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    try {
      return await fetch(url, Object.assign({}, opts, ctrl ? { signal: ctrl.signal } : {}));
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("GitHub не ответил за 20 секунд");
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function ghCheck() {
    const r = await ghFetch(GH_API + "/gists?per_page=1", { headers: ghHeaders() });
    if (r.status === 401) throw new Error("токен GitHub не подошёл (401) — скопируйте его целиком");
    if (r.status === 403) throw new Error("токену GitHub не хватает права «gist» (403)");
    if (!r.ok) throw new Error("GitHub ответил " + r.status);
    return true;
  }

  async function ghFindGist() {
    const r = await ghFetch(GH_API + "/gists?per_page=100", { headers: ghHeaders(), cache: "no-store" });
    if (!r.ok) throw new Error("GitHub ответил " + r.status + " при поиске хранилища");
    const list = await r.json();
    const hit = (Array.isArray(list) ? list : []).filter((g) => g && g.files && g.files[GH_FILE])
      .sort((a, b) => Date.parse(b.updated_at || 0) - Date.parse(a.updated_at || 0))[0];
    if (hit) { S.sync.gistId = hit.id; save({ sync: false }); }
    return hit ? hit.id : null;
  }

  let ghEtag = null;

  async function ghDownload() {
    if (!S.sync.gistId) { ghEtag = null; await ghFindGist(); }
    if (!S.sync.gistId) return null;
    const h = ghHeaders();
    if (ghEtag) h["If-None-Match"] = ghEtag;
    const r = await ghFetch(GH_API + "/gists/" + encodeURIComponent(S.sync.gistId), { headers: h, cache: "no-store" });
    noteServerTime(r);
    if (r.status === 304) return null;
    if (r.status === 404) { S.sync.gistId = ""; ghEtag = null; save({ sync: false }); return null; }
    if (!r.ok) throw new Error("GitHub ответил " + r.status);
    ghEtag = r.headers.get("ETag") || null;
    const j = await r.json();
    const f = j.files && j.files[GH_FILE];
    if (!f) return null;
    if (f.truncated && f.raw_url) {
      const raw = await ghFetch(f.raw_url, { headers: { Authorization: "Bearer " + S.sync.ghToken } });
      if (!raw.ok) throw new Error("файл не скачался: " + raw.status);
      return await raw.text();
    }
    return f.content;
  }

  async function ghUpload(text) {
    const body = JSON.stringify({
      description: "Энерго-Терминал — состояние приложения",
      public: false,
      files: { [GH_FILE]: { content: text } }
    });
    if (!S.sync.gistId) await ghFindGist();
    if (S.sync.gistId) {
      const r = await ghFetch(GH_API + "/gists/" + encodeURIComponent(S.sync.gistId), { method: "PATCH", headers: ghHeaders(), body });
      noteServerTime(r);
      if (!r.ok) throw new Error("GitHub не принял обновление: " + r.status);
      ghEtag = null;
      return;
    }
    const r = await ghFetch(GH_API + "/gists", { method: "POST", headers: ghHeaders(), body });
    noteServerTime(r);
    if (!r.ok) throw new Error("GitHub не создал хранилище: " + r.status);
    const j = await r.json();
    S.sync.gistId = j.id;
    ghEtag = null;
    save({ sync: false });
  }

  let ghCmtEtag = null;

  async function ghComments() {
    if (!S.sync.gistId) { ghCmtEtag = null; await ghFindGist(); }
    if (!S.sync.gistId) return [];
    const h = ghHeaders();
    if (ghCmtEtag) h["If-None-Match"] = ghCmtEtag;
    const r = await ghFetch(GH_API + "/gists/" + encodeURIComponent(S.sync.gistId) + "/comments?per_page=100", { headers: h, cache: "no-store" });
    if (r.status === 304 || !r.ok) return [];
    ghCmtEtag = r.headers.get("ETag") || null;
    const list = await r.json();
    return Array.isArray(list) ? list : [];
  }

  function hookList(s) {
    return String((s && s.hook) || "").toLowerCase().split(/[\s,;]+/).filter(Boolean);
  }

  function logHook(hook, on, atMs) {
    const log = S.runtime.hook_log || (S.runtime.hook_log = []);
    log.push({ h: hook, on: !!on, at: new Date(atMs || Date.now()).toISOString() });
    if (on) digestAdd("mark", 1, atMs || Date.now());
    S.runtime.hook_log = log.slice(-400);
  }

  function hookCounts(dayKey) {
    const key = dayKey || todayKey();
    const out = {};
    for (const e of S.runtime.hook_log || []) {
      if (!e.on || String(e.at).slice(0, 10) !== key) continue;
      out[e.h] = (out[e.h] || 0) + 1;
    }
    return out;
  }

  const HOOK_NAMES = {
    yt: "YouTube", youtube: "YouTube", ig: "Instagram", instagram: "Instagram",
    news: "новости", shorts: "shorts", tg: "Telegram", telegram: "Telegram",
    reels: "reels", tt: "TikTok", tiktok: "TikTok", vk: "VK", vkvideo: "VK Видео",
    game: "игры", games: "игры", mail: "почта",
  };

  function hookLabel(h) {
    const s = S.slots.find((x) => hookList(x).indexOf(h) >= 0);
    if (s && s.title) return s.title;
    const key = String(h).toLowerCase();
    const m = key.match(/^([a-zа-яё]+)(\d*)$/);
    if (!m) return key.toUpperCase();
    const name = HOOK_NAMES[m[1]];
    if (!name) return key.toUpperCase();
    return m[2] ? name + " " + m[2] : name;
  }


  function applyHookEvent(hook, on, atMs) {
    const targets = S.slots.filter((s) => hookList(s).indexOf(hook) >= 0);
    if (!targets.length) return false;
    const now = Date.now();
    const hrs = Math.max(0, (now - (atMs || now)) / 3600000);
    let touched = false;
    for (const s of targets) {
      if (on === !!s.active) continue;
      const w = Number(s.weight) || 0;
      const ratePerH = s.kind === "drain"
        ? -(S.config.drain_coef * w * drainMult() * slotMult(s.id))
        : (S.config.stab_coef * w);
      if (on) {
        s.active = true; s.updated_at = nowISO();
        if (!S.runtime.slot_on) S.runtime.slot_on = {};
        if (!S.runtime.warned) S.runtime.warned = {};
        S.runtime.slot_on[s.id] = now;
        S.runtime.warned[s.id] = false;
        if (s.kind === "drain" && s.mode !== "ambient") chargeEntry();
        if (hrs > 0.01) {
          const cur = liveValue();
          if (cur != null) {
            S.runtime.battery = round2(clamp(cur + ratePerH * hrs, floorValue(), ceiling()));
            S.runtime.battery_at = nowISO();
          }
        }
      } else {
        s.active = false; s.updated_at = nowISO();
        if (S.runtime.slot_on) delete S.runtime.slot_on[s.id];
        startRecovery(s);
        if (hrs > 0.01) {
          const cur = liveValue();
          if (cur != null) {
            S.runtime.battery = round2(clamp(cur - ratePerH * hrs, floorValue(), ceiling()));
            S.runtime.battery_at = nowISO();
          }
        }
      }
      touched = true;
    }
    return touched;
  }

  function handleHook(body, atMs) {
    const m = String(body || "").trim().toLowerCase().match(/^([a-zа-я0-9_-]+)\s*[: ]\s*(on|off|вкл|выкл)$/);
    if (!m) return false;
    const on = m[2] === "on" || m[2] === "вкл";
    logHook(m[1], on, atMs);
    applyHookEvent(m[1], on, atMs);
    return true;
  }

  async function processHooks() {
    if (!cloudOn() || S.sync.mode === "yandex") return false;
    try {
      const list = await ghComments();
      if (!list.length) return false;
      if (Number(S.sync.cmtSeen) < 0) {
        S.sync.cmtSeen = list.reduce((m2, c) => Math.max(m2, Number(c.id) || 0), 0);
        save({ sync: false });
        return false;
      }
      const seen = Number(S.sync.cmtSeen) || 0;
      const fresh = list.filter((c) => (Number(c.id) || 0) > seen).sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
      if (!fresh.length) return false;
      let touched = false;
      for (const c of fresh) {
        if (handleHook(c.body, Date.parse(c.created_at || 0) || Date.now())) touched = true;
      }
      S.sync.cmtSeen = fresh.reduce((m2, c) => Math.max(m2, Number(c.id) || 0), seen);
      save({ sync: false });
      if (touched) { render(); toast("Метка из автоматизации применена"); }
      return touched;
    } catch (e) { return false; }
  }

  function noteServerTime(r) {
    try {
      const d = r && r.headers && r.headers.get("Date");
      if (!d) return;
      const t = Date.parse(d);
      if (isFinite(t)) S.sync.clock_offset = t - Date.now();
    } catch (e) { /* заголовок недоступен */ }
  }

  function cloudOn() { return !!(S.sync.ghToken || S.sync.token); }
  function cloudName() { return S.sync.ghToken ? "GitHub" : "Яндекс.Диск"; }
  async function cloudDownload() { return S.sync.ghToken ? ghDownload() : ydDownload(); }
  async function cloudUpload(text) { return S.sync.ghToken ? ghUpload(text) : ydUpload(text); }

  const YD_DEBOUNCE = 3000;
  let syncTimer = null, syncBusy = false, syncAgain = false, pushedFp = null;

  function modalOpen() {
    try { const m = $("#modal"); return !!(m && m.classList.contains("is-open")); } catch (e) { return false; }
  }

  function stateFingerprint() {
    return JSON.stringify({
      c: S.checkpoints, q: S.quests, k: S.captures, s: S.sessions, i: S.interruptions,
      st: S.slots, cf: S.config, dev: S.meta && S.meta.device_id, cr: S.meta && S.meta.created_at
    });
  }

  function scheduleSync() {
    if (!S || !S.sync || !S.sync.auto || !cloudOn()) return;
    if (typeof fetch !== "function") return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncTimer = null; autoSync(); }, YD_DEBOUNCE);
  }

  function recordsKey(st) {
    const part = (arr) => (arr || []).map((r) => r.id + ":" + (r.updated_at || "")).sort().join(",");
    return ["checkpoints", "checks", "captures", "quests", "sessions", "interruptions", "slots"]
      .map((k) => part(st[k])).join("|");
  }

  function stateKey(st) {
    const r = st.runtime || {};
    const w = r.work || {};
    return recordsKey(st) +
      "|w:" + (w.updated_at || "") + (w.active ? "1" : "0") + ":" + (w.started_at || "") +
      "|e:" + (r.last_entry_at || "") +
      "|b:" + (r.base == null ? "" : r.base) +
      "|c:" + (r.cp_at || "") +
      "|r:" + (r.updated_at || "") +
      "|v:" + (r.battery == null ? "" : r.battery) + "@" + (r.battery_at || "");
  }

  async function mergeRemote() {
    const txt = await cloudDownload();
    if (!txt) return false;
    let data = null;
    try { data = JSON.parse(txt); } catch (e) { data = null; }
    if (!data || !hasData(data)) return false;
    if (data.meta && data.meta.device_id === S.meta.device_id) return false;
    if (modalOpen()) return false;
    const comb = mergeStates(S, data);
    if (stateKey(comb) === stateKey(S)) return false;
    S = comb;
    S.sync.lastDevice = (data.meta && data.meta.device_id) || S.sync.lastDevice;
    return true;
  }

  async function syncOnce() {
    if (!S.sync || !cloudOn() || !S.sync.auto) return false;
    if (typeof fetch !== "function") return false;
    if (syncBusy) {
      const t = Date.parse(S.sync.lastTry || 0) || 0;
      if (Date.now() - t < 90000) { syncAgain = true; return false; }
    }
    syncBusy = true;
    S.sync.lastTry = nowISO();
    try {
      const merged = await mergeRemote();
      if (!merged && stateFingerprint() === pushedFp) { updateSyncHint(); return false; }
      S.sync.lastSync = nowISO();
      S.sync.lastError = null;
      save({ sync: false });
      await cloudUpload(JSON.stringify(stateForCloud()));
      pushedFp = stateFingerprint();
      if (merged) { render(); toast("Подтянул изменения из облака"); }
      updateSyncHint();
      return merged;
    } catch (e) {
      S.sync.lastError = e.message;
      save({ sync: false });
      updateSyncHint();
      return false;
    } finally {
      syncBusy = false;
      if (syncAgain) { syncAgain = false; setTimeout(() => { syncOnce(); }, 3000); }
    }
  }

  function autoSync() { return syncOnce(); }

  let lastPollAt = 0;
  async function pollCloud() {
    if (modalOpen()) return false;
    const now = Date.now();
    if (document.visibilityState !== "visible" && now - lastPollAt < 4 * 60000) return false;
    lastPollAt = now;
    await syncOnce();
    await processHooks();
    return true;
  }

  function updateSyncHint() {
    try {
      const el = $("#syncHint");
      if (!el) return;
      el.innerHTML = syncHintText();
    } catch (e) { /* шторка закрыта */ }
  }

  function syncHintText() {
    const on = cloudOn();
    const err = S.sync.lastError || "";
    const bad = !!err && /\b(401|403)\b/.test(err);
    const tokState = !on ? "не введён" : bad ? "не принят — нужен новый" : S.sync.lastSync ? "принят" : "не проверен";
    return "Устройство: <b class=\"mono\">" + esc(String(S.meta.device_id).slice(0, 8)) + "</b><br>" +
      "Хранилище: " + (on ? cloudName() : "не подключено") + "<br>" +
      "Токен: " + tokState + "<br>" +
      "Автосинхронизация: " + (!on ? "ждёт токена" : S.sync.auto ? "после каждого изменения" : "выключена") + "<br>" +
      "Последняя синхронизация: " + (S.sync.lastSync ? fmtDate(S.sync.lastSync) + " " + fmtTime(S.sync.lastSync) : "не было") +
      " · проверка облака: " + (S.sync.lastTry ? fmtTime(S.sync.lastTry) : "не было") +
      (S.sync.lastError ? "<br>Последняя ошибка: " + esc(S.sync.lastError) : "") +
      (S.sync.gistId ? "<br>ID хранилища: <b class=\"mono\">" + esc(S.sync.gistId) + "</b>" : "") +
      "<br>Сборка: <b class=\"mono\">" + BUILD + "</b>";
  }

  async function syncPush() {
    if (!cloudOn()) { closeModal(); openConnectSheet(); return; }
    toast("Выгружаю…");
    try {
      if (!hasData(S)) {
        const txt = await cloudDownload().catch(() => null);
        let remote = null;
        try { remote = txt ? JSON.parse(txt) : null; } catch (e) { remote = null; }
        if (remote && hasData(remote)) {
          closeModal();
          toast("В облаке есть данные, а здесь пусто — нажмите «Забрать и слить»");
          return;
        }
      }
      S.sync.lastSync = nowISO();
      S.sync.lastError = null;
      await cloudUpload(JSON.stringify(stateForCloud()));
      pushedFp = stateFingerprint();
      save({ sync: false }); closeModal(); toast("Выгружено в облако");
    } catch (e) { toast("Ошибка: " + e.message); }
  }

  async function syncPull() {
    if (!cloudOn()) { closeModal(); openConnectSheet(); return; }
    toast("Забираю…");
    try {
      const txt = await cloudDownload();
      if (txt == null) { toast("В облаке пока пусто — сначала выгрузите с другого устройства"); return; }
      const data = JSON.parse(txt);
      const before = S.checkpoints.length, beforeCap = S.captures.length;
      const remoteDevice = data.meta && data.meta.device_id;
      S = mergeStates(S, data);
      S.sync.lastSync = nowISO();
      S.sync.lastError = null;
      S.sync.lastDevice = remoteDevice || null;
      pushedFp = stateFingerprint();
      save({ sync: false }); closeModal(); render();
      toast("Слито: чекпоинтов " + before + " → " + S.checkpoints.length + ", записей " + beforeCap + " → " + S.captures.length);
    } catch (e) { toast("Ошибка: " + e.message); }
  }

  function cleanToken(s) {
    return String(s || "").trim().replace(/^OAuth\s+/i, "").replace(/^["'«»\s]+|["'«»\s]+$/g, "").trim();
  }

  async function ydCheck() {
    const h = ydHeaders();
    const r = await fetch(YD_API + "/resources?path=" + encodeURIComponent("app:/"), { headers: h });
    if (r.status === 401) throw new Error("токен не подошёл (401) — скопируйте его со страницы Яндекса целиком");
    if (r.status === 403) throw new Error("нет права на папку приложения — нужно cloud_api:disk.app_folder");
    if (!r.ok) throw new Error("Диск ответил " + r.status);
    const w = await fetch(YD_API + "/resources/upload?path=" + encodeURIComponent("app:/probe.json") + "&overwrite=true", { headers: h });
    if (w.status === 401 || w.status === 403) throw new Error("чтение есть, а записи нет — добавьте cloud_api:disk.read и cloud_api:disk.write и перевыпустите токен");
    if (!w.ok) throw new Error("Диск не выдал ссылку на запись: " + w.status);
    return true;
  }

  async function adoptCloud(v) {
    let mode = v && v.mode === "yandex" ? "yandex" : "gist";
    const tk = cleanToken(v && v.tok);
    S.sync.clientId = ((v && v.cid) || "").trim();
    if (/^gh[pousr]_/.test(tk) || /^github_pat_/.test(tk)) mode = "gist";
    else if (/^y0_/.test(tk) || /^AQAA/.test(tk)) mode = "yandex";
    if (!tk) { save({ sync: false }); toast(mode === "gist" ? "Вставьте токен GitHub с правом gist" : "Вставьте access_token Яндекса"); return; }
    S.sync.mode = mode;
    if (mode === "gist") { S.sync.ghToken = tk; S.sync.token = ""; }
    else { S.sync.token = tk; S.sync.ghToken = ""; }
    save({ sync: false });
    try {
      if (mode === "gist") await ghCheck(); else await ydCheck();
      S.sync.lastSync = nowISO();
      S.sync.lastError = null;
      pushedFp = null;
      save({ sync: false }); closeModal(); render();
      toast(mode === "gist" ? "GitHub подключён" : "Диск подключён, папка приложения доступна");
      scheduleSync();
    } catch (e) {
      S.sync.lastError = e.message;
      save({ sync: false }); closeModal(); render();
      toast("Токен сохранён, но " + e.message);
    }
  }

  function openConnectSheet() {
    const mode = S.sync.ghToken ? "gist" : (S.sync.token ? "yandex" : "gist");
    openModal({
      title: "Подключить хранилище",
      html: "<p>Приложение хранит одно состояние в облаке. Токен остаётся на этом устройстве.</p>" +
        "<p class=\"note\"><b>GitHub Gist</b> (рекомендуется): на github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) создайте токен с одной галочкой <b>gist</b>, скопируйте его в поле «Токен». Хранилище создастся само и будет приватным.<br>" +
        "<b>Яндекс.Диск</b>: годится только для выгрузки, читать файл из браузера Яндекс не разрешает.</p>",
      fields: [
        { key: "mode", label: "Хранилище", type: "select", value: mode,
          options: [{ v: "gist", l: "GitHub Gist — чтение и запись" }, { v: "yandex", l: "Яндекс.Диск — только выгрузка" }] },
        { key: "tok", label: "Токен", value: "" },
        { key: "cid", label: "client_id (только для Яндекса)", value: S.sync.clientId || "" }
      ],
      actions: [
        { label: "Отмена", onClick: closeModal },
        { label: "Открыть авторизацию", onClick: (v) => {
            const cid = (v.cid || "").trim();
            if (!cid) { toast("Нужен client_id"); return; }
            S.sync.clientId = cid; save({ sync: false });
            location.href = "https://oauth.yandex.ru/authorize?response_type=token&client_id=" + encodeURIComponent(cid);
          } },
        { label: "Сохранить", kind: "primary", onClick: (v) => { adoptCloud(v); } }
      ]
    });
  }

  function applyAuto(v) {
    if (!v || !v.auto) return;
    const next = v.auto === "on";
    if (next === S.sync.auto) return;
    S.sync.auto = next;
    save({ sync: false });
    if (next) { pushedFp = null; scheduleSync(); }
  }

  function openSyncSheet() {
    const on = cloudOn();
    const acts = [
      { label: on ? "Выгрузить" : "Подключить", onClick: (v) => { applyAuto(v); closeModal(); on ? syncPush() : openConnectSheet(); } },
      { label: "Забрать и слить", onClick: (v) => { applyAuto(v); closeModal(); syncPull(); } }
    ];
    if (on) acts.push({ label: "Токен", onClick: (v) => { applyAuto(v); closeModal(); openConnectSheet(); } });
    acts.push({ label: "Закрыть", kind: "primary", onClick: (v) => { applyAuto(v); closeModal(); } });
    openModal({
      title: "Синхронизация",
      html: "<p>Оба устройства пишут один файл в облако. Изменения уходят сами через несколько секунд, а перед записью приложение сверяет облако и, если там свежее, сначала сливает его.</p>" +
        '<div class="hint"><span class="bar"></span><span id="syncHint">' + syncHintText() + "</span></div>" +
        (on ? "" : '<p class="note">Без облака перенос делается файлом: «Данные» → экспорт → импорт со слиянием.</p>'),
      fields: on ? [{ key: "auto", label: "Автосинхронизация", type: "select",
        value: S.sync.auto ? "on" : "off",
        options: [{ v: "on", l: "включена — после каждого изменения" }, { v: "off", l: "выключена — только вручную" }] }] : [],
      actions: acts
    });
  }

  function openHelp() {
    openModal({
      title: "Как это считается",
      html:
        "<p><b>База</b> — из чекпоинта: 70% средних статов плюс 30% от отсутствия дебаффов. У стартового профиля это 22%.</p>" +
        "<p><b>Заряд</b> идёт в реальном времени: потребитель забирает 0.06 × вес в час, стабилизатор возвращает 0.05 × вес. Считается даже при закрытом приложении.</p>" +
        "<p><b>Вход</b> — включение потребителя в режиме «захват» стоит " + S.config.entry_cost + " % сразу и на " + S.config.residue_min + " минут останавливает восстановление. Слот в режиме «фон» входа не платит, только объём. Повторное включение раньше чем через " + S.config.merge_gap_min + " минут склеивается.</p>" +
        "<p><b>Восстановление</b> — после выключения потребителя внимание возвращается не сразу: " + S.config.recovery_min + " минут стабилизаторы не считаются, потому что фокус ещё не вернулся. Пока идёт это окно, на карточке заряда горит «восстановление».</p>" +
        "<p><b>Долгие сессии</b> — после " + S.config.session_soft_min + " минут непрерывного потребления минута дороже в " + S.config.session_mult + " раза: приложение предложит проверить, всё ли ещё смотрите.</p>" +
        "<p><b>Окно</b> — не бесплатно: " + S.config.window_rate + " %/час. Отдых восстанавливает хуже, чем кажется.</p>" +
        "<p><b>Долг</b> — заряд может уйти ниже нуля до " + S.config.debt_floor + " %. Отрицательное значение значит, что вы тратите вперёд.</p>" +
        "<p><b>Сон</b> — внутри вашего окна заряд растёт на " + S.config.night_recharge + " %/час, но только если потребители выключены. Потолок равен базе, урезанной по прошлой ночи.</p>" +
        "<p><b>Форма дня</b> — суточный ритм минус накопленная усталость. Ритм даёт пик около 10 утра, спад после обеда и второй подъём к 18:00; усталость растёт от часов бодрствования и от недосыпа. Форма умножает расход: в провале тот же слот стоит дороже, чем утром, — при 90% множитель 1.05, при 40% около 1.5.</p>" +
        "<p><b>Работа и дорога</b> — отдельный расход, по умолчанию около 0.5 %/час.</p>" +
        "<p class=\"note\">Все коэффициенты — калибровка, а не измерение. Форма модели опирается на исследования, числа подбираются под ваши ощущения за два-три чекпоинта.</p>",
      actions: [{ label: "Понятно", kind: "primary", onClick: closeModal }]
    });
  }

  // ─────────────────────────────── привязка ───────────────────────────────
  function bind() {
    $$("[data-go]").forEach((b) => { b.onclick = () => { activeTab = b.dataset.go; render(); }; });
    $$("[data-act]").forEach((b) => { b.onclick = () => act(b.dataset.act); });
    $$("[data-sheet]").forEach((b) => {
      b.onclick = () => {
        if (b.dataset.sheet === "sleep") openSleepSheet();
        else if (b.dataset.sheet === "morning") openMorningSheet();
      };
    });
    $$("[data-tog]").forEach((b) => {
      let lp = null;
      const longPress = () => { b.dataset.long = "1"; editSlot(b.dataset.tog); };
      b.addEventListener("pointerdown", () => { clearTimeout(lp); lp = setTimeout(longPress, 600); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
        b.addEventListener(ev, () => { if (lp) { clearTimeout(lp); lp = null; } }));

      b.onclick = () => {
        if (b.dataset.long) { delete b.dataset.long; return; }
        const s = S.slots.find((x) => x.id === b.dataset.tog);
        const applyToggle = () => {
          const before = projectionRaw();
          s.active = !s.active; s.updated_at = nowISO();
          if (!S.runtime.slot_on) S.runtime.slot_on = {};
          if (!S.runtime.warned) S.runtime.warned = {};
          if (s.active) {
            S.runtime.slot_on[s.id] = Date.now();
            S.runtime.warned[s.id] = false;
          } else {
            delete S.runtime.slot_on[s.id];
          }
          save();
          const charged = s.active && s.kind === "drain" && s.mode !== "ambient" ? chargeEntry() : false;
          const rec = s.active ? false : startRecovery(s);
          const tip = s.active && s.kind === "drain" ? adviceForEntry() : null;
          toggledId = s.id;
          buzz(s.active ? 14 : 8);
          const after = projectionRaw(); render();
          toast(s.title + ": " + (s.active ? "включён" : "выключен") +
            (charged ? " · вход −" + S.config.entry_cost : (s.active && s.mode === "ambient" ? " · фон, без входа" : "")) +
            (rec ? " · восстановление " + S.config.recovery_min + " мин" : "") +
            projDelta(before, after));
          if (tip) setTimeout(() => { toast(tip); }, 2750);
        };
        if (recoveryAsk(s, applyToggle)) return;
        applyToggle();
      };
    });
    $$("[data-edit]").forEach((b) => { b.onclick = () => editSlot(b.dataset.edit); });
    $$("[data-journal]").forEach((b) => {
      b.onclick = () => {
        try { localStorage.setItem("et_journal_open", journalOpen() ? "0" : "1"); } catch (e) {}
        render();
      };
    });
    $$("[data-hold]").forEach((b) => {
      let lp = null;
      const fire = () => { b.dataset.long = "1"; openProtocolSheet(b.dataset.hold); };
      b.addEventListener("pointerdown", () => { clearTimeout(lp); lp = setTimeout(fire, 500); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
        b.addEventListener(ev, () => { if (lp) { clearTimeout(lp); lp = null; } }));
      b.addEventListener("contextmenu", (e) => {
        if (b.dataset.hold) { e.preventDefault(); fire(); }
      });
      const nativeClick = b.onclick;
      b.onclick = (e) => {
        if (b.dataset.long) { delete b.dataset.long; e.stopImmediatePropagation(); return; }
        if (nativeClick) nativeClick(e);
      };
    });
    const workW = $("[data-workw]");
    if (workW) {
      const out = $("#workW-v");
      const apply = (redraw) => {
        const w = S.runtime.work;
        w.weight = clamp(Number(workW.value) || 8, 1, 10);
        w.updated_at = nowISO();
        save();
        if (redraw) render();
      };
      workW.oninput = () => {
        const w = clamp(Number(workW.value) || 8, 1, 10);
        if (out) out.textContent = w;
        const tone = $("#workTone"); if (tone) tone.textContent = weightWord(w);
        const box = $("#workSld");
        if (box) {
          box.classList.remove("sld--easy", "sld--mid", "sld--hard");
          box.classList.add("sld--" + weightTone(w));
          box.style.setProperty("--p", ((w - 1) / 9) * 100 + "%");
        }
        buzz(6);
      };
      workW.onchange = () => apply(true);
    }
    $$("[data-scout]").forEach((b) => {
      b.onclick = () => {
        const p = S.runtime.scout_pending; if (!p) return;
        const dur = Math.round((Date.parse(p.end_at) - Date.parse(p.started_at)) / 60000) || S.config.scout_min;
        S.sessions.push({ id: uuid(), updated_at: nowISO(), started_at: p.started_at, finished_at: nowISO(), type: "scout", duration_min: dur, completed: true, extended: b.dataset.scout === "yes" });
        S.runtime.scout_pending = null; S.runtime.last_work_end = nowISO();
        save(); render(); toast("Записано");
      };
    });
    $$("[data-verdict]").forEach((b) => {
      b.onclick = () => {
        const q = S.quests.find((x) => x.status === "active"); if (!q) return;
        q.status = b.dataset.verdict; q.closed_at = nowISO(); q.updated_at = nowISO();
        save(); render(); toast("Вердикт записан");
      };
    });
    $$("[data-capdone]").forEach((b) => {
      b.onclick = () => {
        const c = S.captures.find((x) => x.id === b.dataset.capdone);
        c.done_at = c.done_at ? null : nowISO(); c.updated_at = nowISO();
        save(); render();
      };
    });
    $$("[data-tag]").forEach((t) => {
      t.onclick = () => t.setAttribute("aria-pressed", t.getAttribute("aria-pressed") === "true" ? "false" : "true");
    });
    $$("[data-slider]").forEach((el) => {
      const [g, k] = el.dataset.slider.split(":");
      el.oninput = () => {
        touchedSliders.add(el.dataset.slider);
        const out = $("#" + g + "-" + k + "-v");
        if (out) {
          const prev = out.dataset.prev ? Number(out.dataset.prev) : null;
          const d = prev == null ? null : Number(el.value) - prev;
          const dtxt = d == null ? "" : (d > 0 ? " (+" + d + ")" : d < 0 ? " (" + d + ")" : " (=)");
          out.innerHTML = el.value + "<small>" + dtxt + "</small>";
        }
        updateBasePreview();
      };
      const out = $("#" + g + "-" + k + "-v");
      if (out) {
        const m = out.innerHTML.match(/\(([+-]?)(\d+)\)/);
        if (m) out.dataset.prev = String(Number(el.value) - (m[1] === "-" ? -Number(m[2]) : Number(m[2])));
      }
    });
    const behNews = $("#behNews");
    if (behNews) {
      behNews.oninput = () => applySuggestion("debuffs:news_reflex", suggestNewsReflex(Number(behNews.value)),
        "из данных: " + (behNews.value || "—") + " проверок в день");
    }
    const behMin = $("#behMin");
    if (behMin) {
      behMin.oninput = () => applySuggestion("debuffs:morning_scroll", suggestMorning(Number(behMin.value)),
        "из данных: телефон через " + (behMin.value || "—") + " мин");
    }
    const imp = $("#impFile"); if (imp) imp.onchange = importFile;
    const help = $("#helpBtn"); if (help) help.onclick = openHelp;
    const data = $("#dataBtn"); if (data) data.onclick = openDataSheet;
    const fab = $("#fabBtn"); if (fab) fab.onclick = openCaptureSheet;
  }

  // ─────────────────────────────── фон ───────────────────────────────
  function neural() {
    const c = $("#bg"); if (!c) return;
    const ctx = c.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, nodes = [], raf = null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function size() {
      w = c.clientWidth; h = c.clientHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(24, Math.min(56, Math.round((w * h) / 30000)));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .14, vy: (Math.random() - .5) * .14,
        r: Math.random() * 1.4 + .7
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 20000) {
            ctx.strokeStyle = "rgba(94,234,212," + ((1 - d2 / 20000) * .18).toFixed(3) + ")";
            ctx.lineWidth = .7;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of nodes) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = "rgba(125,211,252,.4)"; ctx.fill();
      }
    }
    function step() {
      for (const p of nodes) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = w + 20; if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; if (p.y > h + 20) p.y = -20;
      }
      draw(); raf = requestAnimationFrame(step);
    }
    size(); draw();
    if (!reduce) raf = requestAnimationFrame(step);
    window.addEventListener("resize", () => { size(); draw(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
      else if (!raf && !reduce) raf = requestAnimationFrame(step);
    });
  }

  // ─────────────────────────────── старт ───────────────────────────────
  let startupError = null;
  let startupStage = "";
  function stage(name, fn) {
    try { return fn(); }
    catch (e) { if (!startupError) { startupError = e; startupStage = name; } return null; }
  }

  stage("чтение данных", () => { S = initialState(); });
  if (!S) S = fresh();
  stage("сохранение", () => save());
  stage("отрисовка", () => render());
  stage("фон", () => neural());
  try {
    const m = /[?&]tab=(\w+)/.exec((typeof location !== "undefined" && location.search) || "");
    if (m && TABS.some((t) => t[0] === m[1])) { activeTab = m[1]; render(); }
  } catch (e) { /* среда без location */ }

  try {
    const h = (typeof location !== "undefined" && location.hash) || "";
    const tk = /access_token=([^&]+)/.exec(h);
    if (tk) {
      S.sync.token = decodeURIComponent(tk[1]);
      S.sync.lastSync = nowISO();
      save();
      if (typeof history !== "undefined" && history.replaceState) {
        history.replaceState(null, "", location.pathname + location.search);
      }
      toast("Яндекс.Диск подключён");
    }
  } catch (e) { /* нет доступа к адресу */ }

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      openCaptureSheet();
    }
  });

  setInterval(() => { accrue(); if (tick()) render(); }, 30000);
  setInterval(updateLive, 1000);

  setTimeout(() => { autoSync(); }, 1500);
  setTimeout(() => { processHooks(); }, 4000);
  setInterval(() => { pollCloud(); }, 10000);
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const other = migrate(JSON.parse(e.newValue));
      if (countRecords(other) > countRecords(S)) {
        S = other;
        render();
        toast("Подхвачены данные из другой вкладки");
      }
    } catch (err) { /* чужая запись не читается — не трогаем своё состояние */ }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      syncOnce();
    } else {
      syncOnce();
    }
  });
  window.addEventListener("focus", () => { pollCloud(); });

  if (startupError) {
    const msg = (startupError && startupError.stack) || String(startupError);
    const v = $("#view");
    if (v && !v.innerHTML.trim()) {
      v.innerHTML = '<section class="card"><h2>Сбой при запуске</h2>' +
        '<pre class="mono" style="white-space:pre-wrap;font-size:12px;color:#f3bab5;margin:0">' +
        esc(startupStage + ": " + msg) + "</pre></section>";
    }
    openModal({
      title: "Сбой при запуске",
      html: "<p>Этап: <b>" + esc(startupStage) + "</b>. Приложение продолжило работу, но данные могли не загрузиться.</p>" +
        "<pre class=\"mono\" style=\"white-space:pre-wrap;font-size:12px;color:#f3bab5;margin:0;max-height:40vh;overflow:auto\">" +
        esc(msg) + "</pre>",
      actions: [
        { label: "Диагностика", onClick: () => { closeModal(); showDiag(); } },
        { label: "Понятно", kind: "primary", onClick: closeModal }
      ]
    });
  } else if (restoredFromLegacy) {
    toast("Данные восстановлены: " + S.checkpoints.length + " " + plural(S.checkpoints.length, CP));
  }

  if (readErrors.length) {
    openModal({
      title: "Данные не прочитались",
      html: "<p>Часть сохранённых данных не читается, поэтому приложение открылось с пустым состоянием. Записывать поверх них оно не будет — защита уже сработала.</p>" +
        "<pre class=\"mono\" style=\"white-space:pre-wrap;font-size:12px;color:#f3bab5;margin:0;max-height:30vh;overflow:auto\">" +
        esc(readErrors.join("\n")) + "</pre>",
      actions: [
        { label: "Диагностика", onClick: () => { closeModal(); showDiag(); } },
        { label: "Понятно", kind: "primary", onClick: closeModal }
      ]
    });
  }

  try {
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then((v) => { persistedFlag = v; }).catch(() => {});
      if (navigator.storage.persist) navigator.storage.persist().then((v) => { if (v) persistedFlag = true; }).catch(() => {});
    }
  } catch (e) { /* нет Storage API */ }

  initSwipe();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
