// js/db.js
// Proste API oparte na localStorage: saveReport, getReport, nextCounter
// + user management: saveUser, getUserByEmailOrId, listUsers, updateUser, deleteUser

const STORAGE_KEY_PREFIX = 'erj_report_';
const COUNTER_KEY = 'erj_counter';
const USERS_KEY = 'erj_users';

export async function saveReport(report) {
  if (!report || !report.number) throw new Error('Brak numeru raportu');
  localStorage.setItem(STORAGE_KEY_PREFIX + report.number, JSON.stringify(report));
  return true;
}

export async function getReport(number) {
  const raw = localStorage.getItem(STORAGE_KEY_PREFIX + number);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

export async function nextCounter() {
  const raw = localStorage.getItem(COUNTER_KEY);
  let n = raw ? Number(raw) : 0;
  n = (isNaN(n) ? 0 : n) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return n;
}

/* ---------- Users API (localStorage) ---------- */
function _readUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}
function _writeUsers(arr) {
  localStorage.setItem(USERS_KEY, JSON.stringify(arr));
}

export async function listUsers() {
  return _readUsers();
}

export async function saveUser(user) {
  if (!user || (!user.email && !user.id)) throw new Error('Nieprawidłowe dane użytkownika');
  const arr = _readUsers();
  const idx = arr.findIndex(u => (u.email && u.email.toLowerCase() === (user.email||'').toLowerCase()) || (u.id && String(u.id) === String(user.id)));
  if (idx >= 0) { arr[idx] = { ...arr[idx], ...user, updatedAt: new Date().toISOString() }; }
  else { arr.push({ ...user, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }
  _writeUsers(arr);
  return true;
}

export async function getUserByEmailOrId(login) {
  if (!login) return null;
  const arr = _readUsers();
  return arr.find(u => (u.email && u.email.toLowerCase() === (login||'').toLowerCase()) || (u.id && String(u.id) === String(login))) || null;
}

export async function updateUser(emailOrId, patch) {
  const arr = _readUsers();
  const idx = arr.findIndex(u => (u.email && u.email.toLowerCase() === (emailOrId||'').toLowerCase()) || (u.id && String(u.id) === String(emailOrId)));
  if (idx < 0) throw new Error('Nie znaleziono użytkownika');
  arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
  _writeUsers(arr);
  return arr[idx];
}

export async function deleteUser(emailOrId) {
  const arr = _readUsers();
  const idx = arr.findIndex(u => (u.email && u.email.toLowerCase() === (emailOrId||'').toLowerCase()) || (u.id && String(u.id) === String(emailOrId)));
  if (idx < 0) throw new Error('Nie znaleziono użytkownika');
  arr.splice(idx,1);
  _writeUsers(arr);
  return true;
}

/* ---------- Seed admin (idempotent) ---------- */
export async function seedAdminIfMissing(admin) {
  if (!admin || !admin.email) return;
  const existing = await getUserByEmailOrId(admin.email);
  if (existing) return existing;
  const arr = _readUsers();
  arr.push({ ...admin, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  _writeUsers(arr);
  return admin;
}
