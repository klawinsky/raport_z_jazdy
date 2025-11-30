import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';

export const dbPromise = openDB('erj-db', 1, {
  upgrade(db) {
    db.createObjectStore('reports', { keyPath: 'number' });
    db.createObjectStore('meta', { keyPath: 'key' });
  }
});

export async function saveReport(report) {
  const db = await dbPromise;
  await db.put('reports', report);
}

export async function getReport(number) {
  const db = await dbPromise;
  return db.get('reports', number);
}

export async function nextCounter() {
  const db = await dbPromise;
  const meta = await db.get('meta', 'counter') || { key:'counter', value:0 };
  meta.value++;
  await db.put('meta', meta);
  return meta.value;
}
