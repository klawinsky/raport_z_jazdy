// js/app.js
import { listUsers, getUserByEmailOrId, updateUser, deleteUser, saveReport, nextCounter, getReport } from './db.js';
import { initAuth, registerUser, login, logout, currentUser, hashPassword } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const adminPlain = await initAuth();

  // UI refs
  const loginView = document.getElementById('loginView');
  const loginForm = document.getElementById('loginForm');
  const loginId = document.getElementById('loginId');
  const loginPassword = document.getElementById('loginPassword');
  const loginMsg = document.getElementById('loginMsg');
  const demoBtn = document.getElementById('demoBtn');

  const appShell = document.getElementById('appShell');
  const loggedUserInfo = document.getElementById('loggedUserInfo');
  const btnLogout = document.getElementById('btnLogout');
  const openAdminBtn = document.getElementById('openAdminBtn');

  const adminPanel = document.getElementById('adminPanel');
  const usersTableBody = document.querySelector('#usersTable tbody');
  const addUserBtn = document.getElementById('addUserBtn');
  const modalUser = document.getElementById('modalUser');
  const formUser = document.getElementById('formUser');
  const userFormMsg = document.getElementById('userFormMsg');

  // Report UI refs
  const startPanel = document.getElementById('startPanel');
  const newReportBtn = document.getElementById('newReportBtn');
  const takeReportBtn = document.getElementById('takeReportBtn');
  const userNameInput = document.getElementById('userName');
  const userIdInput = document.getElementById('userId');
  const reportPanel = document.getElementById('reportPanel');
  const reportNumberEl = document.getElementById('reportNumber');
  const currentUserEl = document.getElementById('currentUser');
  const closeReportBtn = document.getElementById('closeReport');

  // lists and modals for sections (basic placeholders)
  const tractionList = document.getElementById('tractionList');
  const conductorList = document.getElementById('conductorList');
  const ordersList = document.getElementById('ordersList');
  const stationsList = document.getElementById('stationsList');
  const controlsList = document.getElementById('controlsList');
  const notesList = document.getElementById('notesList');

  // visibility helpers
  function showLoginView() {
    loginView.style.display = 'block';
    appShell.style.display = 'none';
    adminPanel.style.display = 'none';
  }
  function showAppFor(user) {
    loginView.style.display = 'none';
    appShell.style.display = 'block';
    loggedUserInfo.textContent = `${user.name} (${user.id}) · ${user.role}`;
    if (user.role === 'admin') adminPanel.style.display = 'block';
    else adminPanel.style.display = 'none';
    userNameInput.value = user.name || '';
    userIdInput.value = user.id || '';
    awaitRefreshUsersTable();
  }

  // session check
  const sess = currentUser();
  if (sess) {
    showAppFor(sess);
  } else {
    showLoginView();
  }

  // login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginMsg.textContent = '';
    const id = loginId.value.trim();
    const pw = loginPassword.value;
    if (!id || !pw) return loginMsg.textContent = 'Podaj login i hasło.';
    const res = await login(id, pw);
    if (!res.ok) return loginMsg.textContent = res.reason || 'Błąd logowania';
    showAppFor(res.user);
  });

  demoBtn.addEventListener('click', () => {
    loginId.value = 'klawinski.pawel@gmail.com';
    loginPassword.value = adminPlain;
    loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  btnLogout.addEventListener('click', () => {
    logout();
    showLoginView();
    loginId.value = ''; loginPassword.value = '';
    loginMsg.textContent = '';
  });

  // users table
  async function awaitRefreshUsersTable() {
    // small wrapper to avoid hoisting issues
    await refreshUsersTable();
  }
  async function refreshUsersTable() {
    if (!usersTableBody) return;
    usersTableBody.innerHTML = '';
    const users = await listUsers();
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.name || '-'}</td>
        <td>${u.id || '-'}</td>
        <td>${u.zdp || '-'}</td>
        <td>${u.email || '-'}</td>
        <td>${u.role || '-'}</td>
        <td>${u.status || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-secondary me-1" data-action="edit" data-key="${u.email||u.id}">Edytuj</button>
          <button class="btn btn-sm btn-outline-danger" data-action="del" data-key="${u.email||u.id}">Usuń</button>
        </td>`;
      usersTableBody.appendChild(tr);
    });
  }

  // user form submit
  formUser.addEventListener('submit', async (e) => {
    e.preventDefault();
    userFormMsg.textContent = '';
    const mode = formUser.getAttribute('data-mode') || 'add';
    const idx = formUser.getAttribute('data-index') || '';
    const name = document.getElementById('u_name').value.trim();
    const id = document.getElementById('u_id').value.trim();
    const zdp = document.getElementById('u_zdp').value;
    const email = document.getElementById('u_email').value.trim();
    const password = document.getElementById('u_password').value;
    const role = document.getElementById('u_role').value;
    const status = document.getElementById('u_status').value;
    if (!name || !id || !email || !password) return userFormMsg.textContent = 'Wypełnij wszystkie wymagane pola.';
    try {
      if (mode === 'add') {
        await registerUser({ name, id, zdp, email, password, role, status });
      } else {
        const patch = { name, id, zdp, email, role, status };
        if (password) patch.passwordHash = await hashPassword(password);
        await updateUser(idx, patch);
      }
      const bs = bootstrap.Modal.getInstance(modalUser);
      bs && bs.hide();
      formUser.reset();
      await refreshUsersTable();
    } catch (err) {
      userFormMsg.textContent = err.message || 'Błąd zapisu użytkownika';
    }
  });

  // users table delegation
  usersTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const key = btn.getAttribute('data-key');
    if (action === 'edit') {
      const u = await getUserByEmailOrId(key);
      if (!u) return alert('Nie znaleziono użytkownika');
      formUser.setAttribute('data-mode','edit');
      formUser.setAttribute('data-index', key);
      document.getElementById('u_name').value = u.name || '';
      document.getElementById('u_id').value = u.id || '';
      document.getElementById('u_zdp').value = u.zdp || 'WAW';
      document.getElementById('u_email').value = u.email || '';
      document.getElementById('u_password').value = '';
      document.getElementById('u_role').value = u.role || 'user';
      document.getElementById('u_status').value = u.status || 'active';
      document.querySelector('#modalUser .modal-title').textContent = 'Edytuj użytkownika';
      new bootstrap.Modal(modalUser).show();
    } else if (action === 'del') {
      if (!confirm('Usunąć użytkownika?')) return;
      try {
        await deleteUser(key);
        await refreshUsersTable();
      } catch (err) {
        alert('Błąd usuwania: ' + (err.message || err));
      }
    }
  });

  // open admin panel
  document.body.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest && t.closest('#openAdminBtn')) {
      e.preventDefault();
      const u = currentUser();
      if (!u || u.role !== 'admin') return alert('Brak uprawnień. Panel administracyjny dostępny tylko dla administratora.');
      // hide report when opening admin
      reportPanel.style.display = 'none';
      startPanel.style.display = 'block';
      adminPanel.style.display = 'block';
      await refreshUsersTable();
    }
  });

  // ----------------- Raporty: create / take -----------------

  async function createNewReport({ name, id }) {
    if (!name || !id) return alert('Podaj imię i numer służbowy.');
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
      sectionA: { category:'', traction:'', trainNumber:'', route:'', date: d.toISOString().slice(0,10) },
      sectionB: [], sectionC: [], sectionD: [], sectionE: [], sectionF: [], sectionG: []
    };
    await saveReport(report);
    openReport(report);
  }

  async function takeReportByNumber({ name, id }) {
    const num = prompt('Podaj numer raportu (np. 001/02/12/25):');
    if (!num) return;
    const rep = await getReport(num.trim());
    if (!rep) return alert('Nie znaleziono raportu o podanym numerze.');
    rep.takenBy = { name, id, at: new Date().toISOString() };
    await saveReport(rep);
    openReport(rep);
  }

  function renderReportSections(report) {
    // populate section A fields
    try {
      document.getElementById('cat').value = report.sectionA?.category || '';
      document.getElementById('traction').value = report.sectionA?.traction || '';
      document.getElementById('trainNumber').value = report.sectionA?.trainNumber || '';
      document.getElementById('route').value = report.sectionA?.route || '';
      document.getElementById('trainDate').value = report.sectionA?.date || '';
    } catch (e) { console.warn(e); }
    // render lists minimally (names only) so UI shows content
    function renderList(container, arr, renderer) {
      if (!container) return;
      container.innerHTML = '';
      (arr||[]).forEach((it, idx) => container.appendChild(renderer(it, idx)));
    }
    renderList(tractionList, report.sectionB || [], (it, idx) => {
      const d = document.createElement('div'); d.className='small'; d.textContent = `${it.name || '-'} (${it.id||'-'})`; return d;
    });
    renderList(conductorList, report.sectionC || [], (it, idx) => {
      const d = document.createElement('div'); d.className='small'; d.textContent = `${it.name || '-'} (${it.id||'-'})`; return d;
    });
    renderList(ordersList, report.sectionD || [], (it, idx) => {
      const d = document.createElement('div'); d.className='small'; d.textContent = `${it.number||''} ${it.time||''} ${it.text||''}`; return d;
    });
    renderList(stationsList, report.sectionE || [], (it, idx) => {
      const d = document.createElement('div'); d.className='small'; d.textContent = `${it.station||'-'} ${it.planArr||''}/${it.planDep||''}`; return d;
    });
    renderList(controlsList, report.sectionF || [], (it, idx) => {
      const d = document.createElement('div'); d.className='small'; d.textContent = `${it.by||'-'} ${it.desc||''}`; return d;
    });
    renderList(notesList, report.sectionG || [], (it, idx) => {
      const d = document.createElement('div'); d.className='small'; d.textContent = `${it.text||'-'}`; return d;
    });
  }

  function openReport(report) {
    if (!report) return;
    // hide admin panel when opening report
    adminPanel.style.display = 'none';
    startPanel.style.display = 'none';
    reportPanel.style.display = 'block';
    reportNumberEl.textContent = report.number || '-';
    currentUserEl.textContent = `${report.createdBy?.name || '-'} (${report.createdBy?.id || '-'})`;
    renderReportSections(report);
    reportPanel.scrollIntoView({ behavior: 'smooth' });
  }

  closeReportBtn.addEventListener('click', () => {
    reportPanel.style.display = 'none';
    startPanel.style.display = 'block';
    // show admin panel again only if current user is admin
    const u = currentUser();
    if (u && u.role === 'admin') adminPanel.style.display = 'block';
  });

  // global delegation for start-panel buttons
  document.body.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest && t.closest('#newReportBtn')) {
      e.preventDefault();
      const name = (userNameInput && userNameInput.value.trim()) || (currentUser() && currentUser().name) || '';
      const id = (userIdInput && userIdInput.value.trim()) || (currentUser() && currentUser().id) || '';
      await createNewReport({ name, id });
      return;
    }
    if (t.closest && t.closest('#takeReportBtn')) {
      e.preventDefault();
      const name = (userNameInput && userNameInput.value.trim()) || (currentUser() && currentUser().name) || '';
      const id = (userIdInput && userIdInput.value.trim()) || (currentUser() && currentUser().id) || '';
      await takeReportByNumber({ name, id });
      return;
    }
  });

  // expose helpers
  window.appAuth = { refreshUsersTable, currentUser: currentUser };

});
