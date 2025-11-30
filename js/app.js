// app.js
import { saveReport, getReport, nextCounter, listReports } from './db.js';
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
function timeToMinutes(t) {
  // t format HH:MM
  if (!t) return null;
  const [h,m] = t.split(':').map(Number);
  return h*60 + m;
}
function minutesDiff(minA, minB) {
  if (minA==null || minB==null) return null;
  return minA - minB;
}

/* ---------- Model raportu ---------- */
function createEmptyReport(number, user) {
  return {
    number,
    createdAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
    createdBy: user,
    currentDriver: user,
    sectionA: { category:'', traction:'', trainNumber:'', route:'' },
    sectionB: [], // traction crew
    sectionC: [], // conductor crew
    sectionD: [], // orders
    sectionE: [], // stations
    sectionF: [], // controls
    sectionG: [], // notes
    history: []
  };
}

/* ---------- UI references ---------- */
const startPanel = document.getElementById('startPanel');
const reportPanel = document.getElementById('reportPanel');
const newReportBtn = document.getElementById('newReportBtn');
const takeReportBtn = document.getElementById('takeReportBtn');
const importBtnStart = document.getElementById('importBtnStart');
const importFileStart = document.getElementById('importFileStart');

const reportNumberEl = document.getElementById('reportNumber');
const currentUserEl = document.getElementById('currentUser');

const exportJsonBtn = document.getElementById('exportJson');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const previewPdfBtn = document.getElementById('previewPdf');
const closeReportBtn = document.getElementById('closeReport');

const catEl = document.getElementById('cat');
const tractionEl = document.getElementById('traction');
const trainNumberEl = document.getElementById('trainNumber');
const routeEl = document.getElementById('route');

const addTractionBtn = document.getElementById('addTractionBtn');
const tractionList = document.getElementById('tractionList');

const addConductorBtn = document.getElementById('addConductorBtn');
const conductorList = document.getElementById('conductorList');

const addOrderBtn = document.getElementById('addOrderBtn');
const ordersList = document.getElementById('ordersList');

const addStationBtn = document.getElementById('addStationBtn');
const stationsList = document.getElementById('stationsList');

const addControlBtn = document.getElementById('addControlBtn');
const controlsList = document.getElementById('controlsList');

const addNoteBtn = document.getElementById('addNoteBtn');
const notesList = document.getElementById('notesList');

let currentReport = null;
let currentUser = null;

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
  // dodaj historię przejęcia
  rep.history = rep.history || [];
  rep.history.push({ action: 'przejecie', by: currentUser, at: new Date().toISOString() });
  rep.currentDriver = currentUser;
  rep.lastEditedAt = new Date().toISOString();
  currentReport = rep;
  await saveReport(currentReport);
  openReportUI();
});

/* Import z panelu startowego */
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
  renderReport();
  attachSectionHandlers();
}

/* ---------- Render i autosave ---------- */
function renderReport() {
  reportNumberEl.textContent = currentReport.number;
  currentUserEl.textContent = `${currentReport.currentDriver.name} (${currentReport.currentDriver.id})`;

  // Sekcja A
  catEl.value = currentReport.sectionA.category || '';
  tractionEl.value = currentReport.sectionA.traction || '';
  trainNumberEl.value = currentReport.sectionA.trainNumber || '';
  routeEl.value = currentReport.sectionA.route || '';

  // lists
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

/* ---------- Sekcja B render / add ---------- */
function renderTractionRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'd-flex justify-content-between align-items-center station-row';
  div.innerHTML = `
    <div>
      <strong>${item.name}</strong> (${item.id}) - ZDP: ${item.zdp} - Lok: ${item.loco} [${item.from} → ${item.to}]
    </div>
    <div>
      <button class="btn btn-sm btn-outline-danger btn-del" data-idx="${idx}">Usuń</button>
    </div>`;
  div.querySelector('.btn-del').addEventListener('click', async () => {
    currentReport.sectionB.splice(idx,1);
    await saveAndRender();
  });
  return div;
}
addTractionBtn.addEventListener('click', async () => {
  const name = prompt('Imię i nazwisko pracownika:');
  if (!name) return;
  const id = prompt('Numer służbowy:');
  if (!id) return;
  const zdp = prompt('ZDP (WAW, KRK, GDY, POZ):');
  const loco = prompt('Oznaczenie lokomotywy:');
  const from = prompt('Stacja od:');
  const to = prompt('Stacja do:');
  currentReport.sectionB.push({ name, id, zdp, loco, from, to });
  await saveAndRender();
});

/* ---------- Sekcja C render / add ---------- */
function renderConductorRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'd-flex justify-content-between align-items-center station-row';
  div.innerHTML = `
    <div>
      <strong>${item.name}</strong> (${item.id}) - ZDP: ${item.zdp} - Funkcja: ${item.role}
    </div>
    <div>
      <button class="btn btn-sm btn-outline-danger btn-del" data-idx="${idx}">Usuń</button>
    </div>`;
  div.querySelector('.btn-del').addEventListener('click', async () => {
    currentReport.sectionC.splice(idx,1);
    await saveAndRender();
  });
  return div;
}
addConductorBtn.addEventListener('click', async () => {
  const name = prompt('Imię i nazwisko konduktora:');
  if (!name) return;
  const id = prompt('Numer służbowy:');
  if (!id) return;
  const zdp = prompt('ZDP (WAW, KRK, GDY, POZ):');
  const role = prompt('Funkcja (KP, S, B, K):');
  currentReport.sectionC.push({ name, id, zdp, role });
  await saveAndRender();
});

/* ---------- Sekcja D (dyspozycje) ---------- */
function renderOrderRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'd-flex justify-content-between align-items-center station-row';
  div.innerHTML = `
    <div>
      ${item.text} <div class="small text-muted">Źródło: ${item.source}</div>
    </div>
    <div>
      <button class="btn btn-sm btn-outline-danger btn-del" data-idx="${idx}">Usuń</button>
    </div>`;
  div.querySelector('.btn-del').addEventListener('click', async () => {
    currentReport.sectionD.splice(idx,1);
    await saveAndRender();
  });
  return div;
}
addOrderBtn.addEventListener('click', async () => {
  const text = prompt('Treść dyspozycji:');
  if (!text) return;
  const source = prompt('Źródło (Dyspozytura, PKP PLK, Inne):','Dyspozytura');
  currentReport.sectionD.push({ text, source });
  await saveAndRender();
});

/* ---------- Sekcja E (stacje) ---------- */
function renderStationRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'station-row';
  const delayText = item.delayMinutes != null ? `${item.delayMinutes} min` : '-';
  const stopText = item.realStopMinutes != null ? `${item.realStopMinutes} min` : '-';
  div.innerHTML = `
    <div class="d-flex justify-content-between">
      <div>
        <strong>${item.station}</strong>
        <div class="small text-muted">Plan: ${item.planArr || '-'} → ${item.planDep || '-'}; Real: ${item.realArr || '-'} → ${item.realDep || '-'}</div>
        <div class="small">Opóźnienie/przyspieszenie: ${delayText}; Postój realny: ${stopText}</div>
        <div class="small text-muted">Powód: ${item.delayReason || '-'}; Rozkazy pisemne: ${item.writtenOrders || '-'}</div>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger btn-del" data-idx="${idx}">Usuń</button>
      </div>
    </div>`;
  div.querySelector('.btn-del').addEventListener('click', async () => {
    currentReport.sectionE.splice(idx,1);
    await saveAndRender();
  });
  return div;
}
addStationBtn.addEventListener('click', async () => {
  const station = prompt('Nazwa stacji:');
  if (!station) return;
  const planArr = prompt('Planowy przyjazd (HH:MM):','');
  const planDep = prompt('Planowy odjazd (HH:MM):','');
  const realArr = prompt('Realny przyjazd (HH:MM):','');
  const realDep = prompt('Realny odjazd (HH:MM):','');
  // obliczenia
  const planArrMin = timeToMinutes(planArr);
  const realArrMin = timeToMinutes(realArr);
  let delayMinutes = null;
  if (planArrMin != null && realArrMin != null) delayMinutes = realArrMin - planArrMin;
  const realDepMin = timeToMinutes(realDep);
  let realStopMinutes = null;
  if (realArrMin != null && realDepMin != null) realStopMinutes = realDepMin - realArrMin;
  const delayReason = prompt('Powód opóźnienia (jeśli wystąpił):','');
  const writtenOrders = prompt('Otrzymane rozkazy pisemne (jeśli wystąpiły):','');
  currentReport.sectionE.push({
    station, planArr, planDep, realArr, realDep,
    delayMinutes, realStopMinutes, delayReason, writtenOrders
  });
  await saveAndRender();
});

/* ---------- Sekcja F (kontrole) ---------- */
function renderControlRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'station-row d-flex justify-content-between align-items-center';
  div.innerHTML = `
    <div>
      <strong>${item.by}</strong> (${item.id})<div class="small text-muted">${item.desc}</div><div class="small text-muted">Uwagi: ${item.notes || '-'}</div>
    </div>
    <div>
      <button class="btn btn-sm btn-outline-danger btn-del" data-idx="${idx}">Usuń</button>
    </div>`;
  div.querySelector('.btn-del').addEventListener('click', async () => {
    currentReport.sectionF.splice(idx,1);
    await saveAndRender();
  });
  return div;
}
addControlBtn.addEventListener('click', async () => {
  const by = prompt('Imię i nazwisko kontrolującego:');
  if (!by) return;
  const id = prompt('Numer służbowy kontrolującego:');
  const desc = prompt('Opis przeprowadzonej kontroli:','');
  const notes = prompt('Uwagi:','');
  currentReport.sectionF.push({ by, id, desc, notes });
  await saveAndRender();
});

/* ---------- Sekcja G (uwagi) ---------- */
function renderNoteRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'station-row d-flex justify-content-between align-items-center';
  div.innerHTML = `
    <div>${item.text}</div>
    <div><button class="btn btn-sm btn-outline-danger btn-del" data-idx="${idx}">Usuń</button></div>`;
  div.querySelector('.btn-del').addEventListener('click', async () => {
    currentReport.sectionG.splice(idx,1);
    await saveAndRender();
  });
  return div;
}
addNoteBtn.addEventListener('click', async () => {
  const text = prompt('Uwagi kierownika pociągu:');
  if (!text) return;
  currentReport.sectionG.push({ text });
  await saveAndRender();
});

/* ---------- Save & render helper ---------- */
async function saveAndRender() {
  currentReport.lastEditedAt = new Date().toISOString();
  // update section A from inputs
  currentReport.sectionA = {
    category: catEl.value,
    traction: tractionEl.value,
    trainNumber: trainNumberEl.value,
    route: routeEl.value
  };
  await saveReport(currentReport);
  renderReport();
}

/* attach change handlers for section A */
function attachSectionHandlers() {
  [catEl, tractionEl, trainNumberEl, routeEl].forEach(el => {
    el.addEventListener('change', saveAndRender);
    el.addEventListener('input', saveAndRender);
  });
}

/* ---------- Export / Import JSON ---------- */
exportJsonBtn.addEventListener('click', () => {
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
    // nadpisz aktualny raport
    currentReport = rep;
    await saveReport(currentReport);
    renderReport();
    alert('Raport zaimportowany i zapisany lokalnie.');
  } catch (err) {
    alert('Błąd importu: ' + err.message);
  }
});

/* ---------- PDF ---------- */
previewPdfBtn.addEventListener('click', async () => {
  // przygotuj widok do PDF: sklonuj panel raportu i dodaj stopkę
  const el = document.querySelector('#reportPanel .card').cloneNode(true);
  // dodaj stopkę
  const footer = document.createElement('div');
  footer.style.marginTop = '12px';
  footer.style.fontSize = '0.9rem';
  footer.textContent = `Wygenerowano dnia ${nowDateString()} z systemu ERJ`;
  el.appendChild(footer);
  // filename
  const filename = `${currentReport.number.replace(/\//g,'-')}.pdf`;
  await exportPdf(el, filename);
});

/* ---------- Zamknij raport (powrót) ---------- */
closeReportBtn.addEventListener('click', () => {
  if (!confirm('Zamknąć widok raportu i wrócić do panelu startowego?')) return;
  currentReport = null;
  currentUser = null;
  reportPanel.style.display = 'none';
  startPanel.style.display = 'block';
});

/* ---------- Inicjalizacja ---------- */
(async function init() {
  // nic specjalnego na start
})();
