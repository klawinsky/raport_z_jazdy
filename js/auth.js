// js/auth.js
import { getUserByEmailOrId, seedAdminIfMissing, saveUser } from './db.js';

// Utility: SHA-256 hashing for passwords (browser crypto.subtle)
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

const AUTH_KEY = 'erj_current_user';

export async function initAuth() {
  // Seed admin account (password hashed)
  const adminPlain = 'Admin@77144'; // demo password (możesz zmienić)
  const admin = {
    name: 'Paweł Klawiński',
    id: '77144',
    zdp: 'WAW',
    role: 'admin',
    status: 'active',
    email: 'klawinski.pawel@gmail.com',
    // passwordHash will be set below
  };
  const hash = await hashPassword(adminPlain);
  admin.passwordHash = hash;
  await seedAdminIfMissing(admin);
  // return adminPlain for demo login button if needed
  return adminPlain;
}

export async function registerUser({ name, id, zdp, email, password, role='user', status='active' }) {
  const passwordHash = await hashPassword(password);
  const user = { name, id, zdp, email, role, status, passwordHash };
  await saveUser(user);
  return user;
}

export async function login(loginId, password) {
  const user = await getUserByEmailOrId(loginId);
  if (!user) return { ok:false, reason:'Nie znaleziono użytkownika' };
  if (user.status !== 'active') return { ok:false, reason:'Konto nieaktywne' };
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) return { ok:false, reason:'Nieprawidłowe hasło' };
  // store minimal session
  const session = { email: user.email, id: user.id, name: user.name, role: user.role, zdp: user.zdp, loggedAt: new Date().toISOString() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return { ok:true, user: session };
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

export function currentUser() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
