// js/app.js
import { listUsers, saveUser, getUserByEmailOrId, updateUser, deleteUser } from './db.js';
import { initAuth, registerUser, login, logout, currentUser } from './auth.js';

// Import or reuse existing report functions if present (not duplicated here).
// This file handles UI, login flow, admin panel and integrates with existing report code.

document.addEventListener('DOMContentLoaded', async () => {
  // Init auth and seed admin
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

  // Simple helper
  function showLoginError(msg) { loginMsg.textContent = msg || ''; }
  function showUserFormError(msg) { userFormMsg.textContent = msg || ''; }

  // If already logged in, show app
  function showAppFor(user) {
    loginView.style.display = 'none';
    appShell.style.display = 'block';
    loggedUserInfo.textContent = `${user.name} (${user.id}) · ${user.role}`;
    // show admin panel only for admins
    if (user.role === 'admin') adminPanel.style.display = 'block';
    else adminPanel.style.display = 'none';
    // initialize other app parts (reports) if needed
    // e.g., initReportsUI(user);
    refreshUsersTable();
  }

  // If session exists
  const sess = currentUser();
  if (sess) showAppFor(sess);

  // Login form submit
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

  // Demo button: autofill admin credentials (for convenience)
  demoBtn.addEventListener('click', () => {
    loginId.value = 'klawinski.pawel@gmail.com';
    loginPassword.value = adminPlain;
    loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  // Logout
  btnLogout.addEventListener('click', () => {
    logout();
    appShell.style.display = 'none';
    loginView.style.display = 'block';
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

  // Open add user modal
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
        // edit: update user (password will be replaced)
        const passwordHash = await (await import('./auth.js')).hashPassword(password).catch(()=>null);
        const patch = { name, id, zdp, email, role, status };
        if (passwordHash) patch.passwordHash = passwordHash;
        await updateUser(idx, patch);
      }
      // close modal
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
      // load user and open modal in edit mode
      const u = await getUserByEmailOrId(key);
      if (!u) return alert('Nie znaleziono użytkownika');
      formUser.setAttribute('data-mode','edit');
      formUser.setAttribute('data-index', key);
      document.getElementById('u_name').value = u.name || '';
      document.getElementById('u_id').value = u.id || '';
      document.getElementById('u_zdp').value = u.zdp || 'WAW';
      document.getElementById('u_email').value = u.email || '';
      document.getElementById('u_password').value = ''; // require new password to change
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

  // small helper to expose registerUser for formUser
  async function registerUser(data) {
    // use auth.registerUser
    const auth = await import('./auth.js');
    return auth.registerUser(data);
  }

  // Expose some functions globally if needed by other modules
  window.appAuth = { refreshUsersTable, currentUser: currentUser };

});
