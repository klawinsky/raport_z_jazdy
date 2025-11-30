// db.js
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';

const DB_NAME = 'erj-db';
const DB_VERSION = 1;
const REPORT_STORE = 'reports';
const META_STORE = 'meta';

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(REPORT_STORE)) {
      db.createObjectStore(REPORT_STORE, { keyPath: 'number' });
    }
    if (!db.objectStoreNames.contains(META_STORE)) {
      db.createObjectStore(META_STORE, { keyPath: 'key' });
    }
  }
});

export async function saveReport(report) {
  const db = await dbPromise;
  await db.put(REPORT_STORE, report);
}

export async function getReport(number) {
  const db = await dbPromise;
  return db.get(REPORT_STORE, number);
}

export async function deleteReport(number) {
  const db = await dbPromise;
  return db.delete(REPORT_STORE, number);
}

export async function listReports() {
  const db = await dbPromise;
  return db.getAll(REPORT_STORE);
}

export async function nextCounter() {
  const db = await dbPromise;
  const key = 'counter';
  let meta = await db.get(META_STORE, key);
  if (!meta) meta = { key, value: 0 };
  meta.value = (meta.value || 0) + 1;
  await db.put(META_STORE, meta);
  return meta.value;
}
