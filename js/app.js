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
const sampleStations = ['Kraków Główny','Warszawa Centralna','Gdańsk Główny','Poznań Główny','Wrocław Główny','Katowice','Łódź Fabryczna','Sopot','Gdynia Główna','Warszawa Wschodnia'];
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
const trainDateEl = document.getElementById('trainDate');

const stationsList = document.getElementById('stationsList');
const formStation = document.getElementById('formStation');

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
  if (!rep) return alert('Nie znaleziono raportu.');
  rep.currentDriver = currentUser;
  currentReport = rep;
  await saveReport(currentReport);
  openReportUI();
});

/* ---------- Import ---------- */
importBtnStart.addEventListener('click', () => importFileStart.click());
importFileStart.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  try {
    const rep = JSON.parse(text);
    if (!rep.number) throw new Error('Nieprawidłowy plik');
    await saveReport(rep);
    alert('Raport zaimportowany. Możesz go przejąć.');
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
  catEl.value = currentReport.sectionA.category || '';
  tractionEl.value = currentReport.sectionA.traction || '';
  trainNumberEl.value = currentReport.sectionA.trainNumber || '';
  routeEl.value = currentReport.sectionA.route || '';
  trainDateEl.value = currentReport.sectionA.date || '';
  renderList(stationsList, currentReport.sectionE, renderStationRow);
}
function renderList(container, arr, rowRenderer) {
  container.innerHTML = '';
  arr.forEach((item, idx) => container.appendChild(rowRenderer(item, idx)));
}

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
        <div class="small text-muted">Data odj.: ${item.dateDep || '-'} · Plan: ${item.planDep || '-'} · Real: ${item.realDep
