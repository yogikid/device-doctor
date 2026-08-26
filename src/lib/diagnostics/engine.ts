/**
 * Recommendation engine — rule-based (IF-THEN), BUKAN AI/ML.
 * Semua output dibingkai sebagai INDIKASI/SARAN, bukan diagnosis pasti.
 * API tidak didukung ≠ device bermasalah — masuk kategori catatan browser.
 */
import { getSession } from './store';
import { TEST_IDS } from './types';
import type { Entry, Recommendation, Verdict } from './types';
import { browserName } from '../dom';

interface RuleResult {
  critical?: Recommendation;
  attention?: Recommendation;
  infos: Recommendation[];
}

export function buildVerdict(): Verdict {
  const s = getSession();
  const e = s.entries;

  // ---- Hitung test manual/otomatis ----
  // Kegagalan HARDWARE (sentuh/layar/speaker/mic/kamera/getar/sensor) → kritikal.
  // Benchmark FPS & presisi GPS itu indikator kondisi (thermal/env), bukan kerusakan —
  // masuk jalur "perlu perhatian", sesuai framing spesifikasi.
  const HW_TESTS = ['touch', 'display', 'speaker', 'mic', 'camera', 'vibrate', 'motion'] as const;
  const failedTests = HW_TESTS.filter((id) => e[id]?.status === 'fail');
  const deniedCount = TEST_IDS.filter((id) => e[id]?.status === 'denied').length;
  const warnTests = TEST_IDS.filter((id) => e[id]?.status === 'warn');

  const res: RuleResult = { infos: [] };

  // --- Aturan: hasil test ---
  const failLabels: Record<string, string> = {
    touch: 'Area sentuh mati',
    display: 'Dead pixel / anomali layar',
    speaker: 'Speaker bermasalah',
    mic: 'Mikrofon tidak menangkap suara',
    camera: 'Kamera bermasalah',
    vibrate: 'Getar tidak terasa',
    motion: 'Sensor gerak tidak respons',
    gps: 'Presisi GPS rendah',
  };
  for (const t of failedTests) {
    res.critical = {
      kind: 'critical',
      title: failLabels[t] ?? 'Ada test gagal',
      body: 'Hasil ini indikasi dari pengamatan di sesi ini. Kalau berulang, pertimbangkan cek ke teknisi atau klaim garansi.',
    };
    break; // satu ringkasan kritikal cukup, detailnya per item di bawah
  }

  // --- Aturan: storage >90% kuota origin ---
  if (ratio(e.storage) > 0.9) {
    res.attention ??= {
      kind: 'attention',
      title: 'Penyimpanan origin hampir penuh',
      body: 'Hapus cache atau file situs yang nggak kepake lewat pengaturan browser.',
    };
  }

  // --- Aturan: FPS rendah ---
  if (e.benchmark?.status === 'fail') {
    res.attention ??= {
      kind: 'attention',
      title: 'Performa terasa lambat saat benchmark',
      body: 'Tutup tab/app lain atau restart HP. Kalau HP kerasa panas, bisa indikasi thermal throttling.',
    };
  }

  // --- Aturan: presisi GPS rendah (kondisi lingkungan, bukan rusak) ---
  if (e.gps?.status === 'fail') {
    res.infos.push({
      kind: 'info',
      title: 'Presisi GPS rendah saat test',
      body: 'Coba ulangi di area terbuka — di dalam ruangan angka accuracy memang sering buruk.',
    });
  }

  // --- Aturan: koneksi 2g/slow-2g ---
  if (e.connection?.note?.includes('Koneksi lambat')) {
    res.infos.push({
      kind: 'info',
      title: 'Koneksi lambat terdeteksi',
      body: 'Kemungkinan besar bukan masalah HP — cek sinyal atau pindah ke WiFi.',
    });
  }

  // --- Aturan: izin ditolak ---
  if (deniedCount > 0) {
    res.infos.push({
      kind: 'info',
      title: `${deniedCount} izin ditolak`,
      body: 'Test yang butuh izin (mic/kamera/lokasi) nggak bisa dinilai. Beri izin lewat ikon gembok di address bar lalu ulangi kalau mau lengkap.',
    });
  }

  // --- Catatan netral dari info dashboard ---
  for (const id of ['battery', 'storage', 'device', 'gpu'] as const) {
    const en = e[id];
    if (!en) continue;
    if (en.status === 'unsupported') continue; // dikelompokkan terpisah di bawah
    if (en.note && en.status === 'warn') {
      res.attention ??= {
        kind: 'attention',
        title: 'Perlu diperhatikan',
        body: en.note,
      };
    }
  }

  // --- Aturan: browser dengan banyak keterbatasan (Safari/Firefox dsb.) ---
  const unsupportedInfo = (['battery', 'connection', 'gpu'] as const).filter(
    (id) => e[id]?.status === 'unsupported',
  );
  const unsupportedTests = TEST_IDS.filter((id) => e[id]?.status === 'unsupported');
  if (unsupportedInfo.length + unsupportedTests.length >= 2) {
    res.infos.push({
      kind: 'info',
      title: `Banyak fitur terbatas di ${browserName()}`,
      body: 'Bukan kerusakan HP — beberapa API cuma tersedia di Chromium. Buat hasil paling lengkap, buka Device Doctor pakai Chrome/Edge di Android.',
    });
  }

  // --- Peringatan test (warn) jadi info ---
  for (const t of warnTests) {
    const note = e[t]?.note;
    if (note) {
      res.infos.push({ kind: 'info', title: 'Catatan hasil test', body: note });
    }
  }

  // ---- Agregasi jadi stempel ----
  const stampKind = res.critical ? 'critical' : res.attention ? 'attention' : 'healthy';
  const items: Recommendation[] = [];
  if (res.critical) items.push(res.critical);
  if (res.attention) items.push(res.attention);
  items.push(...res.infos);

  const testedCount = TEST_IDS.filter((id) => {
    const st = e[id]?.status;
    return st !== undefined && st !== 'pending' && st !== 'unsupported';
  }).length;

  let sub: string;
  if (stampKind === 'healthy') {
    sub =
      testedCount === 0
        ? 'Belum ada test yang dijalankan — mampir ke tab Periksa dulu ya.'
        : `${testedCount} test lolos tanpa temuan. Ini kesimpulan indikatif, bukan jaminan semua hardware mulus.`;
  } else if (stampKind === 'attention') {
    sub = 'Ada beberapa hal yang layak kamu rapikan — lihat sarannya di bawah.';
  } else {
    sub = 'Ada indikasi masalah hardware. Cek detailnya dan konfirmasi ulang sebelum ambil keputusan (jual/beli/service).';
  }

  const stamp: Verdict['stamp'] =
    stampKind === 'critical' ? 'PERIKSA LEBIH LANJUT' : stampKind === 'attention' ? 'PERLU PERHATIAN' : 'SEHAT';

  return { stamp, kind: stampKind, sub, items };
}

function ratio(en?: Entry): number {
  if (!en?.value) return 0;
  const m = en.value.match(/\((\d+)%\)/);
  return m ? parseInt(m[1], 10) / 100 : 0;
}
