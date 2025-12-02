// js/app.js
import { listUsers, getUserByEmailOrId, updateUser, deleteUser, saveReport, nextCounter, getReport, listReports } from './db.js';
import { initAuth, registerUser, login, logout, currentUser, hashPassword } from './auth.js';
import { exportPdf } from './pdf.js';

/* ---------- Helpers ---------- */
function qs(id){ return document.getElementById(id); }
function safeText(v){ return (v===undefined||v===null||v==='')?'-':v; }
function isValidTime(t){ if(!t) return true; return /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
function parseDateTime(dateStr, timeStr, fallbackDate){ if(!timeStr) return null; const useDate=dateStr||fallbackDate; if(!useDate) return null; const [yyyy,mm,dd]=useDate.split('-').map(Number); const [hh,mi]=timeStr.split(':').map(Number); return new Date(yyyy,mm-1,dd,hh,mi).getTime(); }
function formatDelayClass(v){ if(v==null) return 'delay-zero'; if(v>0) return 'delay-pos'; if(v<0) return 'delay-neg'; return 'delay-zero'; }
function formatDelayText(v){ if(v==null) return '-'; return `${v} min`; }

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  const adminPlain = await initAuth();

  // UI refs
  const loginView = qs('loginView'), appShell = qs('appShell');
  const loginForm = qs('loginForm'), loginId = qs('loginId'), loginPassword = qs('loginPassword'), loginMsg = qs('loginMsg'), demoBtn = qs('demoBtn');
  const loggedUserInfo = qs('loggedUserInfo'), btnLogout = qs('btnLogout'), openAdminBtn = qs('openAdminBtn');

  const startPanel = qs('startPanel'), newReportBtn = qs('newReportBtn'), takeReportBtn = qs('takeReportBtn');
  const userNameInput = qs('userName'), userIdInput = qs('userId');

  const reportPanel = qs('reportPanel'), reportNumberEl = qs('reportNumber'), currentUserEl = qs('currentUser'), closeReportBtn = qs('closeReport');
  const catEl = qs('cat'), tractionEl = qs('traction'), trainNumberEl = qs('trainNumber'), routeEl = qs('route'), trainDateEl = qs('trainDate');

  const tractionList = qs('tractionList'), conductorList = qs('conductorList'), ordersList = qs('ordersList'), stationsList = qs('stationsList'), controlsList = qs('controlsList'), notesList = qs('notesList');

  const exportJsonBtn = qs('exportJson'), importBtn = qs('importBtn'), importFile = qs('importFile'), previewPdfBtn = qs('previewPdf');

  const adminPanel = qs('adminPanel'), usersTableBody = document.querySelector('#usersTable tbody'), addUserBtn = qs('addUserBtn'), modalUser = qs('modalUser'), formUser = qs('formUser'), userFormMsg = qs('userFormMsg');

  // station datalist sample
  const sampleStations=['Kraków Główny','Warszawa Centralna','Gdańsk Główny','Poznań Główny','Wrocław Główny','Katowice','Łódź Fabryczna','Sopot','Gdynia Główna','Warszawa Wschodnia'];
  function populateStationsDatalist(list){ const dl=qs('stationsDatalist'); if(!dl) return; dl.innerHTML=''; list.forEach(s=>{ const opt=document.createElement('option'); opt.value=s; dl.appendChild(opt); }); }
  let stationsSet=new Set(sampleStations); populateStationsDatalist(Array.from(stationsSet));

  // session helpers
  function showLogin(){ loginView.style.display='block'; appShell.style.display='none'; adminPanel.style.display='none'; }
  async function showAppFor(user){
    loginView.style.display='none'; appShell.style.display='block';
    loggedUserInfo.textContent = `${user.name} (${user.id}) · ${user.role}`;
    if(user.role==='admin') adminPanel.style.display='block'; else adminPanel.style.display='none';
    userNameInput.value = user.name || '';
    userIdInput.value = user.id || '';
    await refreshUsersTable();
    // ensure report UI handlers are active and start panel visible
    startPanel.style.display = 'block';
    reportPanel.style.display = 'none';
  }

  const sess = currentUser();
  if(sess) await showAppFor(sess); else showLogin();

  // login
  loginForm.addEventListener('submit', async (e)=>{ e.preventDefault(); loginMsg.textContent=''; const id=loginId.value.trim(); const pw=loginPassword.value; if(!id||!pw) return loginMsg.textContent='Podaj login i hasło.'; const res=await login(id,pw); if(!res.ok) return loginMsg.textContent=res.reason||'Błąd logowania'; await showAppFor(res.user); });

  demoBtn.addEventListener('click', ()=>{ loginId.value='klawinski.pawel@gmail.com'; loginPassword.value=adminPlain; loginForm.dispatchEvent(new Event('submit',{cancelable:true})); });

  btnLogout.addEventListener('click', ()=>{ logout(); showLogin(); loginId.value=''; loginPassword.value=''; loginMsg.textContent=''; });

  // Admin users table
  async function refreshUsersTable(){
    if(!usersTableBody) return;
    usersTableBody.innerHTML='';
    const users = await listUsers();
    users.forEach(u=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${safeText(u.name)}</td><td>${safeText(u.id)}</td><td>${safeText(u.zdp)}</td><td>${safeText(u.email)}</td><td>${safeText(u.role)}</td><td>${safeText(u.status)}</td>
        <td><button class="btn btn-sm btn-outline-secondary me-1" data-action="edit" data-key="${u.email||u.id}">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-action="del" data-key="${u.email||u.id}">Usuń</button></td>`;
      usersTableBody.appendChild(tr);
    });
  }

  formUser.addEventListener('submit', async (e)=>{ e.preventDefault(); userFormMsg.textContent=''; const mode=formUser.getAttribute('data-mode')||'add'; const idx=formUser.getAttribute('data-index')||''; const name=qs('u_name').value.trim(); const id=qs('u_id').value.trim(); const zdp=qs('u_zdp').value; const email=qs('u_email').value.trim(); const password=qs('u_password').value; const role=qs('u_role').value; const status=qs('u_status').value; if(!name||!id||!email||!password) return userFormMsg.textContent='Wypełnij wszystkie wymagane pola.'; try{ if(mode==='add'){ await registerUser({name,id,zdp,email,password,role,status}); } else { const patch={name,id,zdp,email,role,status}; if(password) patch.passwordHash = await hashPassword(password); await updateUser(idx,patch); } const bs=bootstrap.Modal.getInstance(modalUser); bs&&bs.hide(); formUser.reset(); await refreshUsersTable(); }catch(err){ userFormMsg.textContent = err.message||'Błąd zapisu użytkownika'; } });

  usersTableBody.addEventListener('click', async (e)=>{ const btn=e.target.closest('button'); if(!btn) return; const action=btn.getAttribute('data-action'); const key=btn.getAttribute('data-key'); if(action==='edit'){ const u=await getUserByEmailOrId(key); if(!u) return alert('Nie znaleziono użytkownika'); formUser.setAttribute('data-mode','edit'); formUser.setAttribute('data-index',key); qs('u_name').value=u.name||''; qs('u_id').value=u.id||''; qs('u_zdp').value=u.zdp||'WAW'; qs('u_email').value=u.email||''; qs('u_password').value=''; qs('u_role').value=u.role||'user'; qs('u_status').value=u.status||'active'; document.querySelector('#modalUser .modal-title').textContent='Edytuj użytkownika'; new bootstrap.Modal(modalUser).show(); } else if(action==='del'){ if(!confirm('Usunąć użytkownika?')) return; try{ await deleteUser(key); await refreshUsersTable(); }catch(err){ alert('Błąd usuwania: '+(err.message||err)); } } });

  addUserBtn.addEventListener('click', ()=>{ formUser.setAttribute('data-mode','add'); formUser.setAttribute('data-index',''); formUser.reset(); document.querySelector('#modalUser .modal-title').textContent='Dodaj użytkownika'; userFormMsg.textContent=''; });

  // Open admin from start panel
  openAdminBtn.addEventListener('click', async ()=>{ const u=currentUser(); if(!u||u.role!=='admin') return alert('Brak uprawnień. Panel administracyjny dostępny tylko dla administratora.'); adminPanel.scrollIntoView({behavior:'smooth'}); await refreshUsersTable(); });

  // ---------- Report logic ----------
  let currentReport = null;

  function renderReportHeader(){
    if(!currentReport) return;
    reportNumberEl.textContent = currentReport.number || '-';
    currentUserEl.textContent = `${currentReport.currentDriver?.name || currentReport.createdBy?.name || '-'} (${currentReport.currentDriver?.id || currentReport.createdBy?.id || '-'})`;
  }

  function renderLists(){
    function renderList(container, arr, renderer){
      if(!container) return;
      container.innerHTML='';
      (arr||[]).forEach((it,idx)=> container.appendChild(renderer(it,idx)));
    }
    renderList(tractionList, currentReport.sectionB, (it,idx)=>{ const d=document.createElement('div'); d.className='d-flex justify-content-between align-items-center station-row'; d.innerHTML=`<div><strong>${safeText(it.name)}</strong> (${safeText(it.id)}) · ZDP: ${safeText(it.zdp)} · Lok: ${safeText(it.loco)} [${safeText(it.from)} → ${safeText(it.to)}]</div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="traction">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="traction">Usuń</button></div>`; d.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionB.splice(idx,1); await saveAndRender(); }); d.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('traction',idx)); return d; });
    renderList(conductorList, currentReport.sectionC, (it,idx)=>{ const d=document.createElement('div'); d.className='d-flex justify-content-between align-items-center station-row'; d.innerHTML=`<div><strong>${safeText(it.name)}</strong> (${safeText(it.id)}) · ZDP: ${safeText(it.zdp)} · Funkcja: ${safeText(it.role)} [${safeText(it.from)} → ${safeText(it.to)}]</div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="conductor">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="conductor">Usuń</button></div>`; d.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionC.splice(idx,1); await saveAndRender(); }); d.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('conductor',idx)); return d; });
    renderList(ordersList, currentReport.sectionD, (it,idx)=>{ const meta=`${it.number?('Nr: '+it.number+' · '):''}${it.time?('Godz.: '+it.time):''}`; const d=document.createElement('div'); d.className='d-flex justify-content-between align-items-center station-row'; d.innerHTML=`<div>${safeText(it.text)} <div class="small text-muted">${meta} · Źródło: ${safeText(it.source)}</div></div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="order">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="order">Usuń</button></div>`; d.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionD.splice(idx,1); await saveAndRender(); }); d.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('order',idx)); return d; });
    renderList(stationsList, currentReport.sectionE, (it,idx)=>{ const arrClass=formatDelayClass(it.delayArrMinutes), depClass=formatDelayClass(it.delayDepMinutes); const arrText=formatDelayText(it.delayArrMinutes), depText=formatDelayText(it.delayDepMinutes); const stopText=it.realStopMinutes!=null?`${it.realStopMinutes} min`:'-'; const d=document.createElement('div'); d.className='station-row'; d.innerHTML=`<div class="d-flex justify-content-between"><div><strong>${safeText(it.station)}</strong><div class="small text-muted">Przyjazd (plan): ${safeText(it.dateArr)} · ${safeText(it.planArr)}</div><div class="small text-muted">Przyjazd (real): ${safeText(it.dateArrReal)} · ${safeText(it.realArr)}</div><div class="small">Odchylenie przyj.: <span class="${arrClass}">${arrText}</span></div><div class="small text-muted">Odjazd (plan): ${safeText(it.dateDep)} · ${safeText(it.planDep)}</div><div class="small text-muted">Odjazd (real): ${safeText(it.dateDepReal)} · ${safeText(it.realDep)}</div><div class="small">Odchylenie odj.: <span class="${depClass}">${depText}</span></div><div class="small">Postój realny: ${stopText}</div><div class="small text-muted">Powód: ${safeText(it.delayReason)}; Rozkazy: ${safeText(it.writtenOrders)}</div></div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="station">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="station">Usuń</button></div></div>`; d.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionE.splice(idx,1); await saveAndRender(); }); d.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('station',idx)); return d; });
    renderList(controlsList, currentReport.sectionF, (it,idx)=>{ const d=document.createElement('div'); d.className='station-row d-flex justify-content-between align-items-center'; d.innerHTML=`<div><strong>${safeText(it.by)}</strong> (${safeText(it.id)})<div class="small text-muted">${safeText(it.desc)}</div><div class="small text-muted">Uwagi: ${safeText(it.notes)}</div></div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="control">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="control">Usuń</button></div>`; d.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionF.splice(idx,1); await saveAndRender(); }); d.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('control',idx)); return d; });
    renderList(notesList, currentReport.sectionG, (it,idx)=>{ const d=document.createElement('div'); d.className='station-row d-flex justify-content-between align-items-center'; d.innerHTML=`<div>${safeText(it.text)}</div><div><button class="btn btn-sm btn-outline-secondary me-1" data-edit="${idx}" data-type="note">Edytuj</button><button class="btn btn-sm btn-outline-danger" data-del="${idx}" data-type="note">Usuń</button></div>`; d.querySelector('[data-del]').addEventListener('click',async()=>{ currentReport.sectionG.splice(idx,1); await saveAndRender(); }); d.querySelector('[data-edit]').addEventListener('click',()=> openEditModal('note',idx)); return d; });
  }

  async function saveAndRender(){
    if(!currentReport) return;
    currentReport.lastEditedAt = new Date().toISOString();
    currentReport.sectionA = { category: catEl?.value||'', traction: tractionEl?.value||'', trainNumber: trainNumberEl?.value||'', route: routeEl?.value||'', date: trainDateEl?.value||'' };
    await saveReport(currentReport);
    renderReportHeader();
    renderLists();
  }

  // open / close report
  function openReportUI(report){
    currentReport = report;
    renderReportHeader();
    renderLists();
    startPanel.style.display='none';
    adminPanel.style.display='none';
    reportPanel.style.display='block';
  }

  closeReportBtn.addEventListener('click', ()=>{ reportPanel.style.display='none'; startPanel.style.display='block'; const u=currentUser(); if(u && u.role==='admin') adminPanel.style.display='block'; currentReport=null; });

  // create / take
  async function createNewReport({name,id}){
    if(!name||!id) return alert('Podaj imię i numer służbowy.');
    const c = await nextCounter();
    const d = new Date();
    const DD = String(d.getDate()).padStart(2,'0');
    const MM = String(d.getMonth()+1).padStart(2,'0');
    const YY = String(d.getFullYear()).slice(-2);
    const XXX = String(c).padStart(3,'0');
    const number = `${XXX}/${DD}/${MM}/${YY}`;
    const report = {
      number,
      createdAt: new Date().toISOString(),
      createdBy: { name, id },
      currentDriver: { name, id },
      sectionA: { category:'', traction:'', trainNumber:'', route:'', date: d.toISOString().slice(0,10) },
      sectionB:[], sectionC:[], sectionD:[], sectionE:[], sectionF:[], sectionG:[], history:[]
    };
    await saveReport(report);
    openReportUI(report);
  }

  async function takeReportByNumber({name,id}){
    const num = prompt('Podaj numer raportu (np. 001/02/12/25):');
    if(!num) return;
    const rep = await getReport(num.trim());
    if(!rep) return alert('Nie znaleziono raportu o podanym numerze.');
    rep.takenBy = { name, id, at: new Date().toISOString() };
    rep.currentDriver = { name, id };
    await saveReport(rep);
    openReportUI(rep);
  }

  // wire start buttons
  newReportBtn.addEventListener('click', async ()=>{ const name = userNameInput.value.trim() || (currentUser() && currentUser().name) || ''; const id = userIdInput.value.trim() || (currentUser() && currentUser().id) || ''; await createNewReport({name,id}); });
  takeReportBtn.addEventListener('click', async ()=>{ const name = userNameInput.value.trim() || (currentUser() && currentUser().name) || ''; const id = userIdInput.value.trim() || (currentUser() && currentUser().id) || ''; await takeReportByNumber({name,id}); });

  // attach section handlers (autosave)
  [catEl,tractionEl,trainNumberEl,routeEl,trainDateEl].forEach(el=>{ if(!el) return; el.addEventListener('change', saveAndRender); el.addEventListener('input', saveAndRender); });

  // ---------- Modale forms ----------
  const formTraction = qs('formTraction');
  formTraction.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ const name=qs('t_name').value.trim(), id=qs('t_id').value.trim(), zdp=qs('t_zdp').value, loco=qs('t_loco').value.trim(), from=qs('t_from').value.trim(), to=qs('t_to').value.trim(); if(!name||!id) return alert('Imię i numer są wymagane.'); const entry={name,id,zdp,loco,from,to}; const mode=formTraction.getAttribute('data-mode'); if(mode==='edit'){ const ix=Number(formTraction.getAttribute('data-index')); currentReport.sectionB[ix]=entry; } else { currentReport.sectionB.push(entry); } if(from) stationsSet.add(from); if(to) stationsSet.add(to); populateStationsDatalist(Array.from(stationsSet)); await saveAndRender(); formTraction.reset(); bootstrap.Modal.getInstance(qs('modalTraction')).hide(); }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); bootstrap.Modal.getInstance(qs('modalTraction')).hide(); } });

  const formConductor = qs('formConductor');
  formConductor.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ const name=qs('c_name').value.trim(), id=qs('c_id').value.trim(), zdp=qs('c_zdp').value, role=qs('c_role').value, from=qs('c_from').value.trim(), to=qs('c_to').value.trim(); if(!name||!id) return alert('Imię i numer są wymagane.'); const entry={name,id,zdp,role,from,to}; const mode=formConductor.getAttribute('data-mode'); if(mode==='edit'){ const ix=Number(formConductor.getAttribute('data-index')); currentReport.sectionC[ix]=entry; } else { currentReport.sectionC.push(entry); } if(from) stationsSet.add(from); if(to) stationsSet.add(to); populateStationsDatalist(Array.from(stationsSet)); await saveAndRender(); formConductor.reset(); bootstrap.Modal.getInstance(qs('modalConductor')).hide(); }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); bootstrap.Modal.getInstance(qs('modalConductor')).hide(); } });

  const formOrder = qs('formOrder');
  formOrder.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ const number=qs('o_number').value.trim(), time=qs('o_time').value.trim(), text=qs('o_text').value.trim(), source=qs('o_source').value; if(!text) return alert('Treść dyspozycji jest wymagana.'); if(!isValidTime(time)) return alert('Godzina musi być HH:MM.'); const entry={number,time,text,source}; const mode=formOrder.getAttribute('data-mode'); if(mode==='edit'){ const ix=Number(formOrder.getAttribute('data-index')); currentReport.sectionD[ix]=entry; } else { currentReport.sectionD.push(entry); } await saveAndRender(); formOrder.reset(); bootstrap.Modal.getInstance(qs('modalOrder')).hide(); }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); bootstrap.Modal.getInstance(qs('modalOrder')).hide(); } });

  const formStation = qs('formStation');
  formStation.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ const station=qs('s_station').value.trim(); const dateArrPlan=qs('s_dateArr').value, dateArrReal=qs('s_dateArrReal').value; const dateDepPlan=qs('s_dateDep').value, dateDepReal=qs('s_dateDepReal').value; const planArr=qs('s_planArr').value.trim(), planDep=qs('s_planDep').value.trim(); const realArr=qs('s_realArr').value.trim(), realDep=qs('s_realDep').value.trim(); const delayReason=qs('s_delayReason').value.trim(), writtenOrders=qs('s_writtenOrders').value.trim(); if(!station) return alert('Nazwa stacji jest wymagana.'); if(!isValidTime(planArr)||!isValidTime(planDep)||!isValidTime(realArr)||!isValidTime(realDep)) return alert('Czas HH:MM lub puste.'); const fallback = trainDateEl?.value||currentReport.sectionA.date||''; const planArrDT=parseDateTime(dateArrPlan,planArr,fallback); const realArrDT=parseDateTime(dateArrReal,realArr,fallback); const planDepDT=parseDateTime(dateDepPlan,planDep,fallback); const realDepDT=parseDateTime(dateDepReal,realDep,fallback); let delayArrMinutes=null; if(planArrDT&&realArrDT) delayArrMinutes=Math.round((realArrDT-planArrDT)/60000); let delayDepMinutes=null; if(planDepDT&&realDepDT) delayDepMinutes=Math.round((realDepDT-planDepDT)/60000); let realStopMinutes=null; if(realArrDT&&realDepDT) realStopMinutes=Math.round((realDepDT-realArrDT)/60000); if(!stationsSet.has(station)){ stationsSet.add(station); populateStationsDatalist(Array.from(stationsSet)); } const entry={ station, dateArr:dateArrPlan, planArr, dateArrReal, realArr, dateDep:dateDepPlan, planDep, dateDepReal, realDep, delayArrMinutes, delayDepMinutes, realStopMinutes, delayReason, writtenOrders }; const mode=formStation.getAttribute('data-mode'); if(mode==='edit'){ const ix=Number(formStation.getAttribute('data-index')); currentReport.sectionE[ix]=entry; } else { currentReport.sectionE.push(entry); } await saveAndRender(); formStation.reset(); bootstrap.Modal.getInstance(qs('modalStation')).hide(); }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); bootstrap.Modal.getInstance(qs('modalStation')).hide(); } });

  const formControl = qs('formControl');
  formControl.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ const by=qs('f_by').value.trim(), id=qs('f_id').value.trim(), desc=qs('f_desc').value.trim(), notes=qs('f_notes').value.trim(); if(!by) return alert('Imię i nazwisko kontrolującego jest wymagane.'); const entry={by,id,desc,notes}; const mode=formControl.getAttribute('data-mode'); if(mode==='edit'){ const ix=Number(formControl.getAttribute('data-index')); currentReport.sectionF[ix]=entry; } else { currentReport.sectionF.push(entry); } await saveAndRender(); formControl.reset(); bootstrap.Modal.getInstance(qs('modalControl')).hide(); }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); bootstrap.Modal.getInstance(qs('modalControl')).hide(); } });

  const formNote = qs('formNote');
  formNote.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ const text=qs('n_text').value.trim(); if(!text) return alert('Treść uwagi jest wymagana.'); const entry={text}; const mode=formNote.getAttribute('data-mode'); if(mode==='edit'){ const ix=Number(formNote.getAttribute('data-index')); currentReport.sectionG[ix]=entry; } else { currentReport.sectionG.push(entry); } await saveAndRender(); formNote.reset(); bootstrap.Modal.getInstance(qs('modalNote')).hide(); }catch(err){ console.error(err); alert('Błąd zapisu: '+(err.message||err)); bootstrap.Modal.getInstance(qs('modalNote')).hide(); } });

  // Edit modal helper
  function openEditModal(type,idx){
    if(!currentReport) return;
    if(type==='traction'){ const it=currentReport.sectionB[idx]; qs('t_name').value=it.name||''; qs('t_id').value=it.id||''; qs('t_zdp').value=it.zdp||'WAW'; qs('t_loco').value=it.loco||''; qs('t_from').value=it.from||''; qs('t_to').value=it.to||''; formTraction.setAttribute('data-mode','edit'); formTraction.setAttribute('data-index',idx); new bootstrap.Modal(qs('modalTraction')).show(); }
    else if(type==='conductor'){ const it=currentReport.sectionC[idx]; qs('c_name').value=it.name||''; qs('c_id').value=it.id||''; qs('c_zdp').value=it.zdp||'WAW'; qs('c_role').value=it.role||'KP'; qs('c_from').value=it.from||''; qs('c_to').value=it.to||''; formConductor.setAttribute('data-mode','edit'); formConductor.setAttribute('data-index',idx); new bootstrap.Modal(qs('modalConductor')).show(); }
    else if(type==='order'){ const it=currentReport.sectionD[idx]; qs('o_number').value=it.number||''; qs('o_time').value=it.time||''; qs('o_text').value=it.text||''; qs('o_source').value=it.source||'Dyspozytura'; formOrder.setAttribute('data-mode','edit'); formOrder.setAttribute('data-index',idx); new bootstrap.Modal(qs('modalOrder')).show(); }
    else if(type==='station'){ const it=currentReport.sectionE[idx]; qs('s_station').value=it.station||''; qs('s_dateArr').value=it.dateArr||''; qs('s_planArr').value=it.planArr||''; qs('s_dateArrReal').value=it.dateArrReal||''; qs('s_realArr').value=it.realArr||''; qs('s_dateDep').value=it.dateDep||''; qs('s_planDep').value=it.planDep||''; qs('s_dateDepReal').value=it.dateDepReal||''; qs('s_realDep').value=it.realDep||''; qs('s_delayReason').value=it.delayReason||''; qs('s_writtenOrders').value=it.writtenOrders||''; formStation.setAttribute('data-mode','edit'); formStation.setAttribute('data-index',idx); new bootstrap.Modal(qs('modalStation')).show(); }
    else if(type==='control'){ const it=currentReport.sectionF[idx]; qs('f_by').value=it.by||''; qs('f_id').value=it.id||''; qs('f_desc').value=it.desc||''; qs('f_notes').value=it.notes||''; formControl.setAttribute('data-mode','edit'); formControl.setAttribute('data-index',idx); new bootstrap.Modal(qs('modalControl')).show(); }
    else if(type==='note'){ const it=currentReport.sectionG[idx]; qs('n_text').value=it.text||''; formNote.setAttribute('data-mode','edit'); formNote.setAttribute('data-index',idx); new bootstrap.Modal(qs('modalNote')).show(); }
  }

  // reset modals on hide
  document.querySelectorAll('.modal').forEach(m=>{ m.addEventListener('hidden.bs.modal', ()=>{ const form=m.querySelector('form'); if(form){ form.setAttribute('data-mode','add'); form.setAttribute('data-index',''); form.reset(); } }); });

  // Export / Import JSON
  exportJsonBtn.addEventListener('click', ()=>{ if(!currentReport) return alert('Brak otwartego raportu.'); const dataStr=JSON.stringify(currentReport,null,2); const blob=new Blob([dataStr],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${currentReport.number.replace(/\//g,'-')}.json`; a.click(); URL.revokeObjectURL(url); });
  importBtn.addEventListener('click', ()=> importFile && importFile.click());
  importFile.addEventListener('change', async (e)=>{ const f=e.target.files?.[0]; if(!f) return; const text=await f.text(); try{ const rep=JSON.parse(text); if(!rep.number) throw new Error('Nieprawidłowy plik'); await saveReport(rep); alert('Raport zaimportowany.'); }catch(err){ alert('Błąd importu: '+err.message); } });

  // PDF preview
  previewPdfBtn.addEventListener('click', async ()=>{ if(!currentReport) return alert('Brak otwartego raportu.'); const container=document.createElement('div'); container.className='print-container'; const header=document.createElement('div'); header.className='print-header'; header.innerHTML=`<div class="print-title">Raport z jazdy pociągu</div><div class="print-meta">Numer: ${currentReport.number} · Prowadzący: ${currentReport.currentDriver?.name || currentReport.createdBy?.name} (${currentReport.currentDriver?.id || currentReport.createdBy?.id})</div><div class="print-meta">Wygenerowano dnia ${new Date().toLocaleString()}</div>`; container.appendChild(header); // sections
    const secA=document.createElement('div'); secA.className='section'; secA.innerHTML=`<h6>A - Dane ogólne</h6><table class="table-print"><tbody><tr><th>Kategoria</th><td>${safeText(currentReport.sectionA.category)}</td></tr><tr><th>Trakcja</th><td>${safeText(currentReport.sectionA.traction)}</td></tr><tr><th>Numer pociągu</th><td>${safeText(currentReport.sectionA.trainNumber)}</td></tr><tr><th>Relacja</th><td>${safeText(currentReport.sectionA.route)}</td></tr><tr><th>Data kursu</th><td>${safeText(currentReport.sectionA.date)}</td></tr></tbody></table>`; container.appendChild(secA);
    function makeCrewTable(title,arr,cols){ const s=document.createElement('div'); s.className='section'; s.innerHTML=`<h6>${title}</h6>`; const table=document.createElement('table'); table.className='table-print'; const thead=document.createElement('thead'); thead.innerHTML=`<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`; table.appendChild(thead); const tbody=document.createElement('tbody'); if((arr||[]).length===0){ tbody.innerHTML=`<tr><td colspan="${cols.length}">-</td></tr>`; } else { arr.forEach(it=>{ const cells=cols.map(k=>`<td>${safeText(it[k])}</td>`).join(''); tbody.innerHTML+=`<tr>${cells}</tr>`; }); } table.appendChild(tbody); s.appendChild(table); return s; }
    container.appendChild(makeCrewTable('B - Drużyna trakcyjna', currentReport.sectionB, ['name','id','zdp','loco','from','to']));
    container.appendChild(makeCrewTable('C - Drużyna konduktorska', currentReport.sectionC, ['name','id','zdp','role','from','to']));
    const secD=document.createElement('div'); secD.className='section'; secD.innerHTML=`<h6>D - Dyspozycje</h6>`; if((currentReport.sectionD||[]).length===0) secD.innerHTML+=`<div>-</div>`; else { const t=document.createElement('table'); t.className='table-print'; t.innerHTML=`<thead><tr><th>Nr</th><th>Godz.</th><th>Treść</th><th>Źródło</th></tr></thead><tbody>${currentReport.sectionD.map(o=>`<tr><td>${safeText(o.number)}</td><td>${safeText(o.time)}</td><td>${safeText(o.text)}</td><td>${safeText(o.source)}</td></tr>`).join('')}</tbody>`; secD.appendChild(t); } container.appendChild(secD);
    const secE=document.createElement('div'); secE.className='section'; secE.innerHTML=`<h6>E - Dane o jeździe pociągu</h6>`; const tableE=document.createElement('table'); tableE.className='table-print'; tableE.innerHTML=`<thead><tr><th>Stacja</th><th>Data przyj. (plan)</th><th>Godz. przyj. (plan)</th><th>Data przyj. (real)</th><th>Godz. przyj. (real)</th><th>Odchylenie przyj.</th><th>Data odj. (plan)</th><th>Godz. odj. (plan)</th><th>Data odj. (real)</th><th>Godz. odj. (real)</th><th>Odchylenie odj.</th><th>Postój (min)</th><th>Powód / Rozkazy</th></tr></thead><tbody>${(currentReport.sectionE||[]).length===0?`<tr><td colspan="13">-</td></tr>`: currentReport.sectionE.map(s=>{ const arrVal=(s.delayArrMinutes!=null)?`${s.delayArrMinutes} min`:'-'; const depVal=(s.delayDepMinutes!=null)?`${s.delayDepMinutes} min`:'-'; const arrStyle=s.delayArrMinutes==null?'':(s.delayArrMinutes>0?'color:red;font-weight:600;':(s.delayArrMinutes<0?'color:green;font-weight:600;':'color:black;font-weight:600;')); const depStyle=s.delayDepMinutes==null?'':(s.delayDepMinutes>0?'color:red;font-weight:600;':(s.delayDepMinutes<0?'color:green;font-weight:600;':'color:black;font-weight:600;')); const stop=s.realStopMinutes!=null?`${s.realStopMinutes}`:'-'; const pow=(s.delayReason||'-')+(s.writtenOrders? ' / '+s.writtenOrders : ''); return `<tr><td>${safeText(s.station)}</td><td>${safeText(s.dateArr)}</td><td>${safeText(s.planArr)}</td><td>${safeText(s.dateArrReal)}</td><td>${safeText(s.realArr)}</td><td style="${arrStyle}">${arrVal}</td><td>${safeText(s.dateDep)}</td><td>${safeText(s.planDep)}</td><td>${safeText(s.dateDepReal)}</td><td>${safeText(s.realDep)}</td><td style="${depStyle}">${depVal}</td><td>${stop}</td><td>${pow}</td></tr>`; }).join('')}</tbody>`; secE.appendChild(tableE); container.appendChild(secE);
    const secF=document.createElement('div'); secF.className='section'; secF.innerHTML=`<h6>F - Kontrola pociągu</h6>`; if((currentReport.sectionF||[]).length===0) secF.innerHTML+=`<div>-</div>`; else { const t=document.createElement('table'); t.className='table-print'; t.innerHTML=`<thead><tr><th>Kontrolujący</th><th>Numer</th><th>Opis</th><th>Uwagi</th></tr></thead><tbody>${currentReport.sectionF.map(c=>`<tr><td>${safeText(c.by)}</td><td>${safeText(c.id)}</td><td>${safeText(c.desc)}</td><td>${safeText(c.notes)}</td></tr>`).join('')}</tbody>`; secF.appendChild(t); } container.appendChild(secF);
    const secG=document.createElement('div'); secG.className='section'; secG.innerHTML=`<h6>G - Uwagi kierownika pociągu</h6>`; if((currentReport.sectionG||[]).length===0) secG.innerHTML+=`<div>-</div>`; else { const ul=document.createElement('ul'); currentReport.sectionG.forEach(n=>{ const li=document.createElement('li'); li.textContent=n.text; ul.appendChild(li); }); secG.appendChild(ul); } container.appendChild(secG);
    const footer=document.createElement('div'); footer.className='print-footer'; footer.textContent=`Wygenerowano dnia ${new Date().toLocaleString()} z systemu ERJ`; container.appendChild(footer);
    const filename = `${currentReport.number.replace(/\//g,'-')}.pdf`;
    await exportPdf(container, filename);
  });

  // open admin hides report
  document.body.addEventListener('click', (e)=>{ const t=e.target; if(t.closest && t.closest('#openAdminBtn')){ const u=currentUser(); if(!u||u.role!=='admin') return alert('Brak uprawnień.'); reportPanel.style.display='none'; startPanel.style.display='block'; adminPanel.style.display='block'; refreshUsersTable(); } });

  // initial load: nothing
});
