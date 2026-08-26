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

/** Detail IP & ISP dari Cloudflare Edge API */
export async function collectIpDetails(): Promise<Row[]> {
  const rows: Row[] = [];
  try {
    const res = await fetch('/api/ip');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    rows.push(['Alamat IP Publik', data.ip || '—']);
    rows.push(['ISP / Operator', data.isp || data.asOrganization || '—']);
    rows.push(['Autonomous System', data.asn || '—']);
    rows.push(['Kota / Wilayah', `${data.city || '—'}, ${data.region || '—'}`]);
    rows.push(['Negara / Datacenter', `${data.country || '—'} (Colo: ${data.colo || '—'})`]);
    rows.push(['Protokol Jaringan', `${data.httpProtocol || 'HTTP/2'} (${data.tlsVersion || 'TLS 1.3'})`]);
    
    setEntry('ip_network', {
      status: 'info',
      value: `${data.ip} · ${data.isp}`,
      note: `ISP: ${data.isp} (${data.asn}), Lokasi Edge: ${data.city}, ${data.country}`,
    });
  } catch (err) {
    rows.push(['Status IP/ISP', 'Gagal memuat detail jaringan edge']);
  }
  return rows;
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
  rows.push(['Refresh Rate Live', `~${hz} Hz`]);

  if ('colorDepth' in screen) rows.push(['Kedalaman Warna', `${screen.colorDepth}-bit (${2 ** (screen.colorDepth || 24)} warna)`]);

  const hdr = matchMedia('(dynamic-range: high)').matches;
  rows.push(['Dynamic Range (HDR)', hdr ? '✓ Mendukung High Dynamic Range (HDR)' : 'Standar (SDR)']);

  const p3 = matchMedia('(color-gamut: p3)').matches;
  const srgb = matchMedia('(color-gamut: srgb)').matches;
  rows.push(['Color Gamut Spektrum', p3 ? '✓ Wide Color Gamut (Display-P3)' : srgb ? 'Standar sRGB' : 'Terbatas']);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  rows.push(['Mode Reduced Motion', reduce ? 'Aktif (Animasi Diminimalkan)' : 'Nonaktif']);

  if ('availWidth' in screen) {
    rows.push(['Area Layar Efektif', `${screen.availWidth} × ${screen.availHeight} px`]);
  }
  const vv = window.visualViewport;
  if (vv) rows.push(['Visual Viewport', `${Math.round(vv.width)} × ${Math.round(vv.height)} px`]);

  rows.push(['Estimasi Diagonal Fisik', estimateInches(hz)]);
  return rows;
}

function estimateInches(_hz: number): string {
  const dpr = window.devicePixelRatio || 1;
  const wPx = screen.width * dpr;
  const hPx = screen.height * dpr;
  const ppi = 400; // Standar ponsel modern (~395-405 ppi pada POCO/Redmi/Samsung)
  const diag = Math.sqrt(wPx ** 2 + hPx ** 2) / ppi;
  return `~${diag.toFixed(1)} Inci (estimasi ppi ${ppi})`;
}

/** Dukungan codec video/audio — relevan buat streaming. */
export function collectCodecs(): Row[] {
  const rows: Row[] = [];
  const v = document.createElement('video');
  const a = document.createElement('audio');
  const probe = (el: HTMLMediaElement, type: string) => {
    const r = el.canPlayType(type);
    return r === 'probably' ? '✓ Hardware Didukung' : r === 'maybe' ? '~ Parsial' : '✕ Tidak Didukung';
  };
  rows.push(['H.264 / AVC (MP4)', probe(v, 'video/mp4; codecs="avc1.42E01E"')]);
  rows.push(['HEVC / H.265 (4K/8K)', probe(v, 'video/mp4; codecs="hvc1"')]);
  rows.push(['VP9 (YouTube 4K)', probe(v, 'video/webm; codecs="vp9"')]);
  rows.push(['AV1 (Next-Gen Codec)', probe(v, 'video/mp4; codecs="av01.0.05M.08"')]);
  rows.push(['AAC Audio (Stereo)', probe(a, 'audio/mp4; codecs="mp4a.40.2"')]);
  rows.push(['Opus Audio (Lossless/VoIP)', probe(a, 'audio/ogg; codecs="opus"')]);
  const drm = 'requestMediaKeySystemAccess' in navigator;
  rows.push(['DRM Digital (Widevine API)', drm ? '✓ Tersedia (Netflix/Prime Video)' : '✕ Tidak tersedia']);
  return rows;
}

/** Sensor & kapabilitas input yang API-nya bisa dicek. */
export function collectSensors(): Row[] {
  const rows: Row[] = [];
  const check = (label: string, ok: boolean, extra?: string) =>
    rows.push([label, ok ? `✓ Tersedia${extra ? ` ${extra}` : ''}` : '✕ Tidak ada di browser']);

  check('Sensor Akselerometer (G-Force)', 'Accelerometer' in window || 'DeviceMotionEvent' in window);
  check('Sensor Giroskop (Orientasi 3D)', 'Gyroscope' in window || 'DeviceOrientationEvent' in window);
  check('Sensor Magnetometer (Kompas)', 'Magnetometer' in window);
  check('Sensor Cahaya Ambient (ALS)', 'AmbientLightSensor' in window);
  check('Motor Getar (Haptic API)', 'vibrate' in navigator);
  check('Bluetooth Nirkabel (Web Bluetooth)', 'bluetooth' in navigator);
  check('Sensor NFC (Web NFC / NDEF)', 'NDEFReader' in window);
  check('Koneksi USB OTG (WebUSB)', 'usb' in navigator);
  check('Port Serial / Arduino (WebSerial)', 'serial' in navigator);
  check('Gamepad / Stik Konsol', 'getGamepads' in navigator);
  check('Layar Sentuh Multitouch', 'ontouchstart' in window, `(${navigator.maxTouchPoints ?? 0} titik sentuh)`);
  return rows;
}

/** Kamera & mikrofon fisik. */
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
    rows.push(['Sensor Kamera Fisik', `${cams.length} Modul Terdeteksi`]);
    rows.push(['Mikrofon Input Fisik', `${mics.length} Modul Terdeteksi`]);
    rows.push(['Kanal Output Speaker', `${outs.length} Kanal Output`]);
    const named = cams.filter((c) => c.label).length;
    if (cams.length && !named) {
      rows.push(['Keterangan Label', 'Nama optik spesifik di-masking browser sampai izin diberikan']);
    } else {
      for (const c of cams.slice(0, 3)) if (c.label) rows.push(['· Lensa Teridentifikasi', c.label]);
    }
  } catch (err) {
    rows.push(['Error', `Gagal membaca perangkat media (${String(err)})`]);
  }
  return rows;
}

/** Kapabilitas Web APIs & Keamanan Modern */
export function collectPlatformFeatures(): Row[] {
  const rows: Row[] = [];
  const std = window.matchMedia('(display-mode: standalone)').matches;
  rows.push(['Mode Instalasi PWA', std ? '✓ Standalone (Aplikasi Terpasang)' : 'Tab Browser']);
  rows.push(['Service Worker Offline', 'serviceWorker' in navigator ? '✓ Aktif & Siap Offline' : '✕ Tidak']);
  rows.push(['Web Share API (Native Share)', 'share' in navigator ? '✓ Tersedia' : '✕ Tidak']);
  rows.push(['Async Clipboard API', 'clipboard' in navigator ? '✓ Tersedia' : '✕ Tidak']);
  rows.push(['Web Notifications Push', 'Notification' in window ? '✓ Didukung' : '✕ Tidak']);
  rows.push(['Akselerasi WebGL 2.0', hasWebGL2() ? '✓ Aktif' : '✕ Tidak']);
  rows.push(['Next-Gen WebGPU', 'gpu' in navigator ? '✓ Didukung Browser' : '✕ Belum diaktifkan']);
  rows.push(['WebAssembly (WASM)', typeof WebAssembly === 'object' ? '✓ Didukung Penuh' : '✕ Tidak']);
  rows.push(['Biometrik / WebAuthn FIDO2', window.PublicKeyCredential ? '✓ Mendukung Fingerprint/Passkey' : '✕ Tidak']);
  rows.push(['Konteks Keamanan (HTTPS)', window.isSecureContext ? '✓ Secure Context Terverifikasi' : '✕ Tidak aman']);
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

/** Memori JS Heap Engine */
export function collectMemory(): Row[] {
  const rows: Row[] = [];
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  const m = perf.memory;
  if (!m) {
    rows.push(['Status', 'performance.memory hanya di-expose pada engine V8 (Chromium)']);
    return rows;
  }
  rows.push(['Alokasi Heap Aktif', fmtBytes(m.usedJSHeapSize)]);
  rows.push(['Total Heap Engine', fmtBytes(m.totalJSHeapSize)]);
  rows.push(['Batas Maksimum Heap Tab', fmtBytes(m.jsHeapSizeLimit)]);
  const pct = (m.usedJSHeapSize / m.jsHeapSizeLimit) * 100;
  rows.push(['Rasio Tekanan Memori', `${pct.toFixed(1)}% dari batas aman`]);
  setEntry('memory', {
    status: pct > 80 ? 'warn' : 'info',
    value: `${pct.toFixed(0)}% heap (${fmtBytes(m.usedJSHeapSize)})`,
  });
  return rows;
}

/** Waktu, Zona Waktu & Format Regional */
export function collectLocale(): Row[] {
  const rows: Row[] = [];
  const dtf = Intl.DateTimeFormat().resolvedOptions();
  rows.push(['Zona Waktu Sistem', dtf.timeZone]);
  rows.push(['Locale Bahasa Utama', dtf.locale]);
  rows.push(['Sistem Kalender', dtf.calendar ?? 'gregory']);
  rows.push(['Daftar Bahasa Pilihan', navigator.languages?.join(', ') ?? navigator.language]);
  rows.push(['Waktu Jam Lokal HP', new Date().toLocaleString('id-ID')]);
  const off = -new Date().getTimezoneOffset() / 60;
  rows.push(['Selisih Waktu UTC', `${off >= 0 ? '+' : ''}${off} Jam (WIB = +7)`]);
  return rows;
}
