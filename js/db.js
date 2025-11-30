// js/db.js
// Proste API oparte na localStorage: saveReport, getReport, nextCounter

const STORAGE_KEY_PREFIX = 'erj_report_';
const COUNTER_KEY = 'erj_counter';

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
