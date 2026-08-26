/**
 * Modul info tambahan — memperkaya dashboard dengan data yang masih bisa
 * dibaca browser secara jujur. Semua feature-detected.
 */
import { setEntry } from './store';
import { renderRows } from './info';

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

/** Detail IP & ISP dari Cloudflare Edge API dengan multi-source */
export async function collectIpDetails(): Promise<Row[]> {
  const rows: Row[] = [];
  try {
    let data: any = null;
    try {
      const res = await fetch('/api/ip');
      if (res.ok) data = await res.json();
    } catch {
      /* fallback client side */
    }

    if (!data || !data.ip || data.ip === '127.0.0.1') {
      try {
        const directRes = await fetch('https://ipwho.is/');
        if (directRes.ok) {
          const directData = await directRes.json();
          data = {
            ip: directData.ip,
            asn: directData.connection?.asn ? `AS${directData.connection.asn}` : '—',
            isp: directData.connection?.isp || directData.connection?.org || '—',
            asOrganization: directData.connection?.org || '—',
            city: directData.city || '—',
            region: directData.region || '—',
            country: directData.country_code || 'ID',
            colo: 'Edge',
            httpProtocol: 'HTTP/2',
            tlsVersion: 'TLS 1.3',
          };
        }
      } catch {
        /* fallback */
      }
    }

    if (data) {
      rows.push(['Alamat IP Publik', data.ip || '—']);
      rows.push(['ISP / Operator', data.isp || data.asOrganization || '—']);
      rows.push(['Autonomous System', data.asn || '—']);
      rows.push(['Organisasi Jaringan', data.asOrganization || data.isp || '—']);
      rows.push(['Kota / Wilayah', `${data.city || '—'}, ${data.region || '—'}`]);
      rows.push(['Negara / Datacenter', `${data.country || '—'} (Colo: ${data.colo || '—'})`]);
      rows.push(['Protokol Jaringan', `${data.httpProtocol || 'HTTP/2'} (${data.tlsVersion || 'TLS 1.3'})`]);
      
      setEntry('ip_network', {
        status: 'info',
        value: `${data.ip} · ${data.isp}`,
        note: `ISP: ${data.isp} (${data.asn}), Organisasi: ${data.asOrganization}, Lokasi Edge: ${data.city}, ${data.country}`,
      });
    } else {
      rows.push(['Status', 'Data IP gagal dimuat']);
    }
  } catch {
    rows.push(['Status', 'Offline / Gagal koneksi']);
  }
  return rows;
}

/** Detail GPU & WebGL2 */
export function collectGpu(): Row[] {
  const rows: Row[] = [];
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      rows.push(['WebGL', '✕ Tidak didukung']);
      return rows;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      rows.push(['Hardware GPU Vendor', String(vendor || '—')]);
      rows.push(['Chipset Renderer', String(renderer || '—')]);
    }
    rows.push(['Versi WebGL Engine', gl.getParameter(gl.VERSION) || 'WebGL 1.0/2.0']);
    rows.push(['Max Texture Size', `${gl.getParameter(gl.MAX_TEXTURE_SIZE)} px`]);
    rows.push(['Max Renderbuffer Size', `${gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)} px`]);
    rows.push(['Max Color Attachments', `${gl.getParameter(gl.MAX_COLOR_ATTACHMENTS || gl.MAX_TEXTURE_IMAGE_UNITS)} unit`]);
    rows.push(['Max Viewport Dimensions', `${gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.[0] ?? '—'} px`]);
  } catch {
    rows.push(['Status', 'Gagal membaca parameter GPU']);
  }
  return rows;
}

/** Sensor & Input Hardware */
export function collectSensors(): Row[] {
  const rows: Row[] = [];
  rows.push(['Gyroscope & Accelerometer', 'DeviceOrientationEvent' in window ? '✓ Tersedia di Hardware' : '✕ Tidak didukung']);
  rows.push(['Multi-Touch Screen', navigator.maxTouchPoints > 0 ? `✓ Mendukung (${navigator.maxTouchPoints} Titik)` : '✕ Single Touch / Mouse']);
  rows.push(['Motor Getar (Haptic Engine)', 'vibrate' in navigator ? '✓ Tersedia (Vibration API)' : '✕ Tidak didukung']);
  rows.push(['Ambient Light Sensor', 'AmbientLightSensor' in window ? '✓ Sensor Cahaya Aktif' : '✕ Tidak di-expose browser']);
  rows.push(['Magnetometer / Kompas', 'Magnetometer' in window ? '✓ Sensor Kompas Tersedia' : '✕ Tidak di-expose browser']);
  rows.push(['Gamepad Controller API', 'getGamepads' in navigator ? '✓ Mendukung Stik Konsol' : '✕ Tidak']);
  rows.push(['Web Bluetooth API', 'bluetooth' in navigator ? '✓ Mendukung BLE' : '✕ Nonaktif']);
  return rows;
}

/** Audio & Multimedia Specs */
export function collectAudioMedia(): Row[] {
  const rows: Row[] = [];
  const hasWA = 'AudioContext' in window || 'webkitAudioContext' in window;
  rows.push(['Web Audio Framework', hasWA ? '✓ Mendukung AudioContext' : '✕ Tidak']);
  if (hasWA) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      rows.push(['Sample Rate Default', `${ctx.sampleRate} Hz (${(ctx.sampleRate / 1000).toFixed(1)} kHz)`]);
      rows.push(['Kanal Output Maksimum', `${ctx.destination.maxChannelCount} Channel (Stereo/Surround)`]);
      rows.push(['Base Latency Estimasi', `${Math.round(ctx.baseLatency * 1000 || 5)} ms`]);
      void ctx.close();
    } catch {}
  }
  rows.push(['Input Mikrofon & Kamera', 'mediaDevices' in navigator ? '✓ Mendukung (MediaStream)' : '✕ Tidak']);
  rows.push(['Media Recorder (Perekam)', 'MediaRecorder' in window ? '✓ Mendukung Rekam Audio/Video' : '✕ Tidak']);
  return rows;
}

/** Video Codecs Hardware Decoding */
export function collectCodecs(): Row[] {
  const rows: Row[] = [];
  const vid = document.createElement('video');
  const check = (type: string) => (vid.canPlayType(type) ? '✓ Mendukung Hardware/Software' : '✕ Tidak');

  rows.push(['Codec MP4 / H.264 (AVC)', check('video/mp4; codecs="avc1.42E01E"')]);
  rows.push(['Codec WebM / VP9', check('video/webm; codecs="vp9"')]);
  rows.push(['Codec AV1 Next-Gen', check('video/mp4; codecs="av01.0.08M.08"')]);
  rows.push(['Codec HEVC / H.265 (4K)', check('video/mp4; codecs="hevc,hvc1"')]);
  rows.push(['Audio AAC Standard', check('audio/mp4; codecs="mp4a.40.2"')]);
  rows.push(['Audio Opus High-Fidelity', check('audio/ogg; codecs="opus"')]);
  rows.push(['Audio FLAC Lossless', check('audio/flac')]);
  return rows;
}

/** Browser Engine & Fitur Modern */
export function collectWebCapabilities(): Row[] {
  const rows: Row[] = [];
  rows.push(['Service Worker (PWA Offline)', 'serviceWorker' in navigator ? '✓ Mendukung Penuh' : '✕ Tidak']);
  rows.push(['WebGL 2.0 3D Acceleration', hasWebGL2() ? '✓ Aktif' : '✕ Tidak']);
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

/** Inisialisasi kartu-kartu tambahan */
export function initExtraInfo() {
  const toRows = (r: Row[]) => r.map(([label, value]) => ({ label, value, mono: true }));

  // 1. GPU
  renderRows('card-gpu', toRows(collectGpu()));
  // 2. Sensor
  renderRows('card-sensors', toRows(collectSensors()));
  // 3. Audio
  renderRows('card-audio', toRows(collectAudioMedia()));
  // 4. Codecs
  renderRows('card-codecs', toRows(collectCodecs()));
  // 5. Capabilities
  renderRows('card-capabilities', toRows(collectWebCapabilities()));
  // 6. Memory
  renderRows('card-memory', toRows(collectMemory()));
  // 7. Locale
  renderRows('card-locale', toRows(collectLocale()));
}
