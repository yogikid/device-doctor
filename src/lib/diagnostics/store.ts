/**
 * Store sesi mini — nyimpen hasil tiap test/kategori ke localStorage
 * supaya ringkasan bisa agregatin semuanya, dan progress nggak hilang
 * pas user pindah tab. Event-based biar UI bisa subscribe.
 */
import type { Entry, Session, Status } from './types';

const KEY = 'dd-session-v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3; // sesi hangus setelah 3 hari

function fresh(): Session {
  return { v: 1, updatedAt: Date.now(), entries: {} };
}

let current: Session = load();
const listeners = new Set<(s: Session) => void>();

function load(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Session;
    if (parsed?.v !== 1 || Date.now() - parsed.updatedAt > MAX_AGE_MS) return fresh();
    return parsed;
  } catch {
    return fresh();
  }
}

function persist() {
  current.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage bisa penuh/ditolak — app tetap jalan di memori */
  }
}

export function getSession(): Session {
  return current;
}

export function getEntry(key: string): Entry | undefined {
  return current.entries[key];
}

export function getStatus(key: string): Status {
  return current.entries[key]?.status ?? 'pending';
}

export function setEntry(key: string, entry: Omit<Entry, 'at'> & Partial<Pick<Entry, 'at'>>) {
  current.entries[key] = { ...entry, at: Date.now() };
  persist();
  for (const fn of listeners) fn(current);
}

export function resetSession() {
  current = fresh();
  persist();
  for (const fn of listeners) fn(current);
}

export function onSession(fn: (s: Session) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Jumlah test yang udah dikonfirmasi user (apa pun hasilnya). */
export function completedTestCount(testIds: readonly string[]): number {
  return testIds.filter((id) => {
    const st = current.entries[id]?.status;
    return st !== undefined && st !== 'pending';
  }).length;
}
