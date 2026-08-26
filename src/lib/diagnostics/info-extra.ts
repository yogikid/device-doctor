/**
 * Modul info tambahan — memperkaya dashboard dengan data yang masih bisa
 * dibaca browser secara jujur. Semua feature-detected.
 */
import { setEntry } from './store';

type Row = [string, string];

function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

/** Ukur refresh rate layar via dua frame berurutan (rata-rata 1 detik). */
export function measureRefreshRate(): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames++;
      if (performance.now() - start >= 1000) {
        resolve(Math.round((frames * 1000) / (performance.now() - start)));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Kemampuan layar & rendering. */
export async function collectDisplayExtra(): Promise<Row[]> {
  const rows: Row[] = [];
  const hz = await measureRefreshRate();
  rows.push(['Refresh rate (ukur)', `~${hz} Hz`]);

  if ('colorDepth' in screen) rows.push(['Color depth', `${screen.colorDepth}-bit`]);

  const hdr = matchMedia('(dynamic-range: high)').matches;
  rows.push(['Dynamic range', hdr ? 'High (HDR capable)' : 'Standard (SDR)']);

  const p3 = matchMedia('(color-gamut: p3)').matches;
  const srgb = matchMedia('(color-gamut: srgb)').matches;
  rows.push(['Color gamut', p3 ? 'Display-P3' : srgb ? 'sRGB' : 'Terbatas']);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  rows.push(['Reduced motion', reduce ? 'Aktif' : 'Nonaktif']);

  if ('availWidth' in screen) {
    rows.push(['Area tersedia', `${screen.availWidth} × ${screen.availHeight} px`]);
  }
  const vv = window.visualViewport;
  if (vv) rows.push(['Viewport', `${Math.round(vv.width)} × ${Math.round(vv.height)} px`]);

  rows.push(['Ukuran fisik (approx)', estimateInches(hz)]);
  return rows;
}

/** Estimasi kasar diagonal layar — jujur ditandai approx. */
function estimateInches(_hz: number): string {
  const dpr = window.devicePixelRatio || 1;
  const wPx = screen.width * dpr;
  const hPx = screen.height * dpr;
  // Asumsi ~400 ppi untuk ponsel modern (nilai tipikal); ini memang kasar.
  const ppi = 400;
  const diag = Math.sqrt(wPx ** 2 + hPx ** 2) / ppi;
  return `~${diag.toFixed(1)}" (perkiraan kasar)`;
}

/** Dukungan codec video/audio — relevan buat streaming. */
export function collectCodecs(): Row[] {
  const rows: Row[] = [];
  const v = document.createElement('video');
  const a = document.createElement('audio');
  const probe = (el: HTMLMediaElement, type: string) => {
    const r = el.canPlayType(type);
    return r === 'probably' ? '✓ Penuh' : r === 'maybe' ? '~ Mungkin' : '✕ Tidak';
  };
  rows.push(['H.264 (MP4)', probe(v, 'video/mp4; codecs="avc1.42E01E"')]);
  rows.push(['HEVC / H.265', probe(v, 'video/mp4; codecs="hvc1"')]);
  rows.push(['VP9 (WebM)', probe(v, 'video/webm; codecs="vp9"')]);
  rows.push(['AV1', probe(v, 'video/mp4; codecs="av01.0.05M.08"')]);
  rows.push(['AAC', probe(a, 'audio/mp4; codecs="mp4a.40.2"')]);
  rows.push(['Opus', probe(a, 'audio/ogg; codecs="opus"')]);
  const drm = 'requestMediaKeySystemAccess' in navigator;
  rows.push(['DRM (Widevine API)', drm ? '✓ Tersedia' : '✕ Tidak tersedia']);
  return rows;
}

/** Sensor & kapabilitas input yang API-nya bisa dicek. */
export function collectSensors(): Row[] {
  const rows: Row[] = [];
  const check = (label: string, ok: boolean, extra?: string) =>
    rows.push([label, ok ? `✓ Tersedia${extra ? ` ${extra}` : ''}` : '✕ Tidak ada di browser ini']);

  check('Accelerometer', 'Accelerometer' in window || 'DeviceMotionEvent' in window);
  check('Gyroscope', 'Gyroscope' in window || 'DeviceOrientationEvent' in window);
  check('Magnetometer', 'Magnetometer' in window);
  check('Ambient light', 'AmbientLightSensor' in window);
  check('Vibration', 'vibrate' in navigator);
  check('Bluetooth (Web BT)', 'bluetooth' in navigator);
  check('NFC (Web NFC)', 'NDEFReader' in window);
  check('USB (WebUSB)', 'usb' in navigator);
  check('Gamepad', 'getGamepads' in navigator);
  check('Touch', 'ontouchstart' in window, `(${navigator.maxTouchPoints ?? 0} titik)`);
  return rows;
}

/** Kamera & mikrofon yang terdaftar (label butuh izin, tetap jujur soal itu). */
export async function collectMediaDevices(): Promise<Row[]> {
  const rows: Row[] = [];
  if (!navigator.mediaDevices?.enumerateDevices) {
    rows.push(['Status', 'enumerateDevices tidak didukung browser ini']);
    return rows;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    const mics = devices.filter((d) => d.kind === 'audioinput');
    const outs = devices.filter((d) => d.kind === 'audiooutput');
    rows.push(['Kamera terdeteksi', `${cams.length} unit`]);
    rows.push(['Mikrofon terdeteksi', `${mics.length} unit`]);
    rows.push(['Output audio', `${outs.length} unit`]);
    const named = cams.filter((c) => c.label).length;
    if (cams.length && !named) {
      rows.push(['Catatan', 'Nama perangkat baru muncul setelah izin kamera diberikan']);
    } else {
      for (const c of cams.slice(0, 3)) if (c.label) rows.push(['· Kamera', c.label]);
    }
  } catch (err) {
    rows.push(['Error', `Gagal membaca daftar perangkat (${String(err)})`]);
  }
  return rows;
}

/** Kapabilitas platform web (PWA readiness, API modern). */
export function collectPlatformFeatures(): Row[] {
  const rows: Row[] = [];
  const std = window.matchMedia('(display-mode: standalone)').matches;
  rows.push(['Mode tampilan', std ? 'Standalone (terinstall)' : 'Tab browser']);
  rows.push(['Service Worker', 'serviceWorker' in navigator ? '✓ Aktif' : '✕ Tidak']);
  rows.push(['Web Share', 'share' in navigator ? '✓ Tersedia' : '✕ Tidak']);
  rows.push(['Clipboard API', 'clipboard' in navigator ? '✓ Tersedia' : '✕ Tidak']);
  rows.push(['Notification', 'Notification' in window ? '✓ Tersedia' : '✕ Tidak']);
  rows.push(['WebGL 2', hasWebGL2() ? '✓ Tersedia' : '✕ Tidak']);
  rows.push(['WebGPU', 'gpu' in navigator ? '✓ Tersedia' : '✕ Belum']);
  rows.push(['WebAssembly', typeof WebAssembly === 'object' ? '✓ Tersedia' : '✕ Tidak']);
  rows.push(['Cookie enabled', navigator.cookieEnabled ? '✓ Ya' : '✕ Tidak']);
  rows.push(['Secure context', window.isSecureContext ? '✓ HTTPS' : '✕ Tidak aman']);
  return rows;
}

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/** Memori JS heap (Chromium) — indikasi tekanan memori tab. */
export function collectMemory(): Row[] {
  const rows: Row[] = [];
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  const m = perf.memory;
  if (!m) {
    rows.push(['Status', 'performance.memory hanya tersedia di Chromium']);
    return rows;
  }
  rows.push(['Heap terpakai', fmtBytes(m.usedJSHeapSize)]);
  rows.push(['Heap dialokasikan', fmtBytes(m.totalJSHeapSize)]);
  rows.push(['Batas heap', fmtBytes(m.jsHeapSizeLimit)]);
  const pct = (m.usedJSHeapSize / m.jsHeapSizeLimit) * 100;
  rows.push(['Pemakaian', `${pct.toFixed(1)}% dari batas`]);
  setEntry('memory', {
    status: pct > 80 ? 'warn' : 'info',
    value: `${pct.toFixed(0)}% heap`,
  });
  return rows;
}

/** Waktu, zona, dan locale — konteks tambahan. */
export function collectLocale(): Row[] {
  const rows: Row[] = [];
  const dtf = Intl.DateTimeFormat().resolvedOptions();
  rows.push(['Zona waktu', dtf.timeZone]);
  rows.push(['Locale', dtf.locale]);
  rows.push(['Kalender', dtf.calendar ?? '—']);
  rows.push(['Bahasa browser', navigator.languages?.join(', ') ?? navigator.language]);
  rows.push(['Waktu device', new Date().toLocaleString('id-ID')]);
  const off = -new Date().getTimezoneOffset() / 60;
  rows.push(['Offset UTC', `${off >= 0 ? '+' : ''}${off} jam`]);
  return rows;
}
