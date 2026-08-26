/** Tipe bersama buat seluruh engine diagnostic. */

export type Status =
  | 'pass' // lolos / baik-baik saja
  | 'warn' // perlu perhatian
  | 'fail' // indikasi masalah
  | 'info' // catatan netral (misal keterbatasan browser)
  | 'unsupported' // API nggak ada di browser ini — BUKAN gagal device
  | 'denied' // permission ditolak user
  | 'pending'; // belum dijalankan

export interface Entry {
  status: Status;
  /** Penjelasan singkat bahasa Indonesia buat user. */
  note?: string;
  /** Fakta mentah (angka/string) buat ditampilkan ulang di ringkasan. */
  value?: string;
  at?: number;
}

export interface Session {
  v: 1;
  updatedAt: number;
  entries: Record<string, Entry>;
}

/** ID test diagnostic (mode Periksa). */
export const TEST_IDS = [
  'touch',
  'display',
  'speaker',
  'mic',
  'camera',
  'vibrate',
  'motion',
  'benchmark',
  'gps',
] as const;

export type TestId = (typeof TEST_IDS)[number];

/** ID kategori info dashboard. */
export const INFO_IDS = [
  'battery',
  'connection',
  'device',
  'screen',
  'gpu',
  'storage',
  'location',
] as const;

export type InfoId = (typeof INFO_IDS)[number];

export type StampKind = 'healthy' | 'attention' | 'critical';

export interface Recommendation {
  kind: 'critical' | 'attention' | 'info';
  title: string;
  body: string;
}

export interface Verdict {
  stamp: 'SEHAT' | 'PERLU PERHATIAN' | 'PERIKSA LEBIH LANJUT';
  kind: StampKind;
  sub: string;
  items: Recommendation[];
}
