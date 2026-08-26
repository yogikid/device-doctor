/**
 * Uji fungsional recommendation engine — jalankan langsung hasil bundle.
 * Skenario wajib sesuai spec:
 *  1. Semua pass → SEHAT
 *  2. Ada test hardware gagal → PERIKSA LEBIH LANJUT
 *  3. Storage >90% kuota → PERLU PERHATIAN
 *  4. Banyak API unsupported → dikelompokkan sebagai keterbatasan browser,
 *     BUKAN dihitung device bermasalah
 */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, v),
  removeItem: (k) => mem.delete(k),
};
Object.defineProperty(globalThis, 'navigator', {
  value: {
    userAgent:
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
    language: 'id-ID',
  },
  configurable: true,
});

const { resetSession, setEntry, buildVerdict } = await import('./engine-harness/bundle.js');

let failures = 0;
function expect(name, cond, extra = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✕ ${name} ${extra}`);
  }
}

function scenario(title, fn) {
  console.log(`\n■ ${title}`);
  resetSession();
  fn();
}

scenario('1) Semua test lolos → stempel SEHAT', () => {
  for (const id of ['touch', 'display', 'speaker', 'mic', 'camera', 'motion', 'benchmark', 'gps']) {
    setEntry(id, { status: 'pass', note: 'ok' });
  }
  setEntry('vibrate', { status: 'unsupported', note: 'browser tak dukung' });
  setEntry('storage', { status: 'info', value: '10 MB / 30 GB (0%)' });
  const v = buildVerdict();
  console.log(`  stamp: "${v.stamp}"`);
  expect('stempel = SEHAT', v.stamp === 'SEHAT', `got ${v.stamp}`);
  expect('tanpa item kritikal', !v.items.some((i) => i.kind === 'critical'));
});

scenario('2) Touch screen dead zone → PERIKSA LEBIH LANJUT', () => {
  setEntry('touch', { status: 'fail', note: 'ada kotak tidak respons' });
  for (const id of ['display', 'mic']) setEntry(id, { status: 'pass' });
  const v = buildVerdict();
  console.log(`  stamp: "${v.stamp}"`);
  expect('stempel = PERIKSA LEBIH LANJUT', v.stamp === 'PERIKSA LEBIH LANJUT', `got ${v.stamp}`);
  expect('ada rekomendasi kritikal tentang sentuh', v.items.some((i) => i.kind === 'critical' && /sentuh|Area/i.test(i.title)));
});

scenario('3) Storage origin >90% → PERLU PERHATIAN', () => {
  setEntry('storage', { status: 'warn', value: '28 GB / 30 GB (93%)', note: 'hampir penuh' });
  setEntry('benchmark', { status: 'fail', value: '18 fps' });
  const v = buildVerdict();
  console.log(`  stamp: "${v.stamp}"`);
  expect('stempel = PERLU PERHATIAN', v.stamp === 'PERLU PERHATIAN', `got ${v.stamp}`);
});

scenario('4) Safari-style: banyak API unsupported → bukan device bermasalah', () => {
  setEntry('battery', { status: 'unsupported' });
  setEntry('connection', { status: 'unsupported' });
  setEntry('gpu', { status: 'unsupported' });
  setEntry('vibrate', { status: 'unsupported' });
  setEntry('motion', { status: 'unsupported' });
  setEntry('display', { status: 'pass' });
  setEntry('mic', { status: 'pass' });
  const v = buildVerdict();
  console.log(`  stamp: "${v.stamp}"`);
  expect(
    'tetap SEHAT (keterbatasan browser ≠ kerusakan HP)',
    v.stamp === 'SEHAT',
    `got ${v.stamp}`,
  );
  expect(
    'ada catatan keterbatasan browser yang jujur',
    v.items.some((i) => /terbatas/.test(i.title)),
  );
});

scenario('5) Koneksi 2g → info "bukan masalah HP"', () => {
  setEntry('connection', { status: 'warn', note: 'Koneksi lambat terdeteksi — kemungkinan besar bukan masalah HP.' });
  setEntry('touch', { status: 'pass' });
  const v = buildVerdict();
  expect(
    'ada saran pindah WiFi',
    v.items.some((i) => /WiFi/.test(i.body)),
  );
  expect('stempel tetap SEHAT', v.stamp === 'SEHAT', `got ${v.stamp}`);
});

console.log(failures === 0 ? '\n★ SEMUA SKENARIO LOLOS ★' : `\n✕ ${failures} skenario GAGAL`);
process.exit(failures === 0 ? 0 : 1);
