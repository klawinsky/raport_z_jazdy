// js/app.js
import { saveReport, getReport, nextCounter } from './db.js';
import { exportPdf } from './pdf.js';

/* ---------- Helpery i bezpieczna inicjalizacja ---------- */
window.addEventListener('error', (ev) => { console.error('Global error:', ev.error || ev.message, ev); });

function qs(id) { return document.getElementById(id); }
function on(el, ev, fn) { if (!el) return; el.addEventListener(ev, fn); }
function safeText(v) { return (v === undefined || v === null || v === '') ? '-' : v; }

// Odporne zamykanie modala i przywracanie przewijania
function closeModalSafe(modalId) {
  try {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      const inst = bootstrap.Modal.getInstance(modalEl);
      if (inst) {
        try { inst.hide(); } catch (e) { console.warn('hide() error', e); }
      } else {
        try { new bootstrap.Modal(modalEl).hide(); } catch (e) { console.warn('tmp modal hide error', e); }
      }
      modalEl.setAttribute('aria-hidden', 'true');
    }
  } catch (err) {
    console.error('closeModalSafe error:', err);
  } finally {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
  }
}

/* ---------- Date/time helpers ---------- */
function formatDateForNumber(d) {
  const DD = String(d.getDate()).padStart(2,'0');
  const MM = String(d.getMonth()+1).padStart(2,'0');
  const YY = String(d.getFullYear()).slice(-2);
  return { DD, MM, YY };
}
function nowDateString() {
  const d = new Date();
  const DD = String(d.getDate()).padStart(2,'0');
  const MM = String(d.getMonth()+1).padStart(2,'0');
  const YYYY = d.getFullYear();
  return `${DD}/${MM}/${YYYY}`;
}
function isValidTime(t) { if (!t) return true; return /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
function parseDateTime(dateStr, timeStr, fallbackDate) {
  if (!timeStr) return null;
  const useDate = dateStr || fallbackDate;
  if (!useDate) return null;
  const [yyyy, mm, dd] = useDate.split('-').map(Number);
  const [hh, mi] = timeStr.split(':').map(Number);
  return new Date(yyyy, mm-1, dd, hh, mi).getTime();
}
function formatDelayClass(value) { if (value == null) return 'delay-zero'; if (value > 0) return 'delay-pos'; if (value < 0) return 'delay-neg'; return 'delay-zero'; }
function formatDelayText(value) { if (value == null) return '-'; return `${value} min`; }

/* ---------- Stations datalist ---------- */
const sampleStations = ['Kraków Główny','Warszawa Centralna','Gdańsk Główny','Poznań Główny','Wrocław Główny','Katowice','Łódź Fabryczna','Sopot','Gdynia Główna','Warszawa Wschodnia'];
function populateStationsDatalist(list) {
  const dl = qs('stationsDatalist'); if (!dl) return;
  dl.innerHTML = ''; list.forEach(s => { const opt = document.createElement('option'); opt.value = s; dl.appendChild(opt); });
}

/* ---------- Model ---------- */
function createEmptyReport(number, user) {
  return {
    number,
    createdAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
    createdBy: user,
    currentDriver: user,
    sectionA: { category:'', traction:'', trainNumber:'', route:'', date:'' },
    sectionB: [], sectionC: [], sectionD: [], sectionE: [], sectionF: [], sectionG: [], history: []
  };
}

/* ---------- Main (DOMContentLoaded) ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // UI refs
  const startPanel = qs('startPanel'); const reportPanel = qs('reportPanel');
  const newReportBtn = qs('newReportBtn'); const takeReportBtn = qs('takeReportBtn');
  const importBtnStart = qs('importBtnStart'); const importFileStart = qs('importFileStart');

  const reportNumberEl = qs('reportNumber'); const currentUserEl = qs('currentUser');
  const exportJsonBtn = qs('exportJson'); const importBtn = qs('importBtn'); const importFile = qs('importFile');
  const previewPdfBtn = qs('previewPdf'); const closeReportBtn = qs('closeReport');

  const catEl = qs('cat'); const tractionEl = qs('traction'); const trainNumberEl = qs('trainNumber'); const routeEl = qs('route'); const trainDateEl = qs('trainDate');

  const tractionList = qs('tractionList'); const conductorList = qs('conductorList'); const ordersList = qs('ordersList'); const stationsList = qs('stationsList'); const controlsList = qs('controlsList'); const notesList = qs('notesList');

  const formTraction = qs('formTraction'); const formConductor = qs('formConductor'); const formOrder = qs('formOrder'); const formStation = qs('formStation'); const formControl = qs('formControl'); const formNote = qs('formNote');

  const addTractionBtn  = qs('addTractionBtn'); const addConductorBtn = qs('addConductorBtn'); const addOrderBtn = qs('addOrderBtn'); const addStationBtn = qs('addStationBtn'); const addControlBtn = qs('addControlBtn'); const addNoteBtn = qs('addNoteBtn');

  let currentReport = null; let currentUser = null; let stationsSet = new Set(sampleStations);
  populateStationsDatalist(Array.from(stationsSet));

  // Exposed helpers
  window.createNewReport = async ({ name, id }) => {
    currentUser = { name, id }; const counter = await nextCounter(); const d = new Date(); const { DD, MM, YY } = formatDateForNumber(d); const XXX = String(counter).padStart(3,'0'); const number = `${XXX}/${DD}/${MM}/${YY}`;
    currentReport = createEmptyReport(number, currentUser); await saveReport(currentReport); openReportUI();
  };
  window.takeReportByNumber = async ({ name, id }) => {
    currentUser = { name, id }; const num = prompt('Podaj numer raportu w formacie XXX/DD/MM/YY'); if (!num) return;
    const rep = await getReport(num.trim()); if (!rep) return alert('Nie znaleziono raportu o podanym numerze.');
    rep.history = rep.history || []; rep.history.push({ action: 'przejecie', by: currentUser, at: new Date().toISOString() }); rep.currentDriver = currentUser; rep.lastEditedAt = new Date().toISOString(); currentReport = rep;
    (rep.sectionE || []).forEach(s => { if (s.station) stationsSet.add(s.station); }); populateStationsDatalist(Array.from(stationsSet)); await saveReport(currentReport); openReportUI();
  };
  window.importReportFromJson = async (text) => { try { const rep = JSON.parse(text); if (!rep.number) throw new Error('Nieprawidłowy plik'); await saveReport(rep); alert('Raport zaimportowany. Możesz go teraz przejąć wpisując numer w funkcji Przejmij raport.'); } catch (err) { alert('Błąd importu: ' + err.message); } };

  // Start panel handlers
  on(newReportBtn, 'click', async () => { const name = qs('userName')?.value?.trim(); const id = qs('userId')?.value?.trim(); if (!name || !id) return alert('Podaj imię i nazwisko oraz numer służbowy.'); await window.createNewReport({ name, id }); });
  on(takeReportBtn, 'click', async () => { const name = qs('userName')?.value?.trim(); const id = qs('userId')?.value?.trim(); if (!name || !id) return alert('Podaj imię i nazwisko oraz numer służbowy.'); await window.takeReportByNumber({ name, id }); });
  on(importBtnStart, 'click', () => importFileStart && importFileStart.click());
  on(importFileStart, 'change', async (e) => { const f = e.target.files?.[0]; if (!f) return; const text = await f.text(); await window.importReportFromJson(text); });

  // Open/close report UI
  function openReportUI() { startPanel.style.display = 'none'; reportPanel.style.display = 'block'; renderReport(); attachSectionHandlers(); }
  on(closeReportBtn, 'click', () => { if (!confirm('Zamknąć widok raportu i wrócić do panelu startowego?')) return; currentReport = null; currentUser = null; reportPanel.style.display = 'none'; startPanel.style.display = 'block'; });

  // Render
  function renderReport() {
    if (!currentReport) return;
    reportNumberEl.textContent = currentReport.number;
    currentUserEl.textContent = `${currentReport.currentDriver.name} (${currentReport.currentDriver.id})`;
    catEl.value = currentReport.sectionA.category || ''; tractionEl.value = currentReport.sectionA.traction || ''; trainNumberEl.value = currentReport.sectionA.trainNumber || ''; routeEl.value = currentReport.sectionA.route || ''; trainDateEl.value = currentReport.sectionA.date || '';
    renderList(tractionList, currentReport.sectionB, renderTractionRow);
    renderList(conductorList, currentReport.sectionC, renderConductorRow);
    renderList(ordersList, currentReport.sectionD, renderOrderRow);
    renderList(stationsList, currentReport.sectionE, renderStationRow);
    renderList(controlsList, currentReport.sectionF, renderControlRow);
    renderList(notesList, currentReport.sectionG, renderNoteRow);
  }
  function renderList(container, arr, renderer) { if (!container) return; container.innerHTML = ''; arr.forEach((it, idx) => container.appendChild(renderer(it, idx))); }

  // Add buttons open modals
  on(addTractionBtn, 'click', () => { if (!formTraction) return; formTraction.setAttribute('data-mode','add'); formTraction.setAttribute('data-index',''); formTraction.reset(); new bootstrap.Modal(qs('modalTraction')).show(); });
  on(addConductorBtn, 'click', () => { if (!formConductor) return; formConductor.setAttribute('data-mode','add'); formConductor.setAttribute('data-index',''); formConductor.reset(); new bootstrap.Modal(qs('modalConductor')).show(); });
  on(addOrderBtn, 'click', () => { if (!formOrder) return; formOrder.setAttribute('data-mode','add'); formOrder.setAttribute('data-index',''); formOrder.reset(); new bootstrap.Modal(qs('modalOrder')).show(); });
  on(addStationBtn, 'click', () => { if (!formStation) return; const fallback = trainDateEl.value || currentReport?.sectionA?.date || ''; const sDateArr = qs('s_dateArr'); const sDateDep = qs('s_dateDep'); formStation.setAttribute('data-mode','add'); formStation.setAttribute('data-index',''); formStation.reset(); if (sDateArr) sDateArr.value = fallback; if (sDateDep) sDateDep.value = fallback; new bootstrap.Modal(qs('modalStation')).show(); });
  on(addControlBtn, 'click', () => { if (!formControl) return; formControl.setAttribute('data-mode','add'); formControl.setAttribute('data-index',''); formControl.reset(); new bootstrap.Modal(qs('modalControl')).show(); });
  on(addNoteBtn, 'click', () => { if (!formNote) return; formNote.setAttribute('data-mode','add'); formNote.setAttribute('data-index',''); formNote.reset(); new bootstrap.Modal(qs('modalNote')).show(); });

  /* ---------- Section B handlers ---------- */
  function renderTractionRow(item, idx) {
    const div = document.createElement('div'); div.className = 'd-flex justify-content-between align-items-center station-row';
    div.innerHTML = `<div><strong>${safeText(item.name)}</strong> (${safeText(item.id)}) · ZDP: ${safeText(item.zdp)} · Lok: ${safeText(item.loco)} [${safeText(item.from)} → ${safeText(item.to)}]</div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="traction">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="traction">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click', async () => { currentReport.sectionB.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('traction', idx));
    return div;
  }
  on(formTraction, 'submit', async (e) => {
    e.preventDefault();
    try {
      const name = qs('t_name').value.trim(); const id = qs('t_id').value.trim(); const zdp = qs('t_zdp').value; const loco = qs('t_loco').value.trim(); const from = qs('t_from').value.trim(); const to = qs('t_to').value.trim();
      if (!name || !id) return alert('Imię i numer są wymagane.');
      const mode = formTraction.getAttribute('data-mode'); const entry = { name, id, zdp, loco, from, to };
      if (mode === 'edit') { const idx = Number(formTraction.getAttribute('data-index')); currentReport.sectionB[idx] = entry; } else { currentReport.sectionB.push(entry); }
      if (from) stationsSet.add(from); if (to) stationsSet.add(to); populateStationsDatalist(Array.from(stationsSet));
      await saveAndRender(); formTraction.reset(); closeModalSafe('modalTraction');
    } catch (err) { console.error('Traction submit error:', err); alert('Błąd podczas zapisu danych drużyny trakcyjnej: ' + (err.message || err)); closeModalSafe('modalTraction'); }
  });

  /* ---------- Section C handlers ---------- */
  function renderConductorRow(item, idx) {
    const div = document.createElement('div'); div.className = 'd-flex justify-content-between align-items-center station-row';
    div.innerHTML = `<div><strong>${safeText(item.name)}</strong> (${safeText(item.id)}) · ZDP: ${safeText(item.zdp)} · Funkcja: ${safeText(item.role)} [${safeText(item.from)} → ${safeText(item.to)}]</div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="conductor">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="conductor">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click', async () => { currentReport.sectionC.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('conductor', idx));
    return div;
  }
  on(formConductor, 'submit', async (e) => {
    e.preventDefault();
    try {
      const name = qs('c_name').value.trim(); const id = qs('c_id').value.trim(); const zdp = qs('c_zdp').value; const role = qs('c_role').value; const from = qs('c_from').value.trim(); const to = qs('c_to').value.trim();
      if (!name || !id) return alert('Imię i numer są wymagane.');
      const mode = formConductor.getAttribute('data-mode'); const entry = { name, id, zdp, role, from, to };
      if (mode === 'edit') { const idx = Number(formConductor.getAttribute('data-index')); currentReport.sectionC[idx] = entry; } else { currentReport.sectionC.push(entry); }
      if (from) stationsSet.add(from); if (to) stationsSet.add(to); populateStationsDatalist(Array.from(stationsSet));
      await saveAndRender(); formConductor.reset(); closeModalSafe('modalConductor');
    } catch (err) { console.error('Conductor submit error:', err); alert('Błąd podczas zapisu drużyny konduktorskiej: ' + (err.message || err)); closeModalSafe('modalConductor'); }
  });

  /* ---------- Section D handlers ---------- */
  function renderOrderRow(item, idx) {
    const meta = `${item.number ? 'Nr: ' + item.number + ' · ' : ''}${item.time ? 'Godz.: ' + item.time : ''}`;
    const div = document.createElement('div'); div.className = 'd-flex justify-content-between align-items-center station-row';
    div.innerHTML = `<div>${safeText(item.text)} <div class="small text-muted">${meta} · Źródło: ${safeText(item.source)}</div></div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="order">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="order">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click', async () => { currentReport.sectionD.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('order', idx));
    return div;
  }
  on(formOrder, 'submit', async (e) => {
    e.preventDefault();
    try {
      const number = qs('o_number').value.trim(); const time = qs('o_time').value.trim(); const text = qs('o_text').value.trim(); const source = qs('o_source').value;
      if (!text) return alert('Treść dyspozycji jest wymagana.'); if (!isValidTime(time)) return alert('Godzina musi być w formacie HH:MM lub pusta.');
      const mode = formOrder.getAttribute('data-mode'); const entry = { number, time, text, source };
      if (mode === 'edit') { const idx = Number(formOrder.getAttribute('data-index')); currentReport.sectionD[idx] = entry; } else { currentReport.sectionD.push(entry); }
      await saveAndRender(); formOrder.reset(); closeModalSafe('modalOrder');
    } catch (err) { console.error('Order submit error:', err); alert('Błąd podczas zapisu dyspozycji: ' + (err.message || err)); closeModalSafe('modalOrder'); }
  });

  /* ---------- Section E handlers ---------- */
  function renderStationRow(item, idx) {
    const arrClass = formatDelayClass(item.delayArrMinutes); const depClass = formatDelayClass(item.delayDepMinutes); const arrText = formatDelayText(item.delayArrMinutes); const depText = formatDelayText(item.delayDepMinutes); const stopText = item.realStopMinutes != null ? `${item.realStopMinutes} min` : '-';
    const div = document.createElement('div'); div.className = 'station-row';
    div.innerHTML = `<div class="d-flex justify-content-between"><div><strong>${safeText(item.station)}</strong><div class="small text-muted">Data przyj.: ${safeText(item.dateArr)} · Plan: ${safeText(item.planArr)} · Real: ${safeText(item.realArr)}</div><div class="small">Odchylenie przyj.: <span class="${arrClass}">${arrText}</span></div><div class="small text-muted">Data odj.: ${safeText(item.dateDep)} · Plan: ${safeText(item.planDep)} · Real: ${safeText(item.realDep)}</div><div class="small">Odchylenie odj.: <span class="${depClass}">${depText}</span></div><div class="small">Postój realny: ${stopText}</div><div class="small text-muted">Powód: ${safeText(item.delayReason)}; Rozkazy: ${safeText(item.writtenOrders)}</div></div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="station">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="station">Usuń</button></div></div>`;
    div.querySelector('[data-del]').addEventListener('click', async () => { currentReport.sectionE.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('station', idx));
    return div;
  }
  on(formStation, 'submit', async (e) => {
    e.preventDefault();
    try {
      const station = qs('s_station').value.trim(); const dateArr = qs('s_dateArr').value || trainDateEl.value || currentReport.sectionA.date || ''; const dateDep = qs('s_dateDep').value || trainDateEl.value || currentReport.sectionA.date || ''; const planArr = qs('s_planArr').value.trim(); const planDep = qs('s_planDep').value.trim(); const realArr = qs('s_realArr').value.trim(); const realDep = qs('s_realDep').value.trim(); const delayReason = qs('s_delayReason').value.trim(); const writtenOrders = qs('s_writtenOrders').value.trim();
      if (!station) return alert('Nazwa stacji jest wymagana.'); if (!isValidTime(planArr) || !isValidTime(planDep) || !isValidTime(realArr) || !isValidTime(realDep)) return alert('Czas musi być w formacie HH:MM (00:00–23:59) lub pole może być puste.');
      const planArrDT = parseDateTime(dateArr, planArr, currentReport.sectionA.date); const realArrDT = parseDateTime(dateArr, realArr, currentReport.sectionA.date); const planDepDT = parseDateTime(dateDep, planDep, currentReport.sectionA.date); const realDepDT = parseDateTime(dateDep, realDep, currentReport.sectionA.date);
      let delayArrMinutes = null; if (planArrDT && realArrDT) delayArrMinutes = Math.round((realArrDT - planArrDT)/60000);
      let delayDepMinutes = null; if (planDepDT && realDepDT) delayDepMinutes = Math.round((realDepDT - planDepDT)/60000);
      let realStopMinutes = null; if (realArrDT && realDepDT) realStopMinutes = Math.round((realDepDT - realArrDT)/60000);
      if (!stationsSet.has(station)) { stationsSet.add(station); populateStationsDatalist(Array.from(stationsSet)); }
      const mode = formStation.getAttribute('data-mode'); const entry = { station, dateArr, dateDep, planArr, planDep, realArr, realDep, delayArrMinutes, delayDepMinutes, realStopMinutes, delayReason, writtenOrders };
      if (mode === 'edit') { const idx = Number(formStation.getAttribute('data-index')); currentReport.sectionE[idx] = entry; } else { currentReport.sectionE.push(entry); }
      await saveAndRender(); formStation.reset(); closeModalSafe('modalStation');
    } catch (err) { console.error('Station submit error:', err); alert('Błąd podczas zapisu wpisu stacji: ' + (err.message || err)); closeModalSafe('modalStation'); }
  });

  /* ---------- Section F handlers ---------- */
  function renderControlRow(item, idx) {
    const div = document.createElement('div'); div.className = 'station-row d-flex justify-content-between align-items-center';
    div.innerHTML = `<div><strong>${safeText(item.by)}</strong> (${safeText(item.id)})<div class="small text-muted">${safeText(item.desc)}</div><div class="small text-muted">Uwagi: ${safeText(item.notes)}</div></div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="control">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="control">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click', async () => { currentReport.sectionF.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('control', idx));
    return div;
  }
  on(formControl, 'submit', async (e) => {
    e.preventDefault();
    try {
      const by = qs('f_by').value.trim(); const id = qs('f_id').value.trim(); const desc = qs('f_desc').value.trim(); const notes = qs('f_notes').value.trim();
      if (!by) return alert('Imię i nazwisko kontrolującego jest wymagane.');
      const mode = formControl.getAttribute('data-mode'); const entry = { by, id, desc, notes };
      if (mode === 'edit') { const idx = Number(formControl.getAttribute('data-index')); currentReport.sectionF[idx] = entry; } else { currentReport.sectionF.push(entry); }
      await saveAndRender(); formControl.reset(); closeModalSafe('modalControl');
    } catch (err) { console.error('Control submit error:', err); alert('Błąd podczas zapisu kontroli: ' + (err.message || err)); closeModalSafe('modalControl'); }
  });

  /* ---------- Section G handlers ---------- */
  function renderNoteRow(item, idx) {
    const div = document.createElement('div'); div.className = 'station-row d-flex justify-content-between align-items-center';
    div.innerHTML = `<div>${safeText(item.text)}</div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="note">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="note">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click', async () => { currentReport.sectionG.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('note', idx));
    return div;
  }
  on(formNote, 'submit', async (e) => {
    e.preventDefault();
    try {
      const text = qs('n_text').value.trim(); if (!text) return alert('Treść uwagi jest wymagana.');
      const mode = formNote.getAttribute('data-mode'); const entry = { text };
      if (mode === 'edit') { const idx = Number(formNote.getAttribute('data-index')); currentReport.sectionG[idx] = entry; } else { currentReport.sectionG.push(entry); }
      await saveAndRender(); formNote.reset(); closeModalSafe('modalNote');
    } catch (err) { console.error('Note submit error:', err); alert('Błąd podczas zapisu uwagi: ' + (err.message || err)); closeModalSafe('modalNote'); }
  });

  // Edit modal helper
  function openEditModal(type, idx) {
    if (!currentReport) return;
    if (type === 'traction') { const item = currentReport.sectionB[idx]; qs('t_name').value = item.name || ''; qs('t_id').value = item.id || ''; qs('t_zdp').value = item.zdp || 'WAW'; qs('t_loco').value = item.loco || ''; qs('t_from').value = item.from || ''; qs('t_to').value = item.to || ''; formTraction.setAttribute('data-mode','edit'); formTraction.setAttribute('data-index', idx); new bootstrap.Modal(qs('modalTraction')).show(); }
    else if (type === 'conductor') { const item = currentReport.sectionC[idx]; qs('c_name').value = item.name || ''; qs('c_id').value = item.id || ''; qs('c_zdp').value = item.zdp || 'WAW'; qs('c_role').value = item.role || 'KP'; qs('c_from').value = item.from || ''; qs('c_to').value = item.to || ''; formConductor.setAttribute('data-mode','edit'); formConductor.setAttribute('data-index', idx); new bootstrap.Modal(qs('modalConductor')).show(); }
    else if (type === 'order') { const item = currentReport.sectionD[idx]; qs('o_number').value = item.number || ''; qs('o_time').value = item.time || ''; qs('o_text').value = item.text || ''; qs('o_source').value = item.source || 'Dyspozytura'; formOrder.setAttribute('data-mode','edit'); formOrder.setAttribute('data-index', idx); new bootstrap.Modal(qs('modalOrder')).show(); }
    else if (type === 'station') { const item = currentReport.sectionE[idx]; qs('s_station').value = item.station || ''; qs('s_dateArr').value = item.dateArr || ''; qs('s_dateDep').value = item.dateDep || ''; qs('s_planArr').value = item.planArr || ''; qs('s_planDep').value = item.planDep || ''; qs('s_realArr').value = item.realArr || ''; qs('s_realDep').value = item.realDep || ''; qs('s_delayReason').value = item.delayReason || ''; qs('s_writtenOrders').value = item.writtenOrders || ''; formStation.setAttribute('data-mode','edit'); formStation.setAttribute('data-index', idx); new bootstrap.Modal(qs('modalStation')).show(); }
    else if (type === 'control') { const item = currentReport.sectionF[idx]; qs('f_by').value = item.by || ''; qs('f_id').value = item.id || ''; qs('f_desc').value = item.desc || ''; qs('f_notes').value = item.notes || ''; formControl.setAttribute('data-mode','edit'); formControl.setAttribute('data-index', idx); new bootstrap.Modal(qs('modalControl')).show(); }
    else if (type === 'note') { const item = currentReport.sectionG[idx]; qs('n_text').value = item.text || ''; formNote.setAttribute('data-mode','edit'); formNote.setAttribute('data-index', idx); new bootstrap.Modal(qs('modalNote')).show(); }
  }

  // Reset modali on close
  document.querySelectorAll('.modal').forEach(m => { m.addEventListener('hidden.bs.modal', () => { const form = m.querySelector('form'); if (form) { form.setAttribute('data-mode','add'); form.setAttribute('data-index',''); form.reset(); } }); });

  // Save & autosave
  async function saveAndRender() {
    if (!currentReport) return;
    currentReport.lastEditedAt = new Date().toISOString();
    currentReport.sectionA = { category: catEl.value, traction: tractionEl.value, trainNumber: trainNumberEl.value, route: routeEl.value, date: trainDateEl.value };
    await saveReport(currentReport);
    renderReport();
  }
  function attachSectionHandlers() { [catEl, tractionEl, trainNumberEl, routeEl, trainDateEl].forEach(el => { if (!el) return; el.addEventListener('change', saveAndRender); el.addEventListener('input', saveAndRender); }); }

  // Export / Import JSON
  on(exportJsonBtn, 'click', () => { if (!currentReport) return alert('Brak otwartego raportu.'); const dataStr = JSON.stringify(currentReport, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${currentReport.number.replace(/\//g,'-')}.json`; a.click(); URL.revokeObjectURL(url); });
  on(importBtn, 'click', () => importFile && importFile.click());
  on(importFile, 'change', async (e) => { const f = e.target.files?.[0]; if (!f) return; const text = await f.text(); try { const rep = JSON.parse(text); if (!rep.number) throw new Error('Nieprawidłowy plik'); currentReport = rep; (rep.sectionE || []).forEach(s => { if (s.station) stationsSet.add(s.station); }); populateStationsDatalist(Array.from(stationsSet)); await saveReport(currentReport); renderReport(); alert('Raport zaimportowany i zapisany lokalnie.'); } catch (err) { alert('Błąd importu: ' + err.message); } });

  // PDF
  on(previewPdfBtn, 'click', async () => {
    if (!currentReport) return alert('Brak otwartego raportu.');
    const container = document.createElement('div'); container.className = 'print-container';
    const header = document.createElement('div'); header.className = 'print-header';
    header.innerHTML = `<div class="print-title">Raport z jazdy pociągu</div><div class="print-meta">Numer: ${currentReport.number} · Prowadzący: ${currentReport.currentDriver.name} (${currentReport.currentDriver.id})</div><div class="print-meta">Wygenerowano dnia ${nowDateString()}</div>`;
    container.appendChild(header);
    const secA = document.createElement('div'); secA.className = 'section';
    secA.innerHTML = `<h6>A - Dane ogólne</h6><table class="table-print"><tbody><tr><th>Kategoria</th><td>${safeText(currentReport.sectionA.category)}</td></tr><tr><th>Trakcja</th><td>${safeText(currentReport.sectionA.traction)}</td></tr><tr><th>Numer pociągu</th><td>${safeText(currentReport.sectionA.trainNumber)}</td></tr><tr><th>Relacja</th><td>${safeText(currentReport.sectionA.route)}</td></tr><tr><th>Data kursu</th><td>${safeText(currentReport.sectionA.date)}</td></tr></tbody></table>`;
    container.appendChild(secA);
    const makeCrewTable = (title, arr, cols) => { const s = document.createElement('div'); s.className = 'section'; s.innerHTML = `<h6>${title}</h6>`; const table = document.createElement('table'); table.className = 'table-print'; const thead = document.createElement('thead'); thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`; table.appendChild(thead); const tbody = document.createElement('tbody'); if (arr.length === 0) tbody.innerHTML = `<tr><td colspan="${cols.length}">-</td></tr>`; else arr.forEach(it => { const cells = cols.map(k => `<td>${safeText(it[k])}</td>`).join(''); tbody.innerHTML += `<tr>${cells}</tr>`; }); table.appendChild(tbody); s.appendChild(table); return s; };
    container.appendChild(makeCrewTable('B - Drużyna trakcyjna', currentReport.sectionB, ['name','id','zdp','loco','from','to']));
    container.appendChild(makeCrewTable('C - Drużyna konduktorska', currentReport.sectionC, ['name','id','zdp','role','from','to']));
    const secD = document.createElement('div'); secD.className = 'section'; secD.innerHTML = `<h6>D - Dyspozycje</h6>`; if (currentReport.sectionD.length === 0) secD.innerHTML += `<div>-</div>`; else { const table = document.createElement('table'); table.className = 'table-print'; table.innerHTML = `<thead><tr><th>Nr</th><th>Godz.</th><th>Treść</th><th>Źródło</th></tr></thead><tbody>${currentReport.sectionD.map(o => `<tr><td>${safeText(o.number)}</td><td>${safeText(o.time)}</td><td>${safeText(o.text)}</td><td>${safeText(o.source)}</td></tr>`).join('')}</tbody>`; secD.appendChild(table); } container.appendChild(secD);
    const secE = document.createElement('div'); secE.className = 'section'; secE.innerHTML = `<h6>E - Dane o jeździe pociągu</h6>`; const tableE = document.createElement('table'); tableE.className = 'table-print';
    tableE.innerHTML = `<thead><tr><th>Stacja</th><th>Data przyj.</th><th>Plan przyj.</th><th>Real przyj.</th><th>Odchylenie przyj.</th><th>Data odj.</th><th>Plan odj.</th><th>Real odj.</th><th>Odchylenie odj.</th><th>Postój (min)</th><th>Powód / Rozkazy</th></tr></thead><tbody>${currentReport.sectionE.length === 0 ? `<tr><td colspan="11">-</td></tr>` : currentReport.sectionE.map(s => { const arrVal = (s.delayArrMinutes != null) ? `${s.delayArrMinutes} min` : '-'; const depVal = (s.delayDepMinutes != null) ? `${s.delayDepMinutes} min` : '-'; const arrStyle = s.delayArrMinutes == null ? '' : (s.delayArrMinutes > 0 ? 'color:red;font-weight:600;' : (s.delayArrMinutes < 0 ? 'color:green;font-weight:600;' : 'color:black;font-weight:600;')); const depStyle = s.delayDepMinutes == null ? '' : (s.delayDepMinutes > 0 ? 'color:red;font-weight:600;' : (s.delayDepMinutes < 0 ? 'color:green;font-weight:600;' : 'color:black;font-weight:600;')); const stop = s.realStopMinutes != null ? `${s.realStopMinutes}` : '-'; const pow = (s.delayReason || '-') + (s.writtenOrders ? ' / ' + s.writtenOrders : ''); return `<tr><td>${safeText(s.station)}</td><td>${safeText(s.dateArr)}</td><td>${safeText(s.planArr)}</td><td>${safeText(s.realArr)}</td><td style="${arrStyle}">${arrVal}</td><td>${safeText(s.dateDep)}</td><td>${safeText(s.planDep)}</td><td>${safeText(s.realDep)}</td><td style="${depStyle}">${depVal}</td><td>${stop}</td><td>${pow}</td></tr>`; }).join('')}</tbody>`;
    secE.appendChild(tableE); container.appendChild(secE);
    const secF = document.createElement('div'); secF.className = 'section'; secF.innerHTML = `<h6>F - Kontrola pociągu</h6>`; if (currentReport.sectionF.length === 0) secF.innerHTML += `<div>-</div>`; else { const t = document.createElement('table'); t.className='table-print'; t.innerHTML = `<thead><tr><th>Kontrolujący</th><th>Numer</th><th>Opis</th><th>Uwagi</th></tr></thead><tbody>${currentReport.sectionF.map(c => `<tr><td>${safeText(c.by)}</td><td>${safeText(c.id)}</td><td>${safeText(c.desc)}</td><td>${safeText(c.notes)}</td></tr>`).join('')}</tbody>`; secF.appendChild(t); } container.appendChild(secF);
    const secG = document.createElement('div'); secG.className = 'section'; secG.innerHTML = `<h6>G - Uwagi kierownika pociągu</h6>`; if (currentReport.sectionG.length === 0) secG.innerHTML += `<div>-</div>`; else { const ul = document.createElement('ul'); currentReport.sectionG.forEach(n => { const li = document.createElement('li'); li.textContent = n.text; ul.appendChild(li); }); secG.appendChild(ul); } container.appendChild(secG);
    const footer = document.createElement('div'); footer.className = 'print-footer'; footer.textContent = `Wygenerowano dnia ${nowDateString()} z systemu ERJ`; container.appendChild(footer);
    const filename = `${currentReport.number.replace(/\//g,'-')}.pdf`; await exportPdf(container, filename);
  });

  // Reset modali on close (safety)
  document.querySelectorAll('.modal').forEach(m => { m.addEventListener('hidden.bs.modal', () => { const form = m.querySelector('form'); if (form) { form.setAttribute('data-mode','add'); form.setAttribute('data-index',''); form.reset(); } }); });

  // Ensure body unlocked on modal events
  document.addEventListener('shown.bs.modal', () => { try { document.body.style.overflow = ''; document.body.style.position = ''; document.documentElement.style.overflow = ''; } catch(e){} });
  document.addEventListener('hidden.bs.modal', () => { try { document.querySelectorAll('.modal-backdrop').forEach(b => b.remove()); document.body.classList.remove('modal-open'); document.body.style.overflow = ''; document.body.style.position = ''; document.documentElement.style.overflow = ''; } catch(e){} });
  setInterval(() => { if (document.body.classList.contains('modal-open') && document.querySelectorAll('.modal-backdrop').length === 0) { document.body.classList.remove('modal-open'); document.body.style.overflow = ''; document.body.style.position = ''; document.documentElement.style.overflow = ''; } }, 5000);

  // Init view
  startPanel.style.display = 'block'; reportPanel.style.display = 'none';
});
