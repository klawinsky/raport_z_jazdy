// app.js
import { saveReport, getReport, nextCounter } from './db.js';
import { exportPdf } from './pdf.js';

/* ---------- Helpery ---------- */
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
function isValidTime(t) {
  if (!t) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
function parseDateTime(dateStr, timeStr, fallbackDate) {
  if (!timeStr) return null;
  const useDate = dateStr || fallbackDate;
  if (!useDate) return null;
  const [yyyy, mm, dd] = useDate.split('-').map(Number);
  const [hh, mi] = timeStr.split(':').map(Number);
  return new Date(yyyy, mm-1, dd, hh, mi).getTime();
}
function formatDelayClass(value) {
  if (value == null) return 'delay-zero';
  if (value > 0) return 'delay-pos';
  if (value < 0) return 'delay-neg';
  return 'delay-zero';
}
function formatDelayText(value) {
  if (value == null) return '-';
  return `${value} min`;
}

/* ---------- Autocomplete ---------- */
const sampleStations = [
  'Kraków Główny','Warszawa Centralna','Gdańsk Główny','Poznań Główny','Wrocław Główny',
  'Katowice','Łódź Fabryczna','Sopot','Gdynia Główna','Warszawa Wschodnia'
];
function populateStationsDatalist(list) {
  const dl = document.getElementById('stationsDatalist');
  if (!dl) return;
  dl.innerHTML = '';
  list.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    dl.appendChild(opt);
  });
}

/* ---------- Model raportu ---------- */
function createEmptyReport(number, user) {
  return {
    number,
    createdAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
    createdBy: user,
    currentDriver: user,
    sectionA: { category:'', traction:'', trainNumber:'', route:'', date:'' },
    sectionB: [],
    sectionC: [],
    sectionD: [],
    sectionE: [],
    sectionF: [],
    sectionG: [],
    history: []
  };
}

/* ---------- UI refs ---------- */
// Start panel
const startPanel = document.getElementById('startPanel');
const reportPanel = document.getElementById('reportPanel');
const newReportBtn = document.getElementById('newReportBtn');
const takeReportBtn = document.getElementById('takeReportBtn');
const importBtnStart = document.getElementById('importBtnStart');
const importFileStart = document.getElementById('importFileStart');

// Top info/actions
const reportNumberEl = document.getElementById('reportNumber');
const currentUserEl = document.getElementById('currentUser');
const exportJsonBtn = document.getElementById('exportJson');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const previewPdfBtn = document.getElementById('previewPdf');
const closeReportBtn = document.getElementById('closeReport');

// Section A inputs
const catEl = document.getElementById('cat');
const tractionEl = document.getElementById('traction');
const trainNumberEl = document.getElementById('trainNumber');
const routeEl = document.getElementById('route');
const trainDateEl = document.getElementById('trainDate');

// Lists containers
const tractionList = document.getElementById('tractionList');
const conductorList = document.getElementById('conductorList');
const ordersList = document.getElementById('ordersList');
const stationsList = document.getElementById('stationsList');
const controlsList = document.getElementById('controlsList');
const notesList = document.getElementById('notesList');

// Forms
const formTraction = document.getElementById('formTraction');
const formConductor = document.getElementById('formConductor');
const formOrder = document.getElementById('formOrder');
const formStation = document.getElementById('formStation');
const formControl = document.getElementById('formControl');
const formNote = document.getElementById('formNote');

let currentReport = null;
let currentUser = null;
let stationsSet = new Set(sampleStations);

/* ---------- Start / Przejmij ---------- */
newReportBtn.addEventListener('click', async () => {
  const name = document.getElementById('userName').value.trim();
  const id = document.getElementById('userId').value.trim();
  if (!name || !id) return alert('Podaj imię i nazwisko oraz numer służbowy.');
  currentUser = { name, id };
  const counter = await nextCounter();
  const d = new Date();
  const { DD, MM, YY } = formatDateForNumber(d);
  const XXX = String(counter).padStart(3,'0');
  const number = `${XXX}/${DD}/${MM}/${YY}`;
  currentReport = createEmptyReport(number, currentUser);
  await saveReport(currentReport);
  openReportUI();
});

takeReportBtn.addEventListener('click', async () => {
  const name = document.getElementById('userName').value.trim();
  const id = document.getElementById('userId').value.trim();
  if (!name || !id) return alert('Podaj imię i nazwisko oraz numer służbowy.');
  currentUser = { name, id };
  const num = prompt('Podaj numer raportu w formacie XXX/DD/MM/YY');
  if (!num) return;
  const rep = await getReport(num.trim());
  if (!rep) return alert('Nie znaleziono raportu o podanym numerze.');
  rep.history = rep.history || [];
  rep.history.push({ action: 'przejecie', by: currentUser, at: new Date().toISOString() });
  rep.currentDriver = currentUser;
  rep.lastEditedAt = new Date().toISOString();
  currentReport = rep;
  await saveReport(currentReport);
  openReportUI();
});

/* ---------- Import z panelu startowego ---------- */
importBtnStart.addEventListener('click', () => importFileStart.click());
importFileStart.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  try {
    const rep = JSON.parse(text);
    if (!rep.number) throw new Error('Nieprawidłowy plik');
    await saveReport(rep);
    alert('Raport zaimportowany. Możesz go teraz przejąć wpisując numer w funkcji Przejmij raport.');
  } catch (err) {
    alert('Błąd importu: ' + err.message);
  }
});

/* ---------- UI otwieranie raportu ---------- */
function openReportUI() {
  startPanel.style.display = 'none';
  reportPanel.style.display = 'block';
  populateStationsDatalist(Array.from(stationsSet));
  renderReport();
  attachSectionHandlers();
}

/* ---------- Render ---------- */
function renderReport() {
  reportNumberEl.textContent = currentReport.number;
  currentUserEl.textContent = `${currentReport.currentDriver.name} (${currentReport.currentDriver.id})`;

  // Sekcja A
  catEl.value = currentReport.sectionA.category || '';
  tractionEl.value = currentReport.sectionA.traction || '';
  trainNumberEl.value = currentReport.sectionA.trainNumber || '';
  routeEl.value = currentReport.sectionA.route || '';
  trainDateEl.value = currentReport.sectionA.date || '';

  // Sekcje B–G
  renderList(tractionList, currentReport.sectionB, renderTractionRow);
  renderList(conductorList, currentReport.sectionC, renderConductorRow);
  renderList(ordersList, currentReport.sectionD, renderOrderRow);
  renderList(stationsList, currentReport.sectionE, renderStationRow);
  renderList(controlsList, currentReport.sectionF, renderControlRow);
  renderList(notesList, currentReport.sectionG, renderNoteRow);
}
function renderList(container, arr, rowRenderer) {
  container.innerHTML = '';
  arr.forEach((item, idx) => {
    const row = rowRenderer(item, idx);
    container.appendChild(row);
  });
}

/* ---------- Sekcja B ---------- */
function renderTractionRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'd-flex justify-content-between align-items-center station-row';
  div.innerHTML = `
    <div>
      <strong>${item.name}</strong> (${item.id}) · ZDP: ${item.zdp} · Lok: ${item.loco || '-'} [${item.from || '-'} → ${item.to || '-'}]
    </div>
    <div>
      <button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="traction">Edytuj</button>
      <button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="traction">Usuń</button>
    </div>`;
  div.querySelector('[data-del]').addEventListener('click', async () => {
    currentReport.sectionB.splice(idx,1);
    await saveAndRender();
  });
  div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('traction', idx));
  return div;
}
formTraction.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('t_name').value.trim();
  const id = document.getElementById('t_id').value.trim();
  const zdp = document.getElementById('t_zdp').value;
  const loco = document.getElementById('t_loco').value.trim();
  const from = document.getElementById('t_from').value.trim();
  const to = document.getElementById('t_to').value.trim();
  if (!name || !id) return alert('Imię i numer są wymagane.');
  const mode = formTraction.getAttribute('data-mode');
  if (mode === 'edit') {
    const idx = Number(formTraction.getAttribute('data-index'));
    currentReport.sectionB[idx] = { name, id, zdp, loco, from, to };
  } else {
    currentReport.sectionB.push({ name, id, zdp, loco, from, to });
  }
  if (from) stationsSet.add(from);
  if (to) stationsSet.add(to);
  populateStationsDatalist(Array.from(stationsSet));
  formTraction.reset();
  bootstrap.Modal.getInstance(document.getElementById('modalTraction')).hide();
  await saveAndRender();
});

/* ---------- Sekcja C ---------- */
function renderConductorRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'd-flex justify-content-between align-items-center station-row';
  div.innerHTML = `
    <div>
      <strong>${item.name}</strong> (${item.id}) · ZDP: ${item.zdp} · Funkcja: ${item.role} [${item.from || '-'} → ${item.to || '-'}]
    </div>
    <div>
      <button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="conductor">Edytuj</button>
      <button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="conductor">Usuń</button>
    </div>`;
  div.querySelector('[data-del]').addEventListener('click', async () => {
    currentReport.sectionC.splice(idx,1);
    await saveAndRender();
  });
  div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('conductor', idx));
  return div;
}
formConductor.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('c_name').value.trim();
  const id = document.getElementById('c_id').value.trim();
  const zdp = document.getElementById('c_zdp').value;
  const role = document.getElementById('c_role').value;
  const from = document.getElementById('c_from').value.trim();
  const to = document.getElementById('c_to').value.trim();
  if (!name || !id) return alert('Imię i numer są wymagane.');
  const mode = formConductor.getAttribute('data-mode');
  if (mode === 'edit') {
    const idx = Number(formConductor.getAttribute('data-index'));
    currentReport.sectionC[idx] = { name, id, zdp, role, from, to };
  } else {
    currentReport.sectionC.push({ name, id, zdp, role, from, to });
  }
  if (from) stationsSet.add(from);
  if (to) stationsSet.add(to);
  populateStationsDatalist(Array.from(stationsSet));
  formConductor.reset();
  bootstrap.Modal.getInstance(document.getElementById('modalConductor')).hide();
  await saveAndRender();
});

/* ---------- Sekcja D ---------- */
function renderOrderRow(item, idx) {
  const meta = `${item.number ? 'Nr: ' + item.number + ' · ' : ''}${item.time ? 'Godz.: ' + item.time : ''}`;
  const div = document.createElement('div');
  div.className = 'd-flex justify-content-between align-items-center station-row';
  div.innerHTML = `
    <div>${item.text} <div class="small text-muted">${meta} · Źródło: ${item.source}</div></div>
    <div>
      <button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="order">Edytuj</button>
      <button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="order">Usuń</button>
    </div>`;
  div.querySelector('[data-del]').addEventListener('click', async () => {
    currentReport.sectionD.splice(idx,1);
    await saveAndRender();
  });
  div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('order', idx));
  return div;
}
formOrder.addEventListener('submit', async (e) => {
  e.preventDefault();
  const number = document.getElementById('o_number').value.trim();
  const time = document.getElementById('o_time').value.trim();
  const text = document.getElementById('o_text').value.trim();
  const source = document.getElementById('o_source').value;
  if (!text) return alert('Treść dyspozycji jest wymagana.');
  if (!isValidTime(time)) return alert('Godzina musi być w formacie HH:MM lub pusta.');
  const mode = formOrder.getAttribute('data-mode');
  const entry = { number, time, text, source };
  if (mode === 'edit') {
    const idx = Number(formOrder.getAttribute('data-index'));
    currentReport.sectionD[idx] = entry;
  } else {
    currentReport.sectionD.push(entry);
  }
  formOrder.reset();
  bootstrap.Modal.getInstance(document.getElementById('modalOrder')).hide();
  await saveAndRender();
});

/* ---------- Sekcja E ---------- */
function renderStationRow(item, idx) {
  const arrClass = formatDelayClass(item.delayArrMinutes);
  const depClass = formatDelayClass(item.delayDepMinutes);
  const arrText = formatDelayText(item.delayArrMinutes);
  const depText = formatDelayText(item.delayDepMinutes);
  const stopText = item.realStopMinutes != null ? `${item.realStopMinutes} min` : '-';
  const div = document.createElement('div');
  div.className = 'station-row';
  div.innerHTML = `
    <div class="d-flex justify-content-between">
      <div>
        <strong>${item.station}</strong>
        <div class="small text-muted">Data przyj.: ${item.dateArr || '-'} · Plan: ${item.planArr || '-'} · Real: ${item.realArr || '-'}</div>
        <div class="small">Odchylenie przyj.: <span class="${arrClass}">${arrText}</span></div>
        <div class="small text-muted">Data odj.: ${item.dateDep || '-'} · Plan: ${item.planDep || '-'} · Real: ${item.realDep || '-'}</div>
        <div class="small">Odchylenie odj.: <span class="${depClass}">${depText}</span></div>
        <div class="small">Postój realny: ${stopText}</div>
        <div class="small text-muted">Powód: ${item.delayReason || '-'}; Rozkazy pisemne: ${item.writtenOrders || '-'}</div>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="station">Edytuj</button>
        <button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="station">Usuń</button>
      </div>
    </div>`;
  div.querySelector('[data-del]').addEventListener('click', async () => {
    currentReport.sectionE.splice(idx,1);
    await saveAndRender();
  });
  div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('station', idx));
  return div;
}
formStation.addEventListener('submit', async (e) => {
  e.preventDefault();
  const station = document.getElementById('s_station').value.trim();
  const dateArr = document.getElementById('s_dateArr').value || trainDateEl.value || currentReport.sectionA.date || '';
  const dateDep = document.getElementById('s_dateDep').value || trainDateEl.value || currentReport.sectionA.date || '';
  const planArr = document.getElementById('s_planArr').value.trim();
  const planDep = document.getElementById('s_planDep').value.trim();
  const realArr = document.getElementById('s_realArr').value.trim();
  const realDep = document.getElementById('s_realDep').value.trim();
  const delayReason = document.getElementById('s_delayReason').value.trim();
  const writtenOrders = document.getElementById('s_writtenOrders').value.trim();
  if (!station) return alert('Nazwa stacji jest wymagana.');
  if (!isValidTime(planArr) || !isValidTime(planDep) || !isValidTime(realArr) || !isValidTime(realDep)) {
    return alert('Czas musi być w formacie HH:MM (00:00–23:59) lub pole może być puste.');
  }

  const planArrDT = parseDateTime(dateArr, planArr, currentReport.sectionA.date);
  const realArrDT = parseDateTime(dateArr, realArr, currentReport.sectionA.date);
  const planDepDT = parseDateTime(dateDep, planDep, currentReport.sectionA.date);
  const realDepDT = parseDateTime(dateDep, realDep, currentReport.sectionA.date);

  let delayArrMinutes = null;
  if (planArrDT && realArrDT) delayArrMinutes = Math.round((realArrDT - planArrDT)/60000);

  let delayDepMinutes = null;
  if (planDepDT && realDepDT) delayDepMinutes = Math.round((realDepDT - planDepDT)/60000);

  let realStopMinutes = null;
  if (realArrDT && realDepDT) realStopMinutes = Math.round((realDepDT - realArrDT)/60000);

  if (!stationsSet.has(station)) {
    stationsSet.add(station);
    populateStationsDatalist(Array.from(stationsSet));
  }

  const mode = formStation.getAttribute('data-mode');
  const entry = {
    station, dateArr, dateDep,
    planArr, planDep, realArr, realDep,
    delayArrMinutes, delayDepMinutes, realStopMinutes,
    delayReason, writtenOrders
  };
  if (mode === 'edit') {
    const idx = Number(formStation.getAttribute('data-index'));
    currentReport.sectionE[idx] = entry;
  } else {
    currentReport.sectionE.push(entry);
  }
  formStation.reset();
  bootstrap.Modal.getInstance(document.getElementById('modalStation')).hide();
  await saveAndRender();
});

/* ---------- Sekcja F ---------- */
function renderControlRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'station-row d-flex justify-content-between align-items-center';
  div.innerHTML = `
    <div>
      <strong>${item.by}</strong> (${item.id || '-'})
      <div class="small text-muted">${item.desc || '-'}</div>
      <div class="small text-muted">Uwagi: ${item.notes || '-'}</div>
    </div>
    <div>
      <button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="control">Edytuj</button>
      <button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="control">Usuń</button>
    </div>`;
  div.querySelector('[data-del]').addEventListener('click', async () => {
    currentReport.sectionF.splice(idx,1);
    await saveAndRender();
  });
  div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('control', idx));
  return div;
}
formControl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const by = document.getElementById('f_by').value.trim();
  const id = document.getElementById('f_id').value.trim();
  const desc = document.getElementById('f_desc').value.trim();
  const notes = document.getElementById('f_notes').value.trim();
  if (!by) return alert('Imię i nazwisko kontrolującego jest wymagane.');
  const mode = formControl.getAttribute('data-mode');
  const entry = { by, id, desc, notes };
  if (mode === 'edit') {
    const idx = Number(formControl.getAttribute('data-index'));
    currentReport.sectionF[idx] = entry;
  } else {
    currentReport.sectionF.push(entry);
  }
  formControl.reset();
  bootstrap.Modal.getInstance(document.getElementById('modalControl')).hide();
  await saveAndRender();
});

/* ---------- Sekcja G ---------- */
function renderNoteRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'station-row d-flex justify-content-between align-items-center';
  div.innerHTML = `
    <div>${item.text}</div>
    <div>
      <button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="note">Edytuj</button>
      <button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="note">Usuń</button>
    </div>`;
  div.querySelector('[data-del]').addEventListener('click', async () => {
    currentReport.sectionG.splice(idx,1);
    await saveAndRender();
  });
  div.querySelector('[data-edit]').addEventListener('click', () => openEditModal('note', idx));
  return div;
}
formNote.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('n_text').value.trim();
  if (!text) return alert('Treść uwagi jest wymagana.');
  const mode = formNote.getAttribute('data-mode');
  const entry = { text };
  if (mode === 'edit') {
    const idx = Number(formNote.getAttribute('data-index'));
    currentReport.sectionG[idx] = entry;
  } else {
    currentReport.sectionG.push(entry);
  }
  formNote.reset();
  bootstrap.Modal.getInstance(document.getElementById('modalNote')).hide();
  await saveAndRender();
});

/* ---------- Save & autosave ---------- */
async function saveAndRender() {
  currentReport.lastEditedAt = new Date().toISOString();
  currentReport.sectionA = {
    category: catEl.value,
    traction: tractionEl.value,
    trainNumber: trainNumberEl.value,
    route: routeEl.value,
    date: trainDateEl.value
  };
  await saveReport(currentReport);
  renderReport();
}
function attachSectionHandlers() {
  [catEl, tractionEl, trainNumberEl, routeEl, trainDateEl].forEach(el => {
    el.addEventListener('change', saveAndRender);
    el.addEventListener('input', saveAndRender);
  });
}

/* ---------- Edit modal helper ---------- */
function openEditModal(type, idx) {
  if (!currentReport) return;
  if (type === 'traction') {
    const item = currentReport.sectionB[idx];
    document.getElementById('t_name').value = item.name || '';
    document.getElementById('t_id').value = item.id || '';
    document.getElementById('t_zdp').value = item.zdp || 'WAW';
    document.getElementById('t_loco').value = item.loco || '';
    document.getElementById('t_from').value = item.from || '';
    document.getElementById('t_to').value = item.to || '';
    formTraction.setAttribute('data-mode','edit');
    formTraction.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalTraction')).show();
  } else if (type === 'conductor') {
    const item = currentReport.sectionC[idx];
    document.getElementById('c_name').value = item.name || '';
    document.getElementById('c_id').value = item.id || '';
    document.getElementById('c_zdp').value = item.zdp || 'WAW';
    document.getElementById('c_role').value = item.role || 'KP';
    document.getElementById('c_from').value = item.from || '';
    document.getElementById('c_to').value = item.to || '';
    formConductor.setAttribute('data-mode','edit');
    formConductor.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalConductor')).show();
  } else if (type === 'order') {
    const item = currentReport.sectionD[idx];
    document.getElementById('o_number').value = item.number || '';
    document.getElementById('o_time').value = item.time || '';
    document.getElementById('o_text').value = item.text || '';
    document.getElementById('o_source').value = item.source || 'Dyspozytura';
    formOrder.setAttribute('data-mode','edit');
    formOrder.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalOrder')).show();
  } else if (type === 'station') {
    const item = currentReport.sectionE[idx];
    document.getElementById('s_station').value = item.station || '';
    document.getElementById('s_dateArr').value = item.dateArr || '';
    document.getElementById('s_dateDep').value = item.dateDep || '';
    document.getElementById('s_planArr').value = item.planArr || '';
    document.getElementById('s_planDep').value = item.planDep || '';
    document.getElementById('s_realArr').value = item.realArr || '';
    document.getElementById('s_realDep').value = item.realDep || '';
    document.getElementById('s_delayReason').value = item.delayReason || '';
    document.getElementById('s_writtenOrders').value = item.writtenOrders || '';
    formStation.setAttribute('data-mode','edit');
    formStation.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalStation')).show();
  } else if (type === 'control') {
    const item = currentReport.sectionF[idx];
    document.getElementById('f_by').value = item.by || '';
    document.getElementById('f_id').value = item.id || '';
    document.getElementById('f_desc').value = item.desc || '';
    document.getElementById('f_notes').value = item.notes || '';
    formControl.setAttribute('data-mode','edit');
    formControl.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalControl')).show();
  } else if (type === 'note') {
    const item = currentReport.sectionG[idx];
    document.getElementById('n_text').value = item.text || '';
    formNote.setAttribute('data-mode','edit');
    formNote.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalNote')).show();
  }
}

/* ---------- Reset modali ---------- */
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('hidden.bs.modal', () => {
    const form = m.querySelector('form');
    if (form) {
      form.setAttribute('data-mode','add');
      form.setAttribute('data-index','');
      form.reset();
    }
  });
});

/* ---------- Export / Import JSON (panel raportu) ---------- */
exportJsonBtn.addEventListener('click', () => {
  if (!currentReport) return alert('Brak otwartego raportu.');
  const dataStr = JSON.stringify(currentReport, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentReport.number.replace(/\//g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  try {
    const rep = JSON.parse(text);
    if (!rep.number) throw new Error('Nieprawidłowy plik');
    currentReport = rep;
    (rep.sectionE || []).forEach(s => { if (s.station) stationsSet.add(s.station); });
    populateStationsDatalist(Array.from(stationsSet));
    await saveReport(currentReport);
    renderReport();
    alert('Raport zaimportowany i zapisany lokalnie.');
  } catch (err) {
    alert('Błąd importu: ' + err.message);
  }
});

/* ---------- PDF ---------- */
previewPdfBtn.addEventListener('click', async () => {
  if (!currentReport) return alert('Brak otwartego raportu.');
  const container = document.createElement('div');
  container.className = 'print-container';

  const header = document.createElement('div');
  header.className = 'print-header';
  header.innerHTML = `
    <div class="print-title">Raport z jazdy pociągu</div>
    <div class="print-meta">Numer: ${currentReport.number} · Prowadzący: ${currentReport.currentDriver.name} (${currentReport.currentDriver.id})</div>
    <div class="print-meta">Wygenerowano dnia ${nowDateString()}</div>
  `;
  container.appendChild(header);

  const secA = document.createElement('div');
  secA.className = 'section';
  secA.innerHTML = `<h6>A - Dane ogólne</h6>
    <table class="table-print">
      <tbody>
        <tr><th>Kategoria</th><td>${currentReport.sectionA.category || '-'}</td></tr>
        <tr><th>Trakcja</th><td>${currentReport.sectionA.traction || '-'}</td></tr>
        <tr><th>Numer pociągu</th><td>${currentReport.sectionA.trainNumber || '-'}</td></tr>
        <tr><th>Relacja</th><td>${currentReport.sectionA.route || '-'}</td></tr>
        <tr><th>Data kursu</th><td>${currentReport.sectionA.date || '-'}</td></tr>
      </tbody>
    </table>`;
  container.appendChild(secA);

  const makeCrewTable = (title, arr, cols) => {
    const s = document.createElement('div');
    s.className = 'section';
    s.innerHTML = `<h6>${title}</h6>`;
    const table = document.createElement('table');
    table.className = 'table-print';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    if (arr.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${cols.length}">-</td></tr>`;
    } else {
      arr.forEach(it => {
        const cells = cols.map(k => `<td>${(it[k] !== undefined ? it[k] : (it[k.toLowerCase()] || '-'))}</td>`).join('');
        tbody.innerHTML += `<tr>${cells}</tr>`;
      });
    }
    table.appendChild(tbody);
    s.appendChild(table);
    return s;
  };

  container.appendChild(makeCrewTable('B - Drużyna trakcyjna', currentReport.sectionB, ['name','id','zdp','loco','from','to']));
  container.appendChild(makeCrewTable('C - Drużyna konduktorska', currentReport.sectionC, ['name','id','zdp','role','from','to']));

  const secD = document.createElement('div');
  secD.className = 'section';
  secD.innerHTML = `<h6>D - Dyspozycje</h6>`;
  if (currentReport.sectionD.length === 0) {
    secD.innerHTML += `<div>-</div>`;
  } else {
    const table = document.createElement('table');
    table.className = 'table-print';
    table.innerHTML = `<thead><tr><th>Nr</th><th>Godz.</th><th>Treść</th><th>Źródło</th></tr></thead><tbody>${
      currentReport.sectionD.map(o => `<tr><td>${o.number || '-'}</td><td>${o.time || '-'}</td><td>${o.text}</td><td>${o.source || '-'}</td></tr>`).join('')
    }</tbody>`;
    secD.appendChild(table);
  }
  container.appendChild(secD);

  const secE = document.createElement('div');
  secE.className = 'section';
  secE.innerHTML = `<h6>E - Dane o jeździe pociągu</h6>`;
  const tableE = document.createElement('table');
  tableE.className = 'table-print';
  tableE.innerHTML = `
    <thead>
      <tr>
        <th>Stacja</th>
        <th>Data przyj.</th>
        <th>Plan przyj.</th>
        <th>Real przyj.</th>
        <th>Odchylenie przyj.</th>
        <th>Data odj.</th>
        <th>Plan odj.</th>
        <th>Real odj.</th>
        <th>Odchylenie odj.</th>
        <th>Postój (min)</th>
        <th>Powód / Rozkazy</th>
      </tr>
    </thead>
    <tbody>
      ${currentReport.sectionE.length === 0 ? `<tr><td colspan="11">-</td></tr>` : currentReport.sectionE.map(s => {
        const arrVal = (s.delayArrMinutes != null) ? `${s.delayArrMinutes} min` : '-';
        const depVal = (s.delayDepMinutes != null) ? `${s.delayDepMinutes} min` : '-';
        const arrStyle = s.delayArrMinutes == null ? '' : (s.delayArrMinutes > 0 ? 'color:red;font-weight:600;' : (s.delayArrMinutes < 0 ? 'color:green;font-weight:600;' : 'color:black;font-weight:600;'));
        const depStyle = s.delayDepMinutes == null ? '' : (s.delayDepMinutes > 0 ? 'color:red;font-weight:600;' : (s.delayDepMinutes < 0 ? 'color:green;font-weight:600;' : 'color:black;font-weight:600;'));
        const stop = s.realStopMinutes != null ? `${s.realStopMinutes}` : '-';
        const pow = (s.delayReason || '-') + (s.writtenOrders ? ' / ' + s.writtenOrders : '');
        return `<tr>
          <td>${s.station || '-'}</td>
          <td>${s.dateArr || '-'}</td>
          <td>${s.planArr || '-'}</td>
          <td>${s.realArr || '-'}</td>
          <td style="${arrStyle}">${arrVal}</td>
          <td>${s.dateDep || '-'}</td>
          <td>${s.planDep || '-'}</td>
          <td>${s.realDep || '-'}</td>
          <td style="${depStyle}">${depVal}</td>
          <td>${stop}</td>
          <td>${pow}</td>
        </tr>`;
      }).join('')}
    </tbody>`;
  secE.appendChild(tableE);
  container.appendChild(secE);

  const secF = document.createElement('div');
  secF.className = 'section';
  secF.innerHTML = `<h6>F - Kontrola pociągu</h6>`;
  if (currentReport.sectionF.length === 0) secF.innerHTML += `<div>-</div>`;
  else {
    const t = document.createElement('table'); t.className='table-print';
    t.innerHTML = `<thead><tr><th>Kontrolujący</th><th>Numer</th><th>Opis</th><th>Uwagi</th></tr></thead><tbody>${
      currentReport.sectionF.map(c => `<tr><td>${c.by}</td><td>${c.id || '-'}</td><td>${c.desc || '-'}</td><td>${c.notes || '-'}</td></tr>`).join('')
    }</tbody>`;
    secF.appendChild(t);
  }
  container.appendChild(secF);

  const secG = document.createElement('div');
  secG.className = 'section';
  secG.innerHTML = `<h6>G - Uwagi kierownika pociągu</h6>`;
  if (currentReport.sectionG.length === 0) secG.innerHTML += `<div>-</div>`;
  else {
    const ul = document.createElement('ul');
    currentReport.sectionG.forEach(n => { const li = document.createElement('li'); li.textContent = n.text; ul.appendChild(li); });
    secG.appendChild(ul);
  }
  container.appendChild(secG);

  const footer = document.createElement('div');
  footer.className = 'print-footer';
  footer.textContent = `Wygenerowano dnia ${nowDateString()} z systemu ERJ`;
  container.appendChild(footer);

  const filename = `${currentReport.number.replace(/\//g,'-')}.pdf`;
  await exportPdf(container, filename);
});

/* ---------- Zamknij raport ---------- */
closeReportBtn.addEventListener('click', () => {
  if (!confirm('Zamknąć widok raportu i wrócić do panelu startowego?')) return;
  currentReport = null;
  currentUser = null;
  reportPanel.style.display = 'none';
  startPanel.style.display = 'block';
});

/* ---------- Save & autosave ---------- */
async function saveAndRender() {
  currentReport.lastEditedAt = new Date().toISOString();
  currentReport.sectionA = {
    category: catEl.value,
    traction: tractionEl.value,
    trainNumber: trainNumberEl.value,
    route: routeEl.value,
    date: trainDateEl.value
  };
  await saveReport(currentReport);
  renderReport();
}
function attachSectionHandlers() {
  [catEl, tractionEl, trainNumberEl, routeEl, trainDateEl].forEach(el => {
    el.addEventListener('change', saveAndRender);
    el.addEventListener('input', saveAndRender);
  });
}

/* ---------- Edit modal helper ---------- */
function openEditModal(type, idx) {
  if (!currentReport) return;
  if (type === 'traction') {
    const item = currentReport.sectionB[idx];
    document.getElementById('t_name').value = item.name || '';
    document.getElementById('t_id').value = item.id || '';
    document.getElementById('t_zdp').value = item.zdp || 'WAW';
    document.getElementById('t_loco').value = item.loco || '';
    document.getElementById('t_from').value = item.from || '';
    document.getElementById('t_to').value = item.to || '';
    formTraction.setAttribute('data-mode','edit');
    formTraction.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalTraction')).show();
  } else if (type === 'conductor') {
    const item = currentReport.sectionC[idx];
    document.getElementById('c_name').value = item.name || '';
    document.getElementById('c_id').value = item.id || '';
    document.getElementById('c_zdp').value = item.zdp || 'WAW';
    document.getElementById('c_role').value = item.role || 'KP';
    document.getElementById('c_from').value = item.from || '';
    document.getElementById('c_to').value = item.to || '';
    formConductor.setAttribute('data-mode','edit');
    formConductor.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalConductor')).show();
  } else if (type === 'order') {
    const item = currentReport.sectionD[idx];
    document.getElementById('o_number').value = item.number || '';
    document.getElementById('o_time').value = item.time || '';
    document.getElementById('o_text').value = item.text || '';
    document.getElementById('o_source').value = item.source || 'Dyspozytura';
    formOrder.setAttribute('data-mode','edit');
    formOrder.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalOrder')).show();
  } else if (type === 'station') {
    const item = currentReport.sectionE[idx];
    document.getElementById('s_station').value = item.station || '';
    document.getElementById('s_dateArr').value = item.dateArr || '';
    document.getElementById('s_dateDep').value = item.dateDep || '';
    document.getElementById('s_planArr').value = item.planArr || '';
    document.getElementById('s_planDep').value = item.planDep || '';
    document.getElementById('s_realArr').value = item.realArr || '';
    document.getElementById('s_realDep').value = item.realDep || '';
    document.getElementById('s_delayReason').value = item.delayReason || '';
    document.getElementById('s_writtenOrders').value = item.writtenOrders || '';
    formStation.setAttribute('data-mode','edit');
    formStation.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalStation')).show();
  } else if (type === 'control') {
    const item = currentReport.sectionF[idx];
    document.getElementById('f_by').value = item.by || '';
    document.getElementById('f_id').value = item.id || '';
    document.getElementById('f_desc').value = item.desc || '';
    document.getElementById('f_notes').value = item.notes || '';
    formControl.setAttribute('data-mode','edit');
    formControl.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalControl')).show();
  } else if (type === 'note') {
    const item = currentReport.sectionG[idx];
    document.getElementById('n_text').value = item.text || '';
    formNote.setAttribute('data-mode','edit');
    formNote.setAttribute('data-index', idx);
    new bootstrap.Modal(document.getElementById('modalNote')).show();
  }
}

/* ---------- Reset modali ---------- */
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('hidden.bs.modal', () => {
    const form = m.querySelector('form');
    if (form) {
      form.setAttribute('data-mode','add');
      form.setAttribute('data-index','');
      form.reset();
    }
  });
});

/* ---------- Inicjalizacja ---------- */
(function init() {
  populateStationsDatalist(Array.from(stationsSet));
})();
