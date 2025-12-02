// js/app.js
import { saveReport, getReport, nextCounter } from './db.js';
import { exportPdf } from './pdf.js';

/* ---------- Helpery ---------- */
window.addEventListener('error', (ev) => { console.error('Global error:', ev.error || ev.message, ev); });
function qs(id) { return document.getElementById(id); }
function on(el, ev, fn) { if (!el) return; el.addEventListener(ev, fn); }
function safeText(v) { return (v === undefined || v === null || v === '') ? '-' : v; }
function formatDateForNumber(d) { const DD=String(d.getDate()).padStart(2,'0'); const MM=String(d.getMonth()+1).padStart(2,'0'); const YY=String(d.getFullYear()).slice(-2); return {DD,MM,YY}; }
function nowDateString() { const d=new Date(); const DD=String(d.getDate()).padStart(2,'0'); const MM=String(d.getMonth()+1).padStart(2,'0'); const YYYY=d.getFullYear(); return `${DD}/${MM}/${YYYY}`; }
function isValidTime(t){ if(!t) return true; return /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
function parseDateTime(dateStr, timeStr, fallbackDate){ if(!timeStr) return null; const useDate=dateStr||fallbackDate; if(!useDate) return null; const [yyyy,mm,dd]=useDate.split('-').map(Number); const [hh,mi]=timeStr.split(':').map(Number); return new Date(yyyy,mm-1,dd,hh,mi).getTime(); }
function formatDelayClass(v){ if(v==null) return 'delay-zero'; if(v>0) return 'delay-pos'; if(v<0) return 'delay-neg'; return 'delay-zero'; }
function formatDelayText(v){ if(v==null) return '-'; return `${v} min`; }

/* Odblokowanie UI (usuwa pozostałe backdropy itp.) */
function clearUiLocks() {
  try {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
  } catch (e) {
    console.warn('clearUiLocks warn:', e);
  }
}

/* Bezpieczne zamykanie modala + odblokowanie UI */
function closeModalSafe(modalId){
  try{
    const el=qs(modalId);
    if(el){
      const inst=bootstrap.Modal.getInstance(el);
      if(inst){ try{inst.hide();}catch(e){} } else { try{ new bootstrap.Modal(el).hide(); }catch(e){} }
      el.setAttribute('aria-hidden','true');
    }
  } finally {
    clearUiLocks();
  }
}

/* ---------- Stations ---------- */
const sampleStations=['Kraków Główny','Warszawa Centralna','Gdańsk Główny','Poznań Główny','Wrocław Główny','Katowice','Łódź Fabryczna','Sopot','Gdynia Główna','Warszawa Wschodnia'];
function populateStationsDatalist(list){ const dl=qs('stationsDatalist'); if(!dl) return; dl.innerHTML=''; list.forEach(s=>{ const opt=document.createElement('option'); opt.value=s; dl.appendChild(opt); }); }

/* ---------- Model ---------- */
function createEmptyReport(number,user){ return { number, createdAt:new Date().toISOString(), lastEditedAt:new Date().toISOString(), createdBy:user, currentDriver:user, sectionA:{category:'',traction:'',trainNumber:'',route:'',date:''}, sectionB:[], sectionC:[], sectionD:[], sectionE:[], sectionF:[], sectionG:[], history:[] }; }

/* ---------- Main ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // UI refs
  const startPanel=qs('startPanel'), reportPanel=qs('reportPanel');
  const newReportBtn=qs('newReportBtn'), takeReportBtn=qs('takeReportBtn'), importBtnStart=qs('importBtnStart'), importFileStart=qs('importFileStart');

  const reportNumberEl=qs('reportNumber'); const currentUserEl=qs('currentUser');

  const exportJsonBtn=qs('exportJson'), importBtn=qs('importBtn'), importFile=qs('importFile'), previewPdfBtn=qs('previewPdf'), closeReportBtn=qs('closeReport');
  const catEl=qs('cat'), tractionEl=qs('traction'), trainNumberEl=qs('trainNumber'), routeEl=qs('route'), trainDateEl=qs('trainDate');
  const tractionList=qs('tractionList'), conductorList=qs('conductorList'), ordersList=qs('ordersList'), stationsList=qs('stationsList'), controlsList=qs('controlsList'), notesList=qs('notesList');
  const formTraction=qs('formTraction'), formConductor=qs('formConductor'), formOrder=qs('formOrder'), formStation=qs('formStation'), formControl=qs('formControl'), formNote=qs('formNote');
  const addTractionBtn=qs('addTractionBtn'), addConductorBtn=qs('addConductorBtn'), addOrderBtn=qs('addOrderBtn'), addStationBtn=qs('addStationBtn'), addControlBtn=qs('addControlBtn'), addNoteBtn=qs('addNoteBtn');

  let currentReport=null, currentUser=null; let stationsSet=new Set(sampleStations);
  populateStationsDatalist(Array.from(stationsSet));

  // Actions
  window.createNewReport=async ({name,id}) => {
    currentUser={name,id}; const c=await nextCounter(); const d=new Date(); const {DD,MM,YY}=formatDateForNumber(d); const XXX=String(c).padStart(3,'0'); const number=`${XXX}/${DD}/${MM}/${YY}`;
    currentReport=createEmptyReport(number,currentUser); await saveReport(currentReport); openReportUI();
  };
  window.takeReportByNumber=async ({name,id}) => {
    currentUser={name,id}; const num=prompt('Podaj numer raportu w formacie XXX/DD/MM/YY'); if(!num) return;
    const rep=await getReport(num.trim()); if(!rep) return alert('Nie znaleziono raportu.');
    rep.history=rep.history||[]; rep.history.push({action:'przejecie',by:currentUser,at:new Date().toISOString()}); rep.currentDriver=currentUser; rep.lastEditedAt=new Date().toISOString(); currentReport=rep;
    (rep.sectionE||[]).forEach(s=>{ if(s.station) stationsSet.add(s.station); }); populateStationsDatalist(Array.from(stationsSet)); await saveReport(currentReport); openReportUI();
  };
  window.importReportFromJson=async (text)=>{ try{ const rep=JSON.parse(text); if(!rep.number) throw new Error('Nieprawidłowy plik'); await saveReport(rep); alert('Raport zaimportowany. Przejmij go przez numer.'); }catch(err){ alert('Błąd importu: '+err.message); } };

  // Start panel
  on(newReportBtn,'click',async()=>{ const name=qs('userName')?.value?.trim(); const id=qs('userId')?.value?.trim(); if(!name||!id) return alert('Podaj imię i nazwisko oraz numer służbowy.'); await window.createNewReport({name,id}); });
  on(takeReportBtn,'click',async()=>{ const name=qs('userName')?.value?.trim(); const id=qs('userId')?.value?.trim(); if(!name||!id) return alert('Podaj imię i nazwisko oraz numer służbowy.'); await window.takeReportByNumber({name,id}); });
  on(importBtnStart,'click',()=> importFileStart && importFileStart.click());
  on(importFileStart,'change',async(e)=>{ const f=e.target.files?.[0]; if(!f) return; const text=await f.text(); await window.importReportFromJson(text); });

  // Open/close
  function openReportUI(){ startPanel.style.display='none'; reportPanel.style.display='block'; renderReport(); attachSectionHandlers(); attachReportPanelDelegation(); }
  on(closeReportBtn,'click',()=>{ if(!confirm('Zamknąć widok raportu?')) return; currentReport=null; currentUser=null; reportPanel.style.display='none'; startPanel.style.display='block'; });

  // Render (zabezpieczenie przed null)
  function renderReport(){
    if(!currentReport) return;
    if (reportNumberEl) reportNumberEl.textContent = currentReport.number;
    if (currentUserEl) currentUserEl.textContent = `${currentReport.currentDriver.name} (${currentReport.currentDriver.id})`;

    catEl && (catEl.value=currentReport.sectionA.category||'');
    tractionEl && (tractionEl.value=currentReport.sectionA.traction||'');
    trainNumberEl && (trainNumberEl.value=currentReport.sectionA.trainNumber||'');
    routeEl && (routeEl.value=currentReport.sectionA.route||'');
    trainDateEl && (trainDateEl.value=currentReport.sectionA.date||'');

    renderList(tractionList,currentReport.sectionB,renderTractionRow);
    renderList(conductorList,currentReport.sectionC,renderConductorRow);
    renderList(ordersList,currentReport.sectionD,renderOrderRow);
    renderList(stationsList,currentReport.sectionE,renderStationRow);
    renderList(controlsList,currentReport.sectionF,renderControlRow);
    renderList(notesList,currentReport.sectionG,renderNoteRow);
  }
  function renderList(container,arr,renderer){ if(!container) return; container.innerHTML=''; arr.forEach((it,idx)=> container.appendChild(renderer(it,idx))); }

  // Add buttons (bezpośrednie handlery + czyszczenie blokad)
  on(addTractionBtn,'click',()=>{ if(!formTraction) return; clearUiLocks(); formTraction.setAttribute('data-mode','add'); formTraction.setAttribute('data-index',''); formTraction.reset(); new bootstrap.Modal(qs('modalTraction')).show(); });
  on(addConductorBtn,'click',()=>{ if(!formConductor) return; clearUiLocks(); formConductor.setAttribute('data-mode','add'); formConductor.setAttribute('data-index',''); formConductor.reset(); new bootstrap.Modal(qs('modalConductor')).show(); });
  on(addOrderBtn,'click',()=>{ if(!formOrder) return; clearUiLocks(); formOrder.setAttribute('data-mode','add'); formOrder.setAttribute('data-index',''); formOrder.reset(); new bootstrap.Modal(qs('modalOrder')).show(); });
  on(addStationBtn,'click',()=>{ if(!formStation) return; clearUiLocks(); const fallback=trainDateEl?.value||currentReport?.sectionA?.date||''; formStation.setAttribute('data-mode','add'); formStation.setAttribute('data-index',''); formStation.reset(); qs('s_dateArr').value=fallback; qs('s_dateDep').value=fallback; qs('s_dateArrReal').value=fallback; qs('s_dateDepReal').value=fallback; new bootstrap.Modal(qs('modalStation')).show(); });
  on(addControlBtn,'click',()=>{ if(!formControl) return; clearUiLocks(); formControl.setAttribute('data-mode','add'); formControl.setAttribute('data-index',''); formControl.reset(); new bootstrap.Modal(qs('modalControl')).show(); });
  on(addNoteBtn,'click',()=>{ if(!formNote) return; clearUiLocks(); formNote.setAttribute('data-mode','add'); formNote.setAttribute('data-index',''); formNote.reset(); new bootstrap.Modal(qs('modalNote')).show(); });

  /* Delegacja kliknięć w panelu raportu (odporna na blokady/backdrop) */
  function attachReportPanelDelegation() {
    const panel = document.getElementById('reportPanel');
    if (!panel || panel._delegationAttached) return;
    panel.addEventListener('click', (e) => {
      const t = e.target;
      clearUiLocks(); // zawsze odblokuj UI przy kliknięciu w panel

      if (t.closest('#addTractionBtn')) {
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('modalTraction')).show();
      } else if (t.closest('#addConductorBtn')) {
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('modalConductor')).show();
      } else if (t.closest('#addOrderBtn')) {
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('modalOrder')).show();
      } else if (t.closest('#addStationBtn')) {
        e.preventDefault();
        const fallback = document.getElementById('trainDate')?.value || (currentReport?.sectionA?.date || '');
        ['s_dateArr','s_dateDep','s_dateArrReal','s_dateDepReal'].forEach(id => { const el = document.getElementById(id); if (el && !el.value) el.value = fallback; });
        new bootstrap.Modal(document.getElementById('modalStation')).show();
      } else if (t.closest('#addControlBtn')) {
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('modalControl')).show();
      } else if (t.closest('#addNoteBtn')) {
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('modalNote')).show();
      } else if (t.closest('#exportJson')) {
        e.preventDefault();
        if (!currentReport) return alert('Brak otwartego raportu.');
        const dataStr = JSON.stringify(currentReport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentReport.number.replace(/\//g,'-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (t.closest('#importBtn')) {
        e.preventDefault();
        document.getElementById('importFile')?.click();
      } else if (t.closest('#previewPdf')) {
        e.preventDefault();
        doPreviewPdf();
      } else if (t.closest('#closeReport')) {
        e.preventDefault();
        const ok = confirm('Zamknąć widok raportu?');
        if (!ok) return;
        currentReport = null;
        currentUser = null;
        document.getElementById('reportPanel').style.display = 'none';
        document.getElementById('startPanel').style.display = 'block';
      }
    });
    panel._delegationAttached = true;
  }

  /* ---------- Sekcja B ---------- */
  function renderTractionRow(item,idx){
    const div=document.createElement('div'); div.className='d-flex justify-content-between align-items-center station-row';
    div.innerHTML=`<div><strong>${safeText(item.name)}</strong> (${safeText(item.id)}) · ZDP: ${safeText(item.zdp)} · Lok: ${safeText(item.loco)} [${safeText(item.from)} → ${safeText(item.to)}]</div>
    <div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="traction">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="traction">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionB.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('traction',idx));
    return div;
  }
  on(formTraction,'submit',async(e)=>{ e.preventDefault(); try{
    const name=qs('t_name').value.trim(), id=qs('t_id').value.trim(), zdp=qs('t_zdp').value, loco=qs('t_loco').value.trim(), from=qs('t_from').value.trim(), to=qs('t_to').value.trim();
    if(!name||!id) return alert('Imię i numer są wymagane.');
    const entry={name,id,zdp,loco,from,to}; const mode=formTraction.getAttribute('data-mode');
    if(mode==='edit'){ const ix=Number(formTraction.getAttribute('data-index')); currentReport.sectionB[ix]=entry; } else { currentReport.sectionB.push(entry); }
    if(from) stationsSet.add(from); if(to) stationsSet.add(to); populateStationsDatalist(Array.from(stationsSet));
    await saveAndRender(); formTraction.reset(); closeModalSafe('modalTraction');
  }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); closeModalSafe('modalTraction'); } });

  /* ---------- Sekcja C ---------- */
  function renderConductorRow(item,idx){
    const div=document.createElement('div'); div.className='d-flex justify-content-between align-items-center station-row';
    div.innerHTML=`<div><strong>${safeText(item.name)}</strong> (${safeText(item.id)}) · ZDP: ${safeText(item.zdp)} · Funkcja: ${safeText(item.role)} [${safeText(item.from)} → ${safeText(item.to)}]</div>
    <div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="conductor">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="conductor">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionC.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('conductor',idx));
    return div;
  }
  on(formConductor,'submit',async(e)=>{ e.preventDefault(); try{
    const name=qs('c_name').value.trim(), id=qs('c_id').value.trim(), zdp=qs('c_zdp').value, role=qs('c_role').value, from=qs('c_from').value.trim(), to=qs('c_to').value.trim();
    if(!name||!id) return alert('Imię i numer są wymagane.');
    const entry={name,id,zdp,role,from,to}; const mode=formConductor.getAttribute('data-mode');
    if(mode==='edit'){ const ix=Number(formConductor.getAttribute('data-index')); currentReport.sectionC[ix]=entry; } else { currentReport.sectionC.push(entry); }
    if(from) stationsSet.add(from); if(to) stationsSet.add(to); populateStationsDatalist(Array.from(stationsSet));
    await saveAndRender(); formConductor.reset(); closeModalSafe('modalConductor');
  }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); closeModalSafe('modalConductor'); } });

  /* ---------- Sekcja D ---------- */
  function renderOrderRow(item,idx){
    const meta=`${item.number ? 'Nr: '+item.number+' · ' : ''}${item.time ? 'Godz.: '+item.time : ''}`;
    const div=document.createElement('div'); div.className='d-flex justify-content-between align-items-center station-row';
    div.innerHTML=`<div>${safeText(item.text)} <div class="small text-muted">${meta} · Źródło: ${safeText(item.source)}</div></div>
    <div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="order">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="order">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionD.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('order',idx));
    return div;
  }
  on(formOrder,'submit',async(e)=>{ e.preventDefault(); try{
    const number=qs('o_number').value.trim(), time=qs('o_time').value.trim(), text=qs('o_text').value.trim(), source=qs('o_source').value;
    if(!text) return alert('Treść dyspozycji jest wymagana.'); if(!isValidTime(time)) return alert('Godzina musi być HH:MM.');
    const entry={number,time,text,source}; const mode=formOrder.getAttribute('data-mode');
    if(mode==='edit'){ const ix=Number(formOrder.getAttribute('data-index')); currentReport.sectionD[ix]=entry; } else { currentReport.sectionD.push(entry); }
    await saveAndRender(); formOrder.reset(); closeModalSafe('modalOrder');
  }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); closeModalSafe('modalOrder'); } });

  /* ---------- Sekcja E ---------- */
  function renderStationRow(item,idx){
    const arrClass=formatDelayClass(item.delayArrMinutes), depClass=formatDelayClass(item.delayDepMinutes);
    const arrText=formatDelayText(item.delayArrMinutes), depText=formatDelayText(item.delayDepMinutes);
    const stopText=item.realStopMinutes!=null ? `${item.realStopMinutes} min` : '-';
    const div=document.createElement('div'); div.className='station-row';
    div.innerHTML=`
      <div class="d-flex justify-content-between">
        <div>
          <strong>${safeText(item.station)}</strong>
          <div class="small text-muted">Przyjazd (plan): ${safeText(item.dateArr)} · ${safeText(item.planArr)}</div>
          <div class="small text-muted">Przyjazd (real): ${safeText(item.dateArrReal)} · ${safeText(item.realArr)}</div>
          <div class="small">Odchylenie przyj.: <span class="${arrClass}">${arrText}</span></div>
          <div class="small text-muted">Odjazd (plan): ${safeText(item.dateDep)} · ${safeText(item.planDep)}</div>
          <div class="small text-muted">Odjazd (real): ${safeText(item.dateDepReal)} · ${safeText(item.realDep)}</div>
          <div class="small">Odchylenie odj.: <span class="${depClass}">${depText}</span></div>
          <div class="small">Postój realny: ${stopText}</div>
          <div class="small text-muted">Powód: ${safeText(item.delayReason)}; Rozkazy: ${safeText(item.writtenOrders)}</div>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="station">Edytuj</button>
          <button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="station">Usuń</button>
        </div>
      </div>`;
    div.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionE.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('station',idx));
    return div;
  }

  on(formStation,'submit',async(e)=>{ e.preventDefault(); try{
    const station=qs('s_station').value.trim();
    const dateArrPlan=qs('s_dateArr').value, dateArrReal=qs('s_dateArrReal').value;
    const dateDepPlan=qs('s_dateDep').value, dateDepReal=qs('s_dateDepReal').value;
    const planArr=qs('s_planArr').value.trim(), planDep=qs('s_planDep').value.trim();
    const realArr=qs('s_realArr').value.trim(), realDep=qs('s_realDep').value.trim();
    const delayReason=qs('s_delayReason').value.trim(), writtenOrders=qs('s_writtenOrders').value.trim();
    if(!station) return alert('Nazwa stacji jest wymagana.');
    if(!isValidTime(planArr)||!isValidTime(planDep)||!isValidTime(realArr)||!isValidTime(realDep)) return alert('Czas HH:MM lub puste.');

    const fallback=trainDateEl?.value||currentReport.sectionA.date||'';
    const planArrDT=parseDateTime(dateArrPlan,planArr,fallback);
    const realArrDT=parseDateTime(dateArrReal,realArr,fallback);
    const planDepDT=parseDateTime(dateDepPlan,planDep,fallback);
    const realDepDT=parseDateTime(dateDepReal,realDep,fallback);

    let delayArrMinutes=null; if(planArrDT&&realArrDT) delayArrMinutes=Math.round((realArrDT-planArrDT)/60000);
    let delayDepMinutes=null; if(planDepDT&&realDepDT) delayDepMinutes=Math.round((realDepDT-planDepDT)/60000);
    let realStopMinutes=null; if(realArrDT&&realDepDT) realStopMinutes=Math.round((realDepDT-realArrDT)/60000);

    if(!stationsSet.has(station)){ stationsSet.add(station); populateStationsDatalist(Array.from(stationsSet)); }

    const entry={ station,
      dateArr:dateArrPlan, planArr, dateArrReal, realArr,
      dateDep:dateDepPlan, planDep, dateDepReal, realDep,
      delayArrMinutes, delayDepMinutes, realStopMinutes,
      delayReason, writtenOrders
    };
    const mode=formStation.getAttribute('data-mode');
    if(mode==='edit'){ const ix=Number(formStation.getAttribute('data-index')); currentReport.sectionE[ix]=entry; } else { currentReport.sectionE.push(entry); }
    await saveAndRender(); formStation.reset(); closeModalSafe('modalStation');
  }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); closeModalSafe('modalStation'); } });

  /* ---------- Sekcja F ---------- */
  function renderControlRow(item,idx){
    const div=document.createElement('div'); div.className='station-row d-flex justify-content-between align-items-center';
    div.innerHTML=`<div><strong>${safeText(item.by)}</strong> (${safeText(item.id)})<div class="small text-muted">${safeText(item.desc)}</div><div class="small text-muted">Uwagi: ${safeText(item.notes)}</div></div>
    <div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="control">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="control">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionF.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('control',idx));
    return div;
  }
  on(formControl,'submit',async(e)=>{ e.preventDefault(); try{
    const by=qs('f_by').value.trim(), id=qs('f_id').value.trim(), desc=qs('f_desc').value.trim(), notes=qs('f_notes').value.trim();
    if(!by) return alert('Imię i nazwisko kontrolującego jest wymagane.');
    const entry={by,id,desc,notes}; const mode=formControl.getAttribute('data-mode');
    if(mode==='edit'){ const ix=Number(formControl.getAttribute('data-index')); currentReport.sectionF[ix]=entry; } else { currentReport.sectionF.push(entry); }
    await saveAndRender(); formControl.reset(); closeModalSafe('modalControl');
  }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); closeModalSafe('modalControl'); } });

  /* ---------- Sekcja G ---------- */
  function renderNoteRow(item,idx){
    const div=document.createElement('div'); div.className='station-row d-flex justify-content-between align-items-center';
    div.innerHTML=`<div>${safeText(item.text)}</div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="note">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="note">Usuń</button></div>`;
    div.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionG.splice(idx,1); await saveAndRender(); });
    div.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('note',idx));
    return div;
  }
  on(formNote,'submit',async(e)=>{ e.preventDefault(); try{
    const text=qs('n_text').value.trim(); if(!text) return alert('Treść uwagi jest wymagana.');
    const entry={text}; const mode=formNote.getAttribute('data-mode');
    if(mode==='edit'){ const ix=Number(formNote.getAttribute('data-index')); currentReport.sectionG[ix]=entry; } else { currentReport.sectionG.push(entry); }
    await saveAndRender(); formNote.reset(); closeModalSafe('modalNote');
  }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); closeModalSafe('modalNote'); } });

  // Edit modal helper
  function openEditModal(type,idx){
    if(!currentReport) return;
    if(type==='traction'){ const it=currentReport.sectionB[idx];
      qs('t_name').value=it.name||''; qs('t_id').value=it.id||''; qs('t_zdp').value=it.zdp||'WAW'; qs('t_loco').value=it.loco||''; qs('t_from').value=it.from||''; qs('t_to').value=it.to||'';
      formTraction.setAttribute('data-mode','edit'); formTraction.setAttribute('data-index',idx); clearUiLocks(); new bootstrap.Modal(qs('modalTraction')).show();
    } else if(type==='conductor'){ const it=currentReport.sectionC[idx];
      qs('c_name').value=it.name||''; qs('c_id').value=it.id||''; qs('c_zdp').value=it.zdp||'WAW'; qs('c_role').value=it.role||'KP'; qs('c_from').value=it.from||''; qs('c_to').value=it.to||'';
      formConductor.setAttribute('data-mode','edit'); formConductor.setAttribute('data-index',idx); clearUiLocks(); new bootstrap.Modal(qs('modalConductor')).show();
    } else if(type==='order'){ const it=currentReport.sectionD[idx];
      qs('o_number').value=it.number||''; qs('o_time').value=it.time||''; qs('o_text').value=it.text||''; qs('o_source').value=it.source||'Dyspozytura';
      formOrder.setAttribute('data-mode','edit'); formOrder.setAttribute('data-index',idx); clearUiLocks(); new bootstrap.Modal(qs('modalOrder')).show();
    } else if(type==='station'){ const it=currentReport.sectionE[idx];
      qs('s_station').value=it.station||'';
      qs('s_dateArr').value=it.dateArr||''; qs('s_planArr').value=it.planArr||'';
      qs('s_dateArrReal').value=it.dateArrReal||''; qs('s_realArr').value=it.realArr||'';
      qs('s_dateDep').value=it.dateDep||''; qs('s_planDep').value=it.planDep||'';
      qs('s_dateDepReal').value=it.dateDepReal||''; qs('s_realDep').value=it.realDep||'';
      qs('s_delayReason').value=it.delayReason||''; qs('s_writtenOrders').value=it.writtenOrders||'';
      formStation.setAttribute('data-mode','edit'); formStation.setAttribute('data-index',idx); clearUiLocks(); new bootstrap.Modal(qs('modalStation')).show();
    } else if(type==='control'){ const it=currentReport.sectionF[idx];
      qs('f_by').value=it.by||''; qs('f_id').value=it.id||''; qs('f_desc').value=it.desc||''; qs('f_notes').value=it.notes||'';
      formControl.setAttribute('data-mode','edit'); formControl.setAttribute('data-index',idx); clearUiLocks(); new bootstrap.Modal(qs('modalControl')).show();
    } else if(type==='note'){ const it=currentReport.sectionG[idx];
      qs('n_text').value=it.text||''; formNote.setAttribute('data-mode','edit'); formNote.setAttribute('data-index',idx); clearUiLocks(); new bootstrap.Modal(qs('modalNote')).show();
    }
  }

  // Reset modali + safety odblokowanie przewijania
  document.querySelectorAll('.modal').forEach(m=>{ m.addEventListener('hidden.bs.modal',()=>{ const form=m.querySelector('form'); if(form){ form.setAttribute('data-mode','add'); form.setAttribute('data-index',''); form.reset(); } clearUiLocks(); }); });
  document.addEventListener('shown.bs.modal',()=>{ document.body.style.overflow=''; document.body.style.position=''; document.documentElement.style.overflow=''; });
  document.addEventListener('hidden.bs.modal',()=>{ clearUiLocks(); });

  // Save & autosave
  async function saveAndRender(){ if(!currentReport) return; currentReport.lastEditedAt=new Date().toISOString();
    currentReport.sectionA={ category:catEl?.value||'', traction:tractionEl?.value||'', trainNumber:trainNumberEl?.value||'', route:routeEl?.value||'', date:trainDateEl?.value||'' };
    await saveReport(currentReport); renderReport();
  }
  function attachSectionHandlers(){ [catEl,tractionEl,trainNumberEl,routeEl,trainDateEl].forEach(el=>{ if(!el) return; el.addEventListener('change',saveAndRender); el.addEventListener('input',saveAndRender); }); }

  // Import/Export
  on(exportJsonBtn,'click',()=>{ if(!currentReport) return alert('Brak otwartego raportu.'); const dataStr=JSON.stringify(currentReport,null,2); const blob=new Blob([dataStr],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${currentReport.number.replace(/\//g,'-')}.json`; a.click(); URL.revokeObjectURL(url); });
  on(importBtn,'click',()=> importFile && importFile.click());
  on(importFile,'change',async(e)=>{ const f=e.target.files?.[0]; if(!f) return; const text=await f.text(); try{ const rep=JSON.parse(text); if(!rep.number) throw new Error('Nieprawidłowy plik'); currentReport=rep; (rep.sectionE||[]).forEach(s=>{ if(s.station) stationsSet.add(s.station); }); populateStationsDatalist(Array.from(stationsSet)); await saveReport(currentReport); renderReport(); alert('Raport zaimportowany i zapisany lokalnie.'); }catch(err){ alert('Błąd importu: '+err.message); } });

  // PDF: wspólna funkcja i handler/Delegacja
  async function doPreviewPdf() {
    if (!currentReport) return alert('Brak otwartego raportu.');
    const container=document.createElement('div'); container.className='print-container';
    const header=document.createElement('div'); header.className='print-header';
    header.innerHTML=`<div class="print-title">Raport z jazdy pociągu</div><div class="print-meta">Numer: ${currentReport.number} · Prowadzący: ${currentReport.currentDriver.name} (${currentReport.currentDriver.id})</div><div class="print-meta">Wygenerowano dnia ${nowDateString()}</div>`;
    container.appendChild(header);

    const secA=document.createElement('div'); secA.className='section';
    secA.innerHTML=`<h6>A - Dane ogólne</h6><table class="table-print"><tbody>
      <tr><th>Kategoria</th><td>${safeText(currentReport.sectionA.category)}</td></tr>
      <tr><th>Trakcja</th><td>${safeText(currentReport.sectionA.traction)}</td></tr>
      <tr><th>Numer pociągu</th><td>${safeText(currentReport.sectionA.trainNumber)}</td></tr>
      <tr><th>Relacja</th><td>${safeText(currentReport.sectionA.route)}</td></tr>
      <tr><th>Data kursu</th><td>${safeText(currentReport.sectionA.date)}</td></tr>
    </tbody></table>`;
    container.appendChild(secA);

    const makeCrewTable=(title,arr,cols)=>{ const s=document.createElement('div'); s.className='section'; s.innerHTML=`<h6>${title}</h6>`;
      const table=document.createElement('table'); table.className='table-print';
      const thead=document.createElement('thead'); thead.innerHTML=`<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`; table.appendChild(thead);
      const tbody=document.createElement('tbody'); if(arr.length===0){ tbody.innerHTML=`<tr><td colspan="${cols.length}">-</td></tr>`; } else { arr.forEach(it=>{ const cells=cols.map(k=>`<td>${safeText(it[k])}</td>`).join(''); tbody.innerHTML+=`<tr>${cells}</tr>`; }); }
      table.appendChild(tbody); s.appendChild(table); return s;
    };
    container.appendChild(makeCrewTable('B - Drużyna trakcyjna', currentReport.sectionB, ['name','id','zdp','loco','from','to']));
    container.appendChild(makeCrewTable('C - Drużyna konduktorska', currentReport.sectionC, ['name','id','zdp','role','from','to']));

    const secD=document.createElement('div'); secD.className='section'; secD.innerHTML=`<h6>D - Dyspozycje</h6>`;
    if(currentReport.sectionD.length===0){ secD.innerHTML+=`<div>-</div>`; } else {
      const table=document.createElement('table'); table.className='table-print';
      table.innerHTML=`<thead><tr><th>Nr</th><th>Godz.</th><th>Treść</th><th>Źródło</th></tr></thead><tbody>${
        currentReport.sectionD.map(o=>`<tr><td>${safeText(o.number)}</td><td>${safeText(o.time)}</td><td>${safeText(o.text)}</td><td>${safeText(o.source)}</td></tr>`).join('')
      }</tbody>`;
      secD.appendChild(table);
    }
    container.appendChild(secD);

    const secE=document.createElement('div'); secE.className='section'; secE.innerHTML=`<h6>E - Dane o jeździe pociągu</h6>`;
    const tableE=document.createElement('table'); tableE.className='table-print';
    tableE.innerHTML=`
      <thead>
        <tr>
          <th>Stacja</th>
          <th>Data przyj. (plan)</th><th>Godz. przyj. (plan)</th>
          <th>Data przyj. (real)</th><th>Godz. przyj. (real)</th>
          <th>Odchylenie przyj.</th>
          <th>Data odj. (plan)</th><th>Godz. odj. (plan)</th>
          <th>Data odj. (real)</th><th>Godz. odj. (real)</th>
          <th>Odchylenie odj.</th>
          <th>Postój (min)</th>
          <th>Powód / Rozkazy</th>
        </tr>
      </thead>
      <tbody>
        ${currentReport.sectionE.length===0 ? `<tr><td colspan="13">-</td></tr>` :
          currentReport.sectionE.map(s=>{
            const arrVal=(s.delayArrMinutes!=null)?`${s.delayArrMinutes} min`:'-';
            const depVal=(s.delayDepMinutes!=null)?`${s.delayDepMinutes} min`:'-';
            const arrStyle=s.delayArrMinutes==null?'':(s.delayArrMinutes>0?'color:red;font-weight:600;':(s.delayArrMinutes<0?'color:green;font-weight:600;':'color:black;font-weight:600;'));
            const depStyle=s.delayDepMinutes==null?'':(s.delayDepMinutes>0?'color:red;font-weight:600;':(s.delayDepMinutes<0?'color:green;font-weight:600;':'color:black;font-weight:600;'));
            const stop=s.realStopMinutes!=null?`${s.realStopMinutes}`:'-';
            const pow=(s.delayReason||'-')+(s.writtenOrders? ' / '+s.writtenOrders : '');
            return `<tr>
              <td>${safeText(s.station)}</td>
              <td>${safeText(s.dateArr)}</td><td>${safeText(s.planArr)}</td>
              <td>${safeText(s.dateArrReal)}</td><td>${safeText(s.realArr)}</td>
              <td style="${arrStyle}">${arrVal}</td>
              <td>${safeText(s.dateDep)}</td><td>${safeText(s.planDep)}</td>
              <td>${safeText(s.dateDepReal)}</td><td>${safeText(s.realDep)}</td>
              <td style="${depStyle}">${depVal}</td>
              <td>${stop}</td>
              <td>${pow}</td>
            </tr>`;
          }).join('')
        }
      </tbody>`;
    secE.appendChild(tableE); container.appendChild(secE);

    const secF=document.createElement('div'); secF.className='section'; secF.innerHTML=`<h6>F - Kontrola pociągu</h6>`;
    if(currentReport.sectionF.length===0) secF.innerHTML+=`<div>-</div>`;
    else { const t=document.createElement('table'); t.className='table-print';
      t.innerHTML=`<thead><tr><th>Kontrolujący</th><th>Numer</th><th>Opis</th><th>Uwagi</th></tr></thead><tbody>${
        currentReport.sectionF.map(c=>`<tr><td>${safeText(c.by)}</td><td>${safeText(c.id)}</td><td>${safeText(c.desc)}</td><td>${safeText(c.notes)}</td></tr>`).join('')
      }</tbody>`; secF.appendChild(t); }
    container.appendChild(secF);

    const secG=document.createElement('div'); secG.className='section'; secG.innerHTML=`<h6>G - Uwagi kierownika pociągu</h6>`;
    if(currentReport.sectionG.length===0) secG.innerHTML+=`<div>-</div>`;
    else { const ul=document.createElement('ul'); currentReport.sectionG.forEach(n=>{ const li=document.createElement('li'); li.textContent=n.text; ul.appendChild(li); }); secG.appendChild(ul); }
    container.appendChild(secG);

    const footer=document.createElement('div'); footer.className='print-footer'; footer.textContent=`Wygenerowano dnia ${nowDateString()} z systemu ERJ`; container.appendChild(footer);
    const filename=`${currentReport.number.replace(/\//g,'-')}.pdf`;
    await exportPdf(container, filename);
  }

  on(previewPdfBtn,'click', async () => { await doPreviewPdf(); });

  // Init
  startPanel.style.display='block'; reportPanel.style.display='none';
});
