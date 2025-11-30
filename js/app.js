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
function timeToMinutes(t) {
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length !== 2) return null;
  const [h,m] = parts.map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h*60 + m;
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

const tractionList = document.getElementById('tractionList');
const conductorList = document.getElementById('conductorList');
const ordersList = document.getElementById('ordersList');
const stationsList = document.getElementById('stationsList');
const controlsList = document.getElementById('controlsList');
const notesList = document.getElementById('notesList');

/* Modal forms */
const formTraction = document.getElementById('formTraction');
const formConductor = document.getElementById('formConductor');
const formOrder = document.getElementById('formOrder');
const formStation = document.getElementById('formStation');
const formControl = document.getElementById('formControl');
const formNote = document.getElementById('formNote');

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
      <strong>${item.name}</strong> (${item.id}) - ZDP: ${item.zdp} - Lok: ${item.loco || '-'} [${item.from || '-'} → ${item.to || '-'}]
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

/* Formularz Traction */
formTraction.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('t_name').value.trim();
  const id = document.getElementById('t_id').value.trim();
  const zdp = document.getElementById('t_zdp').value;
  const loco = document.getElementById('t_loco').value.trim();
  const from = document.getElementById('t_from').value.trim();
  const to = document.getElementById('t_to').value.trim();
  if (!name || !id) return alert('Imię i numer są wymagane.');
  currentReport.sectionB.push({ name, id, zdp, loco, from, to });
  // reset form
  formTraction.reset();
  // close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalTraction'));
  modal.hide();
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

/* Formularz Conductor */
formConductor.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('c_name').value.trim();
  const id = document.getElementById('c_id').value.trim();
  const zdp = document.getElementById('c_zdp').value;
  const role = document.getElementById('c_role').value;
  if (!name || !id) return alert('Imię i numer są wymagane.');
  currentReport.sectionC.push({ name, id, zdp, role });
  formConductor.reset();
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalConductor'));
  modal.hide();
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

/* Formularz Order */
formOrder.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('o_text').value.trim();
  const source = document.getElementById('o_source').value;
  if (!text) return alert('Treść dyspozycji jest wymagana.');
  currentReport.sectionD.push({ text, source });
  formOrder.reset();
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalOrder'));
  modal.hide();
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

/* Formularz Station */
formStation.addEventListener('submit', async (e) => {
  e.preventDefault();
  const station = document.getElementById('s_station').value.trim();
  const planArr = document.getElementById('s_planArr').value.trim();
  const planDep = document.getElementById('s_planDep').value.trim();
  const realArr = document.getElementById('s_realArr').value.trim();
  const realDep = document.getElementById('s_realDep').value.trim();
  const delayReason = document.getElementById('s_delayReason').value.trim();
  const writtenOrders = document.getElementById('s_writtenOrders').value.trim();
  if (!station) return alert('Nazwa stacji jest wymagana.');
  const planArrMin = timeToMinutes(planArr);
  const realArrMin = timeToMinutes(realArr);
  let delayMinutes = null;
  if (planArrMin != null && realArrMin != null) delayMinutes = realArrMin - planArrMin;
  const realDepMin = timeToMinutes(realDep);
  let realStopMinutes = null;
  if (realArrMin != null && realDepMin != null) realStopMinutes = realDepMin - realArrMin;
  currentReport.sectionE.push({
    station, planArr, planDep, realArr, realDep,
    delayMinutes, realStopMinutes, delayReason, writtenOrders
  });
  formStation.reset();
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalStation'));
  modal.hide();
  await saveAndRender();
});

/* ---------- Sekcja F (kontrole) ---------- */
function renderControlRow(item, idx) {
  const div = document.createElement('div');
  div.className = 'station-row d-flex justify-content-between align-items-center';
  div.innerHTML = `
    <div>
      <strong>${item.by}</strong> (${item.id || '-'})<div class="small text-muted">${item.desc || '-'}</div><div class="small text-muted">Uwagi: ${item.notes || '-'}</div>
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

/* Formularz Control */
formControl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const by = document.getElementById('f_by').value.trim();
  const id = document.getElementById('f_id').value.trim();
  const desc = document.getElementById('f_desc').value.trim();
  const notes = document.getElementById('f_notes').value.trim();
  if (!by) return alert('Imię i nazwisko kontrolującego jest wymagane.');
  currentReport.sectionF.push({ by, id, desc, notes });
  formControl.reset();
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalControl'));
  modal.hide();
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

/* Formularz Note */
formNote.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('n_text').value.trim();
  if (!text) return alert('Treść uwagi jest wymagana.');
  currentReport.sectionG.push({ text });
  formNote.reset();
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalNote'));
  modal.hide();
  await saveAndRender();
});

/* ---------- Save & render helper ---------- */
async function saveAndRender() {
  currentReport.lastEditedAt = new Date().toISOString();
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
    currentReport = rep;
    await saveReport(currentReport);
    renderReport();
    alert('Raport zaimportowany i zapisany lokalnie.');
  } catch (err) {
    alert('Błąd importu: ' + err.message);
  }
});

/* ---------- PDF (czysty widok do druku) ---------- */
previewPdfBtn.addEventListener('click', async () => {
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
  container.appendChild(makeCrewTable('C - Drużyna konduktorska', currentReport.sectionC, ['name','id','zdp','role']));

  const secD = document.createElement('div');
  secD.className = 'section';
  secD.innerHTML = `<h6>D - Dyspozycje</h6>`;
  if (currentReport.sectionD.length === 0) {
    secD.innerHTML += `<div>-</div>`;
  } else {
    const ul = document.createElement('ol');
    currentReport.sectionD.forEach(o => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${o.source}</strong>: ${o.text}`;
      ul.appendChild(li);
    });
    secD.appendChild(ul);
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
        <th>Plan przyjazd</th>
        <th>Plan odjazd</th>
        <th>Real przyjazd</th>
        <th>Real odjazd</th>
        <th>Opóźnienie (min)</th>
        <th>Postój realny (min)</th>
        <th>Powód / Rozkazy</th>
      </tr>
    </thead>
    <tbody>
      ${currentReport.sectionE.length === 0 ? `<tr><td colspan="8">-</td></tr>` : currentReport.sectionE.map(s => `
        <tr>
          <td>${s.station || '-'}</td>
          <td>${s.planArr || '-'}</td>
          <td>${s.planDep || '-'}</td>
          <td>${s.realArr || '-'}</td>
          <td>${s.realDep || '-'}</td>
          <td>${s.delayMinutes != null ? s.delayMinutes : '-'}</td>
          <td>${s.realStopMinutes != null ? s.realStopMinutes : '-'}</td>
          <td>${(s.delayReason || '-') + (s.writtenOrders ? ' / ' + s.writtenOrders : '')}</td>
        </tr>`).join('')}
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
      currentReport.sectionF.map(c => `<tr><td>${c.by}</td><td>${c.id}</td><td>${c.desc || '-'}</td><td>${c.notes || '-'}</td></tr>`).join('')
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
  // gotowe do użycia
})();
