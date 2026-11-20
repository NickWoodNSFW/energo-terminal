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
  const hhmm = (ms) => { const m = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const toMin = (t) => { const p = String(t || "0:0").split(":"); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const ICONS = {
    bolt: '<path d="M13 2 5 13h5l-1 9 8-11h-5l1-9z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6l-7-3z"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-13 0 9-5 14-13 14"/><path d="M5 19c3-4 6-6 10-7"/>',
    down: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    pencil: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="m14 6 4 4"/>'
  };
  function icon(name, size) {
    const s = size || 16;
    return '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }
  const BUILD = "et-v34";

  const STATS = { ram_clarity: "Оперативка", start_initiative: "Старт", focus_hold: "Фокус", evening_resource: "Ресурс" };
  const DEBUFFS = { morning_scroll: "Утренний захват", unstructured_avoid: "Непереносимость пустого времени", news_reflex: "Новостной рефлекс", task_paralysis: "Паралич перед стартом" };
  const TAGS = ["Ремонт", "Аврал", "Недосып", "Отпуск", "Болезнь", "Высокий фоновый шум", "Много встреч"];
  const TABS = [["home", "Состояние"], ["moment", "Момент"], ["capture", "Захват"], ["checkpoint", "Чекпоинт"], ["mirror", "Зеркало"]];

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
        night_recharge: 3.0, micro_pause: 1.5, micro_pause_limit: 3, work_weight: 8,
        sleep_from: "23:00", sleep_to: "07:00", sleep_target: 7.5, sleep_drain_k: 0.5,
        window_rate: 0.15, debt_floor: -20, session_soft_min: 30, session_mult: 1.5
      },
      checkpoints: [], quests: [], captures: [], sessions: [], interruptions: [],
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
        base: null, battery: null, battery_at: nowISO(), cp_at: null, status: "active",
        window_end: null, window_start: null, window_day: null, window_count: 0,
        scout_end: null, scout_start: null, scout_pending: null,
        focus_start: null, last_work_end: null, emergency: false,
        work: { active: false, started_at: null, weight: 8, updated_at: null },
        pause_day: null, pause_count: 0, sleep_override: null,
        drain_start: null, drain_slot: null, pending_entry: false, merged: false,
        residue_until: null, last_entry_at: null,
        slot_on: {}, warned: {}, samples: []
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
    for (const k of ["checkpoints", "quests", "captures", "sessions", "interruptions", "slots"]) {
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
    return p;
  }

  let S = null;
  let restoredFromLegacy = false;
  const readErrors = [];
  let writesBlocked = 0;
  let persistedFlag = null;

  function countRecords(s) {
    if (!s) return 0;
    return (s.checkpoints || []).length + (s.captures || []).length + (s.sessions || []).length +
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

  function save(opts) {
    try {
      if (!hasData(S) && storedHasData()) {
        writesBlocked++;
        console.warn("защита: пустое состояние не перезаписывает сохранённые данные");
        if (!opts || opts.sync !== false) scheduleSync();
        return;
      }
      localStorage.setItem(KEY, JSON.stringify(S));
      if (S.checkpoints.length > 0) localStorage.setItem(BACKUP_KEY, JSON.stringify(S));
    } catch (e) { toast("Не удалось сохранить: хранилище заполнено"); }
    if (!opts || opts.sync !== false) scheduleSync();
  }

  // ─────────────────────────────── модель ───────────────────────────────
  function sleepWindowHours() {
    const a = toMin(S.config.sleep_from), b = toMin(S.config.sleep_to);
    return round1((b > a ? b - a : 1440 - a + b) / 60);
  }
  function isNight() {
    const d = new Date(), cur = d.getHours() * 60 + d.getMinutes();
    const a = toMin(S.config.sleep_from), b = toMin(S.config.sleep_to);
    return a <= b ? (cur >= a && cur < b) : (cur >= a || cur < b);
  }
  function lastNightHours() {
    const o = S.runtime.sleep_override;
    if (o && Date.now() - Date.parse(o.at) < 36 * 3600e3) return Number(o.hours);
    return sleepWindowHours();
  }
  function sleepFactor() { return clamp(lastNightHours() / (Number(S.config.sleep_target) || 7.5), 0, 1); }
  function drainMult() { return 1 + (1 - sleepFactor()) * Number(S.config.sleep_drain_k || 0.5); }
  function workActive() { return !!(S.runtime.work && S.runtime.work.active); }
  function isResidue() { const u = S.runtime.residue_until; return !!(u && Date.now() < u); }

  const CIRCADIAN = [[0, 0.10], [4, 0.15], [6, 0.35], [8, 0.75], [10, 0.95], [12, 0.80],
    [14, 0.60], [16, 0.72], [18, 0.76], [20, 0.64], [22, 0.40], [24, 0.10]];

  function circadianAt(ts) {
    const d = new Date(ts), h = d.getHours() + d.getMinutes() / 60;
    for (let i = 1; i < CIRCADIAN.length; i++) {
      if (h <= CIRCADIAN[i][0]) {
        const a = CIRCADIAN[i - 1], b = CIRCADIAN[i];
        const k = (h - a[0]) / ((b[0] - a[0]) || 1);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return CIRCADIAN[CIRCADIAN.length - 1][1];
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

  function formMarkerX(ts) {
    const d = new Date(ts), h = d.getHours() + d.getMinutes() / 60;
    return clamp(((h - FORM_FROM) / (FORM_TO - FORM_FROM)) * 240, 0, 240);
  }

  function formCard() {
    const pts = [];
    for (let h = FORM_FROM; h <= FORM_TO; h += 0.5) {
      const d = new Date();
      d.setHours(Math.floor(h), Math.round((h - Math.floor(h)) * 60), 0, 0);
      const x = ((h - FORM_FROM) / (FORM_TO - FORM_FROM)) * 240;
      const y = FORM_H - formAt(d.getTime()) * FORM_H;
      pts.push(x.toFixed(1) + "," + y.toFixed(1));
    }
    const nx = formMarkerX(Date.now()).toFixed(1);
    return '<section class="card card--tight">' +
      '<div class="between"><h2 style="margin:0">Форма дня</h2>' +
        '<span class="chip mono"><b id="formVal">' + Math.round(formNow() * 100) + '%</b> · ×<span id="formMul">' + formMult().toFixed(2) + "</span></span></div>" +
      '<p class="dim" style="margin:8px 0 10px;font-size:13px">Суточный ритм минус усталость. Чем ниже форма, тем дороже то же залипание — вечером расход выше, чем утром.</p>' +
      '<svg viewBox="0 0 240 ' + FORM_H + '" width="100%" height="' + FORM_H + '" preserveAspectRatio="none" aria-hidden="true" style="display:block">' +
        '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--dim)" stroke-width="1.5" stroke-linejoin="round" />' +
        '<line id="formNow" x1="' + nx + '" y1="0" x2="' + nx + '" y2="' + FORM_H + '" stroke="var(--teal)" stroke-width="1.5" />' +
      "</svg>" +
      '<p class="note" style="margin-top:8px">Спад после обеда и к вечеру — часть ритма, а не сбой. Кривая калибровочная.</p>' +
      "</section>";
  }

  function slotMinutes(id) {
    const t = S.runtime.slot_on && S.runtime.slot_on[id];
    return t ? (Date.now() - t) / 60000 : 0;
  }
  function slotMult(id) {
    const soft = Number(S.config.session_soft_min) || 30;
    return slotMinutes(id) > soft ? (Number(S.config.session_mult) || 1.5) : 1;
  }

  function rateOf() {
    if (S.runtime.status === "cooling") return -Math.abs(Number(S.config.window_rate) || 0.15);
    const drainsOn = S.slots.some((s) => s.active && s.kind === "drain");
    if (isNight() && !drainsOn && !workActive()) return S.config.night_recharge;
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

  function ceiling() {
    if (S.runtime.base == null) return 100;
    return Math.max(S.runtime.base * sleepFactor(), S.runtime.battery || 0);
  }
  function floorValue() { const f = Number(S.config.debt_floor); return isNaN(f) ? 0 : Math.min(0, f); }

  function liveValue() {
    const r = S.runtime;
    if (r.base == null) return null;
    const b0 = r.battery == null ? r.base : r.battery;
    const dtH = Math.max(0, (Date.now() - Date.parse(r.battery_at)) / 3600000);
    return clamp(b0 + rateOf() * dtH, floorValue(), ceiling());
  }

  function projection() {
    const v = liveValue(); if (v == null) return null;
    return clamp(v + rateOf() * hoursToEvening().hours, 0, ceiling());
  }

  function pushSample(v) {
    const arr = S.runtime.samples || (S.runtime.samples = []);
    const now = Date.now();
    arr.push({ t: now, v: round1(v) });
    const cutoff = now - 2 * 3600e3;
    S.runtime.samples = arr.filter((x) => x.t >= cutoff && x.v != null).slice(-400);
  }

  function accrue() {
    const v = liveValue();
    if (v == null) return;
    S.runtime.battery = round1(v);
    S.runtime.battery_at = nowISO();
    pushSample(v);
    save();
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
    r.battery = round1(clamp(v, floorValue(), 100));
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

  // ─────────────────────────────── тост и шторки ───────────────────────────────
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
    if (b < 0) return { c1: "#e0685f", c2: "#7f1d1d" };
    if (b >= 60) return { c1: "#10b981", c2: "#0e7490" };
    if (b >= 35) return { c1: "#60a5fa", c2: "#1d4ed8" };
    if (b >= 15) return { c1: "#f59e0b", c2: "#b45309" };
    return { c1: "#e8894a", c2: "#9a3412" };
  }

  function statusBadge(value) {
    const debt = value != null && value < 0 ? '<span class="badge badge--pause"><span class="dot"></span>долг</span> ' : "";
    if (isResidue()) return debt + '<span class="badge badge--pause"><span class="dot"></span>пауза ' + hhmm(S.runtime.residue_until - Date.now()) + "</span>";
    const r = rateOf();
    if (r > 0.02) return debt + '<span class="badge badge--up"><span class="dot"></span>+' + r.toFixed(2) + " пп/ч" + (isNight() ? " · сон" : "") + "</span>";
    if (r < -0.02) return debt + '<span class="badge badge--down"><span class="dot"></span>' + r.toFixed(2) + " пп/ч</span>";
    return debt + '<span class="badge badge--flat"><span class="dot"></span>баланс</span>';
  }

  function tileAccrued(s) {
    const m = slotMinutes(s.id), w = Number(s.weight) || 0;
    const rate = s.kind === "drain" ? -S.config.drain_coef * w * drainMult() : S.config.stab_coef * w;
    return { minutes: m, delta: rate * (m / 60) };
  }
  function liveTileText(s) {
    const a = tileAccrued(s);
    return hhmm(a.minutes * 60000) + " · " + (a.delta >= 0 ? "+" : "−") + Math.abs(a.delta).toFixed(2) + " пп";
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
        '<path d="' + path + '" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
        '<circle cx="' + px(last.t).toFixed(1) + '" cy="' + py(last.v).toFixed(1) + '" r="2.5" fill="currentColor"/>' +
      "</svg>" +
      '<div class="spark-legend">за час ' + sign + Math.abs(delta).toFixed(2) + " пп · " + lo.toFixed(1) + "…" + hi.toFixed(1) + "%</div>" +
    "</div>";
  }

  function heroBlock() {
    const v = liveValue();
    if (v == null) {
      return '<section class="card hero"><div class="hero-top"><div>' +
        '<div class="hero-num hero-num--empty">—</div>' +
        '<div class="hero-sub">Заряд считается от последней точки сохранения</div></div>' +
        '<span class="badge badge--flat"><span class="dot"></span>база не задана</span></div>' +
        '<div class="divider"></div>' +
        '<p class="dim">Первый чекпоинт — 15 минут, дальше раз в две недели. После него появится живая телеметрия.</p>' +
        '<div class="row"><button type="button" class="primary" data-go="checkpoint">Сделать чекпоинт</button>' +
        '<button type="button" data-act="seed">Стартовый профиль</button></div></section>';
    }
    const lv = levelOf(v), ceil = ceiling(), proj = projection(), ep = hoursToEvening();
    const f = sleepFactor();
    const cells = Array.from({ length: 10 }, (_, i) => {
      const cur = clamp((v - i * 10) / 10, 0, 1) * 100;
      const fut = clamp((proj - i * 10) / 10, 0, 1) * 100;
      return '<span class="cell"><i class="wane" style="height:' + cur.toFixed(1) + '%"></i><i class="deep" style="height:' + fut.toFixed(1) + '%"></i></span>';
    }).join("");
    return '<section class="card hero" style="--lvl:' + lv.c1 + ';--lvl-2:' + lv.c2 + '">' +
      '<div class="hero-top"><div>' +
        '<div class="hero-num" id="heroVal">' + v.toFixed(2) + "<span>%</span></div>" +
        '<div class="hero-sub" id="heroSpent">потрачено ' + Math.max(0, (S.runtime.base || 0) - v).toFixed(2) + " пп</div>" +
      "</div><div id=\"heroBadge\">" + statusBadge(v) + "</div></div>" +
      '<div class="battery">' +
        '<div class="bat-shell"><div class="bat-cells" id="batCells">' + cells + "</div>" +
        '<div class="bat-ceil" id="batCeil" style="left:' + clamp(ceil, 0, 100).toFixed(1) + '%"></div></div>' +
        '<div class="bat-nub"></div>' +
      "</div>" +
      '<div class="legend">' +
        '<span><i class="lg lg--deep"></i>останется к вечеру</span>' +
        '<span><i class="lg lg--wane"></i>уйдёт</span>' +
        '<span><i class="lg-ceil"></i>потолок ' + ceil.toFixed(1) + "%</span>" +
        '<span class="live"><i class="dot"></i><span id="heroProj">' + proj.toFixed(1) + "</span>% " + ep.label.toLowerCase() + "</span>" +
      "</div>" +
      sparkBlock() +
      '<div class="sleepline"><span>Сон <b class="mono">' + lastNightHours() + " ч</b> · потолок <b class=\"mono\">" +
        Math.round(f * 100) + "%</b> · расход <b class=\"mono\">×" + drainMult().toFixed(2) + "</b></span>" +
        '<button type="button" class="link" data-sheet="sleep">Изменить</button></div>' +
    "</section>" + formCard();
  }

  function protocolsRow() {
    const r = S.runtime;
    const pausesLeft = Math.max(0, S.config.micro_pause_limit - (r.pause_day === todayKey() ? (r.pause_count || 0) : 0));
    return '<section class="card card--tight"><h2>Протоколы</h2><div class="protocols">' +
      '<button type="button" class="pill" data-act="scout"' + (r.scout_end ? " disabled" : "") + ">" +
        "<span>" + icon("bolt", 15) + " " + (r.scout_end ? "Разведка · " + hhmm(r.scout_end - Date.now()) : "Разведка 5 мин") + "</span>" +
        '<span class="pill-meta">туман</span></button>' +
      '<button type="button" class="pill" data-act="window"' + (r.window_end ? " disabled" : "") + ">" +
        "<span>" + icon("shield", 15) + " " + (r.window_end ? "Окно · " + hhmm(r.window_end - Date.now()) : "Окно 45 мин") + "</span>" +
        '<span class="pill-meta">пауза</span></button>' +
      '<button type="button" class="pill" data-act="microPause">' +
        "<span>" + icon("leaf", 15) + " 15 мин без экрана</span>" +
        '<span class="pill-meta">+' + S.config.micro_pause + " · " + pausesLeft + "/" + S.config.micro_pause_limit + "</span></button>" +
    "</div></section>";
  }

  function workCard() {
    const w = S.runtime.work;
    const wRate = -S.config.drain_coef * (Number(w.weight) || 0);
    return '<section class="card"><div class="between"><h2 style="margin:0">Рабочий день и дорога</h2>' +
      '<span class="chip">вес ' + w.weight + " · " + wRate.toFixed(2) + "</span></div>" +
      (w.active
        ? '<div class="switch-big"><div><div class="timer" id="workClock">' + hhmm(Date.now() - Date.parse(w.started_at)).slice(0, 5) + "</div>" +
          '<p class="note">Дорога входит в окно. За 10–11 часов ≈ ' + Math.abs(wRate * 10.5).toFixed(1) + " пп.</p></div></div>" +
          '<div class="row"><button type="button" class="primary" data-act="work">Завершить день</button>' +
          '<button type="button" class="sm" data-act="workWeight" aria-label="Вес рабочего дня">⚙</button></div>'
        : '<p class="dim">Работа и дорога тратят ресурс сами по себе.</p>' +
          '<div class="row"><button type="button" class="primary" data-act="work">Начать рабочий день</button>' +
          '<button type="button" class="sm" data-act="workWeight" aria-label="Вес рабочего дня">⚙</button></div>') +
    "</section>";
  }

  function tile(s) {
    const w = Number(s.weight) || 0;
    const inWin = S.runtime.status === "cooling";
    const residue = isResidue();
    const zeroed = !s.active || inWin || (residue && s.kind === "stab");
    const impact = zeroed ? 0 : (s.kind === "drain" ? -S.config.drain_coef * w : S.config.stab_coef * w * (s.context === "cognitive" ? -0.8 : 1));
    const ep = hoursToEvening();
    const delta = impact * ep.hours;
    const meta = zeroed
      ? "не влияет" + (inWin ? " · в окне" : residue && s.kind === "stab" ? " · остаток" : s.active ? "" : " · выключен")
      : (impact > 0 ? "+" : "−") + Math.abs(delta).toFixed(1) + " пп " + ep.label.toLowerCase() +
        (s.kind === "drain" ? " · вход " + S.config.entry_cost : "");

    return '<div class="tile tile--' + s.kind + (s.active ? " is-on" : "") + '">' +
      '<button type="button" class="tile-main" data-tog="' + s.id + '" aria-pressed="' + (s.active ? "true" : "false") + '">' +
        '<div class="tile-name">' + (s.kind === "drain" ? icon("down", 12) : icon("up", 12)) + esc(s.title) + "</div>" +
        '<div class="tile-trig">' + esc(s.trigger) + (s.context !== "any" ? " · " + (s.context === "mechanical" ? "механика" : "когнитивная") : "") + "</div>" +
        '<div class="tile-meta">' + meta + "</div>" +
        (s.active ? '<div class="tile-live" id="tm-' + s.id + '">' + liveTileText(s) + "</div>" : "") +
      "</button>" +
      '<button type="button" class="tile-edit" data-edit="' + s.id + '" aria-label="Настроить слот «' + esc(s.title) + '»">' + icon("pencil", 16) + '</button>' +
    "</div>";
  }

  function slotsBlock() {
    return '<section class="card"><div class="between"><h2 style="margin:0">Потоки</h2>' +
      '<span class="chip">' + S.slots.filter((s) => s.active).length + " / 6</span></div>" +
      '<p class="note">Тап по плитке включает и выключает. Включение потребителя списывает вход ' + S.config.entry_cost + " пп.</p>" +
      '<div class="tiles">' + S.slots.map(tile).join("") + "</div></section>";
  }

  function switchRow() {
    const r = S.runtime;
    if (r.drain_start) {
      return '<section class="card"><div class="between"><h2 style="margin:0">Эпизод идёт</h2>' +
        '<span class="mono" id="drainClock" style="font-size:22px">' + hhmm(Date.now() - r.drain_start).slice(0, 5) + "</span></div>" +
        '<p class="note">' + (r.pending_entry ? "Вход " + S.config.entry_cost + " пп уже списан." : "Вход не списан: склейка с предыдущим эпизодом.") + "</p>" +
        '<div class="row"><button type="button" class="primary" data-act="return">Вернулся</button></div></section>';
    }
    return '<section class="card card--tight"><div class="row">' +
      '<button type="button" class="primary" data-act="switch">Внеплановое переключение · −' + S.config.entry_cost + "</button>" +
      '<button type="button" class="link" data-act="manualInt">записать задним числом</button></div></section>';
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
  let momentMode = "scout";
  let touchedSliders = new Set();

  function renderHome() {
    const r = S.runtime;
    let h = heroBlock() + protocolsRow() + workCard() + slotsBlock() + switchRow();
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
    return h;
  }

  function timelineEvents() {
    const names = { scout: "Разведка", window: "Окно", focus: "Фокус", work: "Работа и дорога" };
    const ev = [];
    for (const x of S.sessions) {
      ev.push({ at: x.started_at, kind: names[x.type] || x.type, tail: x.duration_min + " мин",
        sub: x.type === "scout" ? (x.extended ? "продолжил" : "остановился") : x.type === "work" ? "рабочий день" : "" });
    }
    for (const x of S.interruptions) {
      ev.push({ at: x.started_at, kind: "Переключение", tail: x.duration_min + " мин",
        sub: (x.entry_charged ? "вход −" + S.config.entry_cost : "без входа") + (x.merged ? " · склейка" : "") });
    }
    for (const c of S.captures) ev.push({ at: c.created_at, kind: "Захват", tail: "", sub: c.text.slice(0, 60) });
    ev.sort((a, b) => (a.at < b.at ? 1 : -1));
    return ev;
  }

  function timeline() {
    const ev = timelineEvents().slice(0, 12);
    if (!ev.length) return '<p class="note">Пока пусто. События появятся здесь по мере работы.</p>';
    return '<div class="timeline">' + ev.map((x) =>
      '<div class="tl-item"><span class="tl-time">' + fmtTime(x.at) + "</span>" +
      '<span class="tl-what">' + esc(x.kind) + (x.sub ? "<small>" + esc(x.sub) + "</small>" : "") + "</span>" +
      '<span class="tl-dur">' + esc(x.tail) + "</span></div>").join("") + "</div>";
  }

  function avgFocus() {
    const wk = S.sessions.filter((s) => s.type === "focus" && Date.now() - Date.parse(s.started_at) < 7 * 864e5);
    if (!wk.length) return "—";
    return Math.round(wk.reduce((a, s) => a + s.duration_min, 0) / wk.length) + " мин · " + wk.length + " подх.";
  }

  function renderMoment() {
    const r = S.runtime;
    const modes = [["scout", "Разведка"], ["focus", "Фокус"], ["window", "Окно"]];
    let timer = "05:00", actionLabel = "Запустить разведку", actName = "scout", hint = "Снять туман с одного квадрата. Через 5 минут можно бросить без стыда.";

    if (momentMode === "scout") {
      timer = r.scout_end ? hhmm(r.scout_end - Date.now()) : "05:00";
      if (r.scout_end) { actionLabel = "Разведка идёт"; }
    } else if (momentMode === "focus") {
      timer = r.focus_start ? hhmm(Date.now() - r.focus_start) : "00:00";
      actionLabel = r.focus_start ? "Завершить подход" : "Запустить секундомер";
      actName = "focus";
      hint = "Секундомер вверх. Показывает реальную ёмкость внимания, а не норматив.";
    } else {
      timer = r.window_end ? hhmm(r.window_end - Date.now()) : "45:00";
      actionLabel = r.window_end ? "Окно открыто" : "Открыть окно 45 мин";
      actName = "window";
      hint = "Разрешённый отдых. Начисление остановлено целиком: ни расхода, ни восстановления.";
    }

    return '<div class="stack">' +
      '<section class="card"><div class="seg" role="group" aria-label="Режим таймера">' +
        modes.map(([k, l]) => '<button type="button" data-mode="' + k + '" aria-pressed="' + (momentMode === k) + '">' + l + "</button>").join("") +
      "</div>" +
      '<div class="timer' + (timer === "00:00" || timer === "05:00" || timer === "45:00" ? " timer--idle" : "") + '" id="modeClock">' + timer + "</div>" +
      '<p class="note">' + hint + "</p>" +
      '<div class="row" style="margin-top:var(--s3)"><button type="button" class="primary" data-act="' + actName + '"' +
        ((actName === "scout" && r.scout_end) || (actName === "window" && r.window_end) ? " disabled" : "") + ">" + actionLabel + "</button></div>" +
      '<div class="divider"></div><p class="note">Средняя ёмкость за 7 дней: <b class="mono">' + avgFocus() + "</b></p></section>" +
      '<section class="card"><h2>Журнал дня</h2>' + timeline() + "</section></div>";
  }

  function renderCapture() {
    const items = S.captures.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return '<section class="card"><h2>Захват</h2>' +
      '<p class="dim">Внешняя память. Выгрузили — и держать в голове не нужно.</p>' +
      '<label for="capText">Что нужно не забыть</label>' +
      '<textarea id="capText" placeholder="Любая мысль или дело, без сроков и оценок"></textarea>' +
      '<div class="row" style="margin-top:var(--s3)"><button type="button" class="primary" data-act="capture">Выгрузить из головы</button></div></section>' +
      '<section class="card"><div class="between"><h2 style="margin:0">Записей: ' + items.length + "</h2>" +
      '<button type="button" class="ghost sm" data-act="capClear">Очистить отработанные</button></div>' +
      '<div style="margin-top:var(--s2)">' + (items.length
        ? items.map((c) => '<div class="item"><div class="between">' +
            '<span' + (c.done_at ? ' style="text-decoration:line-through;color:var(--mute)"' : "") + ">" + esc(c.text) + "</span>" +
            '<button type="button" class="ghost sm" data-capdone="' + c.id + '">' + (c.done_at ? "Вернуть" : "Сброшено") + "</button></div>" +
            '<div class="d">' + fmtDate(c.created_at) + " " + fmtTime(c.created_at) + "</div></div>").join("")
        : '<p class="note">Пока пусто. Одно касание кнопки «+» — и мысль выгружена.</p>') + "</div></section>";
  }

  function slider(group, key, label, val, prev, stepText, hint) {
    const id = group + "-" + key;
    const d = prev == null ? null : val - prev;
    const dtxt = d == null ? "" : (d > 0 ? " (+" + d + ")" : d < 0 ? " (" + d + ")" : " (=)");
    return '<div style="margin:var(--s4) 0 var(--s1)">' +
      '<label for="' + id + '" style="display:flex;justify-content:space-between;align-items:baseline">' +
        "<span>" + label + '</span><span class="mono" id="' + id + '-v" style="color:var(--teal)">' + val + "<small>" + dtxt + "</small></span></label>" +
      '<input type="range" id="' + id + '" min="1" max="10" step="1" value="' + val + '" data-slider="' + group + ":" + key + '">' +
      '<div class="hintline" id="hint-' + id + '">шаг ' + stepText + (hint ? " · " + hint : "") + "</div>" +
    "</div>";
  }

  // ── подсказки из собранных данных ──
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
      minutesToPhone: cp && cp.behaviors && cp.behaviors.minutes_to_phone != null ? Number(cp.behaviors.minutes_to_phone) : null
    };
  }
  function suggestNewsReflex(n) { return n == null || isNaN(n) ? null : clamp(Math.round(1 + n * 0.6), 1, 10); }
  function suggestMorning(m) { if (m == null || isNaN(m)) return null; return m >= 60 ? 2 : m >= 30 ? 4 : m >= 15 ? 6 : m >= 5 ? 8 : 9; }
  function suggestUnstructured(e) { return e == null ? null : e >= 7 ? 9 : e >= 4 ? 7 : e >= 2 ? 5 : 3; }
  function suggestFocus(avg) { return avg == null ? null : avg >= 40 ? 8 : avg >= 20 ? 7 : avg >= 10 ? 5 : 3; }

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
    const sug = {
      focus_hold: suggestFocus(cs.focusAvg),
      morning_scroll: suggestMorning(cs.minutesToPhone),
      news_reflex: suggestNewsReflex(cs.newsChecks),
      unstructured_avoid: suggestUnstructured(cs.entriesPerDay)
    };
    const sv = Object.assign({}, cur.stats);
    const dv = Object.assign({}, cur.debuffs);
    if (sug.focus_hold != null) sv.focus_hold = sug.focus_hold;
    ["morning_scroll", "news_reflex", "unstructured_avoid"].forEach((k) => { if (sug[k] != null) dv[k] = sug[k]; });
    const hints = {
      focus_hold: cs.focusCount ? "из данных: подход " + cs.focusAvg + " мин, их " + cs.focusCount : "нет замеров фокуса",
      morning_scroll: cs.minutesToPhone != null ? "из данных: телефон через " + cs.minutesToPhone + " мин" : "нет данных",
      news_reflex: cs.newsChecks != null ? "из данных: " + cs.newsChecks + " проверок в день" : "нет данных",
      unstructured_avoid: "из данных: " + cs.entriesPerDay + " переключений в день"
    };

    let h = '<section class="card"><div class="between"><h2 style="margin:0">Цикл</h2>' +
      '<span class="chip">' + (cycleDay() == null ? "не начат" : "день " + cycleDay() + " из " + S.config.checkpoint_interval_days) + "</span></div>";
    if (quest) {
      h += "<p>" + esc(quest.hypothesis) + '</p><p class="note">объявлен ' + fmtDate(quest.declared_at) + "</p>" +
        '<div class="row" style="margin-top:var(--s3)"><button type="button" class="primary" data-verdict="worked">Сработало</button>' +
        '<button type="button" data-verdict="hard">Сложно</button><button type="button" data-verdict="no">Не подошло</button></div>';
    } else {
      h += '<p class="dim">Один эксперимент на цикл. Без него сравнение двух настроений не даёт знания.</p>' +
        '<label for="questText">Гипотеза на две недели</label>' +
        '<input id="questText" placeholder="Первые 40 минут работы без фонового звука">' +
        '<div class="row" style="margin-top:var(--s3)"><button type="button" data-act="questStart">Объявить квест</button></div>';
    }
    h += "</section>";

    h += '<section class="card"><h2>' + (last ? "Новая точка сохранения" : "Первая точка сохранения") + "</h2>" +
      '<p class="note">Это не оценка, а состояние на сегодня. Дельта показана к прошлому чекпоинту.</p>' +
      '<p class="note">Ползунки с пометкой «из данных» подставлены из журнала и прошлых прокси. Их можно поправить — но начинать с числа честнее, чем с настроения.</p>' +
      "<h3>Ресурсные статы</h3>" +
      Object.keys(STATS).map((k) => slider("stats", k, STATS[k], sv[k], prevStats ? prevStats[k] : null, "1.75 пп базы", hints[k] || "")).join("") +
      "<h3>Дебаффы</h3>" +
      Object.keys(DEBUFFS).map((k) => slider("debuffs", k, DEBUFFS[k], dv[k], prevDebuffs ? prevDebuffs[k] : null, "0.75 пп базы", hints[k] || "")).join("") +
      "<h3>Числовые прокси</h3><div class=\"grid2\">" +
        '<div><label for="behMin">Минут до первого телефона</label><input id="behMin" type="number" inputmode="numeric" value="' + (cur.behaviors && cur.behaviors.minutes_to_phone != null ? cur.behaviors.minutes_to_phone : "") + '"></div>' +
        '<div><label for="behNews">Проверок новостей за день</label><input id="behNews" type="number" inputmode="numeric" value="' + (cur.behaviors && cur.behaviors.news_checks != null ? cur.behaviors.news_checks : "") + '"></div>' +
      "</div>" +
      "<h3>Контекст</h3>" +
      '<div class="tags" id="tagBox">' + TAGS.map((t) => '<button type="button" class="tagchip" aria-pressed="false" data-tag="' + esc(t) + '">' + esc(t) + "</button>").join("") + "</div>" +
      '<label for="cpNote">Заметка</label><textarea id="cpNote">' + esc(cur.note || "") + "</textarea>" +
      '<div class="divider"></div>' +
      '<div class="between" id="basePreview"><span class="dim">Новая база</span><span class="mono" id="basePreviewVal">—</span></div>' +
      '<div class="row" style="margin-top:var(--s3)"><button type="button" class="primary" data-act="saveCP">Сохранить точку</button></div></section>';

    if (last && prev) {
      h += '<section class="card"><div class="between"><h2 style="margin:0">Патч-ноут</h2>' +
        '<span class="chip">' + esc(prev.version_tag) + " → " + esc(last.version_tag) + "</span></div>" +
        '<p class="note">' + fmtDate(prev.date) + " → " + fmtDate(last.date) + "</p>" +
        '<div class="patch">' + patchBody(patchNote(prev, last)) + "</div>" +
        (last.note ? '<div class="divider"></div><p class="note">Заметка периода: ' + esc(last.note) + "</p>" : "") + "</section>";
    }
    return h;
  }

  function renderMirror() {
    const cps = S.checkpoints.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (cps.length < 2) {
      return '<section class="card"><h2>Зеркало прошлого</h2>' +
        '<p class="dim">Нужны как минимум две точки. Первая уже есть — вторая через две недели.</p>' +
        '<div class="row" style="margin-top:var(--s3)"><button type="button" class="primary" data-go="checkpoint">Сделать вторую</button></div></section>';
    }
    const a = cps[0], b = cps[cps.length - 1];
    const db = (baseFrom(b) || 0) - (baseFrom(a) || 0);

    function row(l, x, y, max) {
      return '<div class="db-row"><span class="dim">' + esc(l) + "</span>" +
        '<div class="db-track"><div class="db-a" style="left:calc(' + (x / max * 100) + "% - 4px)\"></div>" +
        '<div class="db-b" style="left:calc(' + (y / max * 100) + "% - 4px)\"></div></div>" +
        '<span class="db-val">' + x + " → " + y + "</span></div>";
    }

    return '<section class="card"><div class="between"><h2 style="margin:0">Тогда и сейчас</h2>' +
      '<span class="chip">' + fmtDate(a.date) + " → " + fmtDate(b.date) + "</span></div>" +
      '<p class="note">База заряда: <b class="mono">' + (baseFrom(a) || 0) + "% → " + (baseFrom(b) || 0) + "%</b> (" +
        (db > 0 ? "+" : "") + db.toFixed(1) + " пп)</p>" +
      "<h3>Ресурсные статы — чем выше, тем лучше</h3>" +
      '<div class="dumbbell">' + Object.keys(STATS).map((k) => row(STATS[k], a.stats[k], b.stats[k], 10)).join("") + "</div>" +
      "<h3>Дебаффы — чем ниже, тем лучше</h3>" +
      '<div class="dumbbell">' + Object.keys(DEBUFFS).map((k) => row(DEBUFFS[k], a.debuffs[k], b.debuffs[k], 10)).join("") + "</div>" +
      '<div class="divider"></div><p class="note">Тусклая метка — прошлое, светлая — сейчас.</p></section>' +
      '<section class="card"><h2>Патч-ноут периода</h2><div class="patch">' + patchBody(patchNote(a, b)) + "</div></section>" +
      (b.note ? '<section class="card"><h3 style="margin-top:0">Заметка ' + fmtDate(b.date) + '</h3><p class="dim">' + esc(b.note) + "</p></section>" : "");
  }

  // ─────────────────────────────── отрисовка ───────────────────────────────
  function renderTabs() {
    const box = $("#tabs");
    if (!box) return;
    box.innerHTML = TABS.map(([k, l]) =>
      '<button type="button" role="tab" aria-selected="' + (k === activeTab) + '" data-tab="' + k + '">' + l + "</button>").join("");
    $$("#tabs button").forEach((b) => { b.onclick = () => { activeTab = b.dataset.tab; render(); }; });
  }

  function render() {
    renderTabs();
    accrue();
    tick();
    const v = $("#view");
    if (!v) return;
    v.innerHTML = activeTab === "home" ? renderHome()
      : activeTab === "moment" ? renderMoment()
      : activeTab === "capture" ? renderCapture()
      : activeTab === "checkpoint" ? renderCheckpoint()
      : renderMirror();
    bind();
    if (activeTab === "checkpoint") updateBasePreview();
    updateLive();
  }

  function updateLive() {
    const wc = $("#workClock");
    if (wc && workActive() && S.runtime.work.started_at) {
      wc.textContent = hhmm(Date.now() - Date.parse(S.runtime.work.started_at)).slice(0, 5);
    }
    if (activeTab !== "home") {
      const mc = $("#modeClock");
      if (mc && activeTab === "moment") {
        const r = S.runtime;
        if (momentMode === "scout" && r.scout_end) mc.textContent = hhmm(r.scout_end - Date.now());
        else if (momentMode === "focus" && r.focus_start) mc.textContent = hhmm(Date.now() - r.focus_start);
        else if (momentMode === "window" && r.window_end) mc.textContent = hhmm(r.window_end - Date.now());
      }
      return;
    }
    const val = $("#heroVal"); if (!val) return;
    const fv = $("#formVal");
    if (fv) fv.textContent = Math.round(formNow() * 100) + "%";
    const fmul = $("#formMul");
    if (fmul) fmul.textContent = formMult().toFixed(2);
    const fm = $("#formNow");
    if (fm) {
      const fx = formMarkerX(Date.now()).toFixed(1);
      fm.setAttribute("x1", fx); fm.setAttribute("x2", fx);
    }
    const v = liveValue(); if (v == null) return;
    val.innerHTML = v.toFixed(2) + "<span>%</span>";
    const sp = $("#heroSpent"); if (sp) sp.textContent = "потрачено " + Math.max(0, (S.runtime.base || 0) - v).toFixed(2) + " пп";
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
    const ceilEl = $("#batCeil");
    if (ceilEl) ceilEl.style.left = clamp(ceiling(), 0, 100).toFixed(1) + "%";

    for (const s of S.slots) {
      if (!s.active) continue;
      const el = $("#tm-" + s.id);
      if (el) el.textContent = liveTileText(s);
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
    toast(charged ? "Вход −" + S.config.entry_cost + " пп · пауза восстановления " + S.config.residue_min + " мин" : "Склейка с прошлым эпизодом, вход не списан");
  }

  function endEpisode() {
    const r = S.runtime;
    if (!r.drain_start) return;
    accrue();
    const dur = Math.max(1, Math.round((Date.now() - r.drain_start) / 60000));
    S.interruptions.push({ id: uuid(), updated_at: nowISO(), started_at: new Date(r.drain_start).toISOString(), ended_at: nowISO(), duration_min: dur, entry_charged: !!r.pending_entry, merged: !!r.merged });
    r.drain_start = null; r.pending_entry = false; r.merged = false;
    save(); render(); toast("Эпизод записан: " + dur + " мин");
  }

  function openSleepSheet() {
    openModal({
      title: "Сон",
      html: "<p>Окно сна задаёт потолок восстановления и множитель расхода. Ниже цели потолок падает, а расход растёт.</p>",
      fields: [
        { key: "from", label: "Отбой", value: S.config.sleep_from },
        { key: "to", label: "Подъём", value: S.config.sleep_to },
        { key: "target", label: "Цель, часов", type: "number", value: S.config.sleep_target },
        { key: "slept", label: "Спал прошлой ночью, часов", type: "number", value: lastNightHours() }
      ],
      actions: [
        { label: "Отмена", onClick: closeModal },
        { label: "Сохранить", kind: "primary", onClick: (v) => {
            S.config.sleep_from = /^\d{1,2}:\d{2}$/.test(v.from) ? v.from : S.config.sleep_from;
            S.config.sleep_to = /^\d{1,2}:\d{2}$/.test(v.to) ? v.to : S.config.sleep_to;
            S.config.sleep_target = clamp(Number(v.target) || 7.5, 4, 12);
            const h = Number(v.slept);
            S.runtime.sleep_override = (!isNaN(h) && h >= 0) ? { hours: clamp(h, 0, 14), at: nowISO() } : null;
            save(); closeModal(); render();
            toast("Сон " + lastNightHours() + " ч · потолок " + Math.round(sleepFactor() * 100) + "%");
          } }
      ]
    });
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
        momentMode = "scout"; save(); render(); toast("Разведка: " + S.config.scout_min + " мин"); break;
      case "window": {
        if (r.window_day !== todayKey()) { r.window_day = todayKey(); r.window_count = 0; }
        r.window_count++;
        r.window_start = Date.now(); r.window_end = Date.now() + S.config.legit_window_min * 60000;
        r.status = "cooling"; save(); render();
        toast(r.window_count > S.config.legit_window_limit ? "Окно сверх лимита: фиксируется как автопилот" : "Окно открыто");
        break;
      }
      case "focus":
        if (!r.focus_start) { r.focus_start = Date.now(); save(); render(); return; }
        {
          const dur = Math.round((Date.now() - r.focus_start) / 60000);
          S.sessions.push({ id: uuid(), updated_at: nowISO(), started_at: new Date(r.focus_start).toISOString(), finished_at: nowISO(), type: "focus", duration_min: dur, completed: true });
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
                save(); closeModal(); render();
                toast("Записано " + m + " мин, вход " + (charged ? "−" + S.config.entry_cost + " пп" : "не списан"));
              } }
          ]
        });
        break;
      case "work":
        if (!r.work.active) {
          r.work.active = true; r.work.started_at = nowISO(); r.work.updated_at = nowISO(); save(); render();
          toast("Рабочий день начат · −" + (S.config.drain_coef * (r.work.weight || 0)).toFixed(2) + " пп/ч");
        } else {
          const dur = Math.round((Date.now() - Date.parse(r.work.started_at)) / 60000);
          S.sessions.push({ id: uuid(), updated_at: nowISO(), started_at: r.work.started_at, finished_at: nowISO(), type: "work", duration_min: dur, completed: true });
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
        r.pause_count++; save(); render();
        toast("Микропауза +" + S.config.micro_pause + " пп · " + r.pause_count + " из " + S.config.micro_pause_limit);
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
      case "export": exportFile(); break;
      case "seed": seed(); break;
      case "diag": showDiag(); break;
      case "restoreBackup": {
        const bk = readKey(BACKUP_KEY);
        if (!bk) { toast("Резервная копия не найдена"); return; }
        S = mergeStates(S, bk); save(); render();
        toast("Копия восстановлена: " + S.checkpoints.length + " чекпоинтов"); break;
      }
    }
  }

  function applySuggestion(key, val, hint) {
    const id = key.replace(":", "-");
    const hintEl = $("#hint-" + id);
    if (hintEl) {
      const stepTxt = id.indexOf("stats-") === 0 ? "1.75 пп базы" : "0.75 пп базы";
      hintEl.textContent = "шаг " + stepTxt + (hint ? " · " + hint : "");
    }
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
    el.innerHTML = (nb == null ? "—" : nb.toFixed(1) + "%") +
      (d == null ? "" : ' <span class="mute" style="font-size:12px">(' +
        (d > 0 ? "+" : "") + d.toFixed(1) + " пп к базе" + (old != null ? ", было " + old + "%" : "") + ")</span>");
  }

  function saveCheckpoint() {
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
    const cp = {
      id: uuid(), updated_at: nowISO(), version_tag: "v1." + S.checkpoints.length, date: nowISO(),
      stats, debuffs, behaviors: beh, tags, note: noteEl ? noteEl.value.trim() : "",
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
                save(); closeModal(); render(); toast("Слот выключен");
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
            toast("Эпизод " + m + " мин · " + (entry ? "вход −" + entry + " · " : "") + "объём −" + pp.toFixed(2) + " пп");
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
          { v: "capture", l: "Захват внимания — за вход списывается " + S.config.entry_cost + " пп" },
          { v: "ambient", l: "Фон — только объём, без входа" }
        ] });
    }
    fields.push({ key: "hook", label: "Метки автоматизации", value: s.hook || "" });
    openModal({
      title: "Настроить слот",
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
            const before = projection();
            if (s.replaces && s.replaces !== drainId) { const o = S.slots.find((x) => x.id === s.replaces); if (o) o.active = true; }
            drain.active = false;
            s.replaces = drainId; s.active = true;
            drain.updated_at = nowISO(); s.updated_at = nowISO();
            save(); closeModal(); render();
            const after = projection();
            toast("Замена: " + s.title + (before != null && after != null ? " · к 23:00 " + Math.round(after) + "% вместо " + Math.round(before) + "%" : ""));
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
    for (const key of ["checkpoints", "quests", "captures", "sessions", "interruptions"]) {
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
    if (at(b.runtime.battery_at, skew) > at(a.runtime.battery_at, 0)) {
      out.runtime = Object.assign({}, a.runtime, { base: b.runtime.base, battery: b.runtime.battery, battery_at: b.runtime.battery_at });
    }
    if (a.runtime.battery != null && b.runtime.battery != null && Math.abs(a.runtime.battery - b.runtime.battery) > 0.3) {
      const newer = at(b.runtime.battery_at, skew) > at(a.runtime.battery_at, 0) ? b.runtime.battery_at : a.runtime.battery_at;
      out.runtime = Object.assign({}, out.runtime, { battery: round1((a.runtime.battery + b.runtime.battery) / 2), battery_at: newer });
    }
    const wa = at(a.runtime.work && a.runtime.work.updated_at, 0);
    const wb = at(b.runtime.work && b.runtime.work.updated_at, skew);
    if (wb > wa) {
      out.runtime = Object.assign({}, out.runtime, { work: JSON.parse(JSON.stringify(b.runtime.work)) });
    }
    const ra = at(a.runtime.last_entry_at, 0);
    const rb = at(b.runtime.last_entry_at, skew);
    if (rb > ra) {
      out.runtime = Object.assign({}, out.runtime, { last_entry_at: b.runtime.last_entry_at, residue_until: b.runtime.residue_until });
    }
    const cpsAll = (out.checkpoints || []).slice().sort((x, y) => (String(x.date || "") < String(y.date || "") ? -1 : 1));
    const cpNew = cpsAll[cpsAll.length - 1];
    if (cpNew && cpNew.base_battery != null && at(cpNew.date, 0) > at(out.runtime.cp_at, 0)) {
      out.runtime.base = cpNew.base_battery;
      out.runtime.battery = cpNew.base_battery;
      out.runtime.battery_at = cpNew.date;
      out.runtime.cp_at = cpNew.date;
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
        html: "<p>В файле " + data.checkpoints.length + " чекпоинтов и " + (data.captures || []).length + " записей. " +
          "Слияние сохранит и текущие данные, и данные из файла: при совпадении записей останется более свежая версия.</p>" +
          '<p class="note">Замена удалит текущие данные без возможности отмены.</p>',
        actions: [
          { label: "Отмена", onClick: closeModal },
          { label: "Слить", kind: "primary", onClick: () => { S = mergeStates(S, data); save(); closeModal(); render(); toast("Слито: " + S.checkpoints.length + " чекпоинтов"); } },
          { label: "Заменить", kind: "danger", onClick: () => { S = migrate(data); save(); closeModal(); render(); toast("Заменено: " + S.checkpoints.length + " чекпоинтов"); } }
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
            S.runtime.battery = round1(clamp(cur + ratePerH * hrs, floorValue(), ceiling()));
            S.runtime.battery_at = nowISO();
          }
        }
      } else {
        s.active = false; s.updated_at = nowISO();
        if (S.runtime.slot_on) delete S.runtime.slot_on[s.id];
        if (hrs > 0.01) {
          const cur = liveValue();
          if (cur != null) {
            S.runtime.battery = round1(clamp(cur - ratePerH * hrs, floorValue(), ceiling()));
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
    return applyHookEvent(m[1], on, atMs);
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
    return ["checkpoints", "captures", "quests", "sessions", "interruptions", "slots"]
      .map((k) => part(st[k])).join("|");
  }

  function stateKey(st) {
    const r = st.runtime || {};
    const w = r.work || {};
    return recordsKey(st) +
      "|w:" + (w.updated_at || "") + (w.active ? "1" : "0") + ":" + (w.started_at || "") +
      "|e:" + (r.last_entry_at || "") +
      "|b:" + (r.base == null ? "" : r.base) +
      "|c:" + (r.cp_at || "");
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
        "<p><b>Вход</b> — включение потребителя в режиме «захват» стоит " + S.config.entry_cost + " пп сразу и на " + S.config.residue_min + " минут останавливает восстановление. Слот в режиме «фон» входа не платит, только объём. Повторное включение раньше чем через " + S.config.merge_gap_min + " минут склеивается.</p>" +
        "<p><b>Долгие сессии</b> — после " + S.config.session_soft_min + " минут непрерывного потребления минута дороже в " + S.config.session_mult + " раза: приложение предложит проверить, всё ли ещё смотрите.</p>" +
        "<p><b>Окно</b> — не бесплатно: " + S.config.window_rate + " пп/час. Отдых восстанавливает хуже, чем кажется.</p>" +
        "<p><b>Долг</b> — заряд может уйти ниже нуля до " + S.config.debt_floor + " пп. Отрицательное значение значит, что вы тратите вперёд.</p>" +
        "<p><b>Сон</b> — внутри вашего окна заряд растёт на " + S.config.night_recharge + " пп/час, но только если потребители выключены. Потолок равен базе, урезанной по прошлой ночи.</p>" +
        "<p><b>Форма дня</b> — суточный ритм минус накопленная усталость. Ритм даёт пик около 10 утра, спад после обеда и второй подъём к 18:00; усталость растёт от часов бодрствования и от недосыпа. Форма умножает расход: в провале тот же слот стоит дороже, чем утром, — при 90% множитель 1.05, при 40% около 1.5.</p>" +
        "<p><b>Работа и дорога</b> — отдельный расход, по умолчанию около 0.5 пп/час.</p>" +
        "<p class=\"note\">Все коэффициенты — калибровка, а не измерение. Форма модели опирается на исследования, числа подбираются под ваши ощущения за два-три чекпоинта.</p>",
      actions: [{ label: "Понятно", kind: "primary", onClick: closeModal }]
    });
  }

  // ─────────────────────────────── привязка ───────────────────────────────
  function bind() {
    $$("[data-go]").forEach((b) => { b.onclick = () => { activeTab = b.dataset.go; render(); }; });
    $$("[data-act]").forEach((b) => { b.onclick = () => act(b.dataset.act); });
    $$("[data-sheet]").forEach((b) => {
      b.onclick = () => { if (b.dataset.sheet === "sleep") openSleepSheet(); };
    });
    $$("[data-mode]").forEach((b) => { b.onclick = () => { momentMode = b.dataset.mode; render(); }; });
    $$("[data-tog]").forEach((b) => {
      let lp = null;
      const longPress = () => { b.dataset.long = "1"; openEpisodeDialog(b.dataset.tog); };
      b.addEventListener("pointerdown", () => { clearTimeout(lp); lp = setTimeout(longPress, 600); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
        b.addEventListener(ev, () => { if (lp) { clearTimeout(lp); lp = null; } }));

      b.onclick = () => {
        if (b.dataset.long) { delete b.dataset.long; return; }
        const s = S.slots.find((x) => x.id === b.dataset.tog);
        const before = projection();
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
        const after = projection(); render();
        toast(s.title + ": " + (s.active ? "включён" : "выключен") +
          (charged ? " · вход −" + S.config.entry_cost : (s.active && s.mode === "ambient" ? " · фон, без входа" : "")) +
          (before != null && after != null ? " · к 23:00 " + Math.round(after) + "% вместо " + Math.round(before) + "%" : ""));
      };
    });
    $$("[data-edit]").forEach((b) => { b.onclick = () => editSlot(b.dataset.edit); });
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
    toast("Данные восстановлены: " + S.checkpoints.length + " чекпоинтов");
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

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
