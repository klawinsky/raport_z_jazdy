// js/app.js
import { listUsers, getUserByEmailOrId, updateUser, deleteUser } from './db.js';
import { initAuth, registerUser, login, logout, currentUser, hashPassword } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Seed admin and get demo password
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

  // Ensure initial visibility: show login unless session exists
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
    refreshUsersTable();
  }

  // If session exists, show app; otherwise show login
  const sess = currentUser();
  if (sess) showAppFor(sess);
  else showLoginView();

  // Helpers
  function showLoginError(msg) { loginMsg.textContent = msg || ''; }
  function showUserFormError(msg) { userFormMsg.textContent = msg || ''; }

  // Login submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoginError('');
    const id = loginId.value.trim();
    const pw = loginPassword.value;
    if (!id || !pw) return showLoginError('Podaj login i hasło.');
    const res = await login(id, pw);
    if (!res.ok) return showLoginError(res.reason || 'Błąd logowania');
    showAppFor(res.user);
  });

  // Demo button
  demoBtn.addEventListener('click', () => {
    loginId.value = 'klawinski.pawel@gmail.com';
    loginPassword.value = adminPlain;
    loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  // Logout
  btnLogout.addEventListener('click', () => {
    logout();
    showLoginView();
    loginId.value = ''; loginPassword.value = '';
    showLoginError('');
  });

  // Admin: refresh users table
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

  // Add / Edit user modal submit
  formUser.addEventListener('submit', async (e) => {
    e.preventDefault();
    showUserFormError('');
    const mode = formUser.getAttribute('data-mode') || 'add';
    const idx = formUser.getAttribute('data-index') || '';
    const name = document.getElementById('u_name').value.trim();
    const id = document.getElementById('u_id').value.trim();
    const zdp = document.getElementById('u_zdp').value;
    const email = document.getElementById('u_email').value.trim();
    const password = document.getElementById('u_password').value;
    const role = document.getElementById('u_role').value;
    const status = document.getElementById('u_status').value;
    if (!name || !id || !email || !password) return showUserFormError('Wypełnij wszystkie wymagane pola.');
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
      showUserFormError(err.message || 'Błąd zapisu użytkownika');
    }
  });

  // Delegacja akcji w users table
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

  // Open add user modal (clear form)
  addUserBtn.addEventListener('click', () => {
    formUser.setAttribute('data-mode','add');
    formUser.setAttribute('data-index','');
    formUser.reset();
    document.querySelector('#modalUser .modal-title').textContent = 'Dodaj użytkownika';
    showUserFormError('');
  });

  // Open admin panel button from start panel
  openAdminBtn.addEventListener('click', async () => {
    const u = currentUser();
    if (!u || u.role !== 'admin') return alert('Brak uprawnień. Panel administracyjny dostępny tylko dla administratora.');
    adminPanel.scrollIntoView({ behavior: 'smooth' });
    await refreshUsersTable();
  });

  // Expose helper for other modules if needed
  window.appAuth = { refreshUsersTable, currentUser: currentUser };

});
