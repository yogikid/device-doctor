/**
 * Device info dashboard — 14 kategori data via Web API + Cloudflare Edge IP Network.
 */
import { $, setText, setHidden, fmtBytes, fmtPct, esc } from '../dom';
import { setEntry } from './store';
import type { Status } from './types';
import {
  collectIpDetails,
  collectDisplayExtra,
  collectCodecs,
  collectSensors,
  collectMediaDevices,
  collectPlatformFeatures,
  collectMemory,
  collectLocale,
} from './info-extra';

interface FieldRow {
  label: string;
  value: string;
  mono?: boolean;
}

function renderRows(containerId: string, rows: FieldRow[]) {
  const box = $(`#${containerId} [data-body]`);
  if (!box) return;
  box.innerHTML = rows
    .map(
      (r) => `<div class="dd-row">
        <dt>${esc(r.label)}</dt>
        <dd class="${r.mono === false ? 'font-sans' : 'font-data'}">${esc(r.value)}</dd>
      </div>`,
    )
    .join('');
}

function deactivate(id: string, reason: string) {
  const card = $(`#card-${id}`);
  const body = $(`#card-${id} [data-body]`);
  const note = $(`#card-${id} [data-note]`);
  if (card instanceof HTMLElement) {
    card.dataset.unsupported = 'true';
    card.dataset.accent = 'neutral';
  }
  setHidden(body, true);
  setText(note, reason);
  setEntry(id, { status: 'unsupported', note: reason });
}

function activate(id: string, accent: 'healthy' | 'attention' | 'critical' | 'neutral' = 'neutral') {
  const card = $(`#card-${id}`);
  const body = $(`#card-${id} [data-body]`);
  if (card instanceof HTMLElement) {
    card.dataset.unsupported = 'false';
    card.dataset.accent = accent;
  }
  setHidden(body, false);
}

/* ---------- 1. Detail IP Publik & Operator ISP ---------- */
async function initIpNetwork() {
  try {
    const rows = await collectIpDetails();
    activate('ipnet', 'healthy');
    renderRows('card-ipnet', rows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('ipnet', 'Gagal memuat detail jaringan IP dari Edge.');
  }
}

/* ---------- 2. Baterai ---------- */
interface BatteryLike extends EventTarget {
  level: number;
  charging: boolean;
}

async function initBattery() {
  if (!('getBattery' in navigator)) {
    deactivate('battery', 'API Baterai tidak didukung di browser ini (hanya Chromium Android/Desktop).');
    return;
  }
  try {
    const bat = await (navigator as Navigator & { getBattery(): Promise<BatteryLike> }).getBattery();
    activate('battery', 'healthy');
    const paint = () => {
      const level = Math.round(bat.level * 100);
      renderRows('card-battery', [
        { label: 'Level Daya Saat Ini', value: `${level}%`, mono: true },
        { label: 'Status Pengisian', value: bat.charging ? 'Sedang di-cas ⚡' : 'Memakai Baterai (Discharging)', mono: false },
      ]);
      setEntry('battery', {
        status: 'info',
        value: `${level}%${bat.charging ? ' (cas)' : ''}`,
        note: 'Persentase daya saat ini — browser tidak bisa membaca battery health fisik (wear level) demi privasi.',
      });
    };
    paint();
    bat.addEventListener('levelchange', paint);
    bat.addEventListener('chargingchange', paint);
  } catch {
    deactivate('battery', 'Data baterai gagal dibaca oleh browser.');
  }
}

/* ---------- 3. Sinyal & Network Info ---------- */
function initConnection() {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  };
  const conn = nav.connection;
  if (!conn) {
    deactivate('connection', 'Network Information API tidak didukung di browser ini. Status online/offline tetap dicek.');
    setEntry('connection', { status: 'unsupported', note: 'Detail koneksi (4g/rtt) tidak tersedia di browser ini.' });
    updateOnlineBadge();
    return;
  }
  activate('connection', 'healthy');
  const paint = () => {
    const online = navigator.onLine;
    renderRows('card-connection', [
      { label: 'Status Jaringan', value: online ? 'Online Terhubung' : 'Offline Terputus', mono: false },
      { label: 'Tipe Koneksi (Est)', value: conn.effectiveType?.toUpperCase() ?? '—', mono: true },
      { label: 'Estimasi Downlink', value: conn.downlink != null ? `≈ ${conn.downlink} Mbps` : '—', mono: true },
      { label: 'Round Trip Time (RTT)', value: conn.rtt != null ? `≈ ${conn.rtt} ms` : '—', mono: true },
      { label: 'Mode Hemat Data', value: conn.saveData ? 'Aktif' : 'Nonaktif', mono: false },
    ]);
    let st: Status = 'info';
    let note: string | undefined;
    if (!online) {
      st = 'warn';
      note = 'Perangkat sedang offline.';
    } else if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
      st = 'warn';
      note = 'Koneksi lambat terdeteksi — kemungkinan sinyal provider lemah.';
    }
    setEntry('connection', {
      status: st,
      value: `${online ? 'online' : 'offline'}${conn.effectiveType ? ` · ${conn.effectiveType}` : ''}`,
      note,
    });
  };
  paint();
  window.addEventListener('online', paint);
  window.addEventListener('offline', paint);
  (conn as unknown as EventTarget).addEventListener?.('change', paint);
}

function updateOnlineBadge() {
  const el = $('#net-status');
  if (el) {
    el.textContent = navigator.onLine ? '● Online' : '○ Offline';
    el.className = `dd-btn px-2.5 py-1 font-data text-xs ${navigator.onLine ? 'bg-healthy font-bold' : 'bg-critical text-white font-bold'}`;
  }
}
window.addEventListener('online', updateOnlineBadge);
window.addEventListener('offline', updateOnlineBadge);

/* ---------- 4. Perangkat & CPU ---------- */
function initDevice() {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string; brands?: { brand: string; version: string }[] };
    deviceMemory?: number;
  };
  activate('device', 'neutral');
  const uaBrands = nav.userAgentData?.brands?.map((b) => b.brand).filter((b) => !/Not.A.Brand/i.test(b)) ?? [];
  renderRows('card-device', [
    { label: 'Platform Sistem', value: nav.userAgentData?.platform ?? (nav.platform || '—'), mono: true },
    { label: 'Browser Engine', value: uaBrands.length > 0 ? uaBrands.join(', ') : 'Chromium / WebKit', mono: false },
    { label: 'Jumlah CPU Core', value: nav.hardwareConcurrency != null ? `${nav.hardwareConcurrency} Core Processing Threads` : '—', mono: true },
    { label: 'RAM Perangkat (Est)', value: nav.deviceMemory != null ? `≥ ${nav.deviceMemory} GB RAM` : 'Tidak di-expose', mono: true },
    { label: 'Maks Multi-Touch Point', value: `${navigator.maxTouchPoints ?? 0} Titik Sentuh`, mono: true },
    { label: 'Bahasa Sistem', value: navigator.language, mono: true },
  ]);
  setEntry('device', {
    status: 'info',
    value: `${nav.hardwareConcurrency ?? '?'} core · ${nav.deviceMemory ?? '?'}GB RAM`,
    note: 'RAM dan core CPU adalah estimasi kapabilitas Web API.',
  });
  const uaEl = $('[data-ua]');
  if (uaEl) uaEl.textContent = navigator.userAgent;
}

/* ---------- 5. Layar & Resolusi ---------- */
function initScreen() {
  activate('screen', 'neutral');
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const orientation =
    screen.orientation?.type?.replace('-primary', '').replace('-', ' ') ??
    (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  renderRows('card-screen', [
    { label: 'Resolusi Layar Fisik', value: `${screen.width * window.devicePixelRatio} × ${screen.height * window.devicePixelRatio} px (Aktual)`, mono: true },
    { label: 'Viewport CSS', value: `${screen.width} × ${screen.height} px`, mono: true },
    { label: 'Pixel Density (DPR)', value: `${window.devicePixelRatio}× Multiplier`, mono: true },
    { label: 'Orientasi Layar', value: orientation.toUpperCase(), mono: false },
    { label: 'Tema Sistem OS', value: dark ? 'Dark Mode Aktif' : 'Light Mode', mono: false },
  ]);
  setEntry('screen', {
    status: 'info',
    value: `${screen.width * window.devicePixelRatio}×${screen.height * window.devicePixelRatio} (${screen.width}×${screen.height}@${window.devicePixelRatio}x)`,
  });
}

/* ---------- 6. GPU & Chipset ---------- */
function initGPU() {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      deactivate('gpu', 'WebGL tidak tersedia di browser ini.');
      return;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) {
      deactivate('gpu', 'Browser menyembunyikan identitas GPU (kebijakan anti-fingerprinting).');
      return;
    }
    const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
    const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string;
    activate('gpu', 'neutral');
    renderRows('card-gpu', [
      { label: 'Chipset GPU / Renderer', value: renderer || '—', mono: true },
      { label: 'Vendor GPU Hardware', value: vendor || '—', mono: true },
    ]);
    setEntry('gpu', { status: 'info', value: `${renderer} (${vendor})` });
  } catch {
    deactivate('gpu', 'GPU gagal dibaca di browser ini.');
  }
}

/* ---------- 7. Penyimpanan Origin ---------- */
async function initStorage() {
  if (!navigator.storage?.estimate) {
    deactivate('storage', 'Estimasi penyimpanan tidak didukung browser ini.');
    return;
  }
  try {
    const est = await navigator.storage.estimate();
    if (est.quota == null) {
      deactivate('storage', 'Browser tidak memberikan angka kuota penyimpanan.');
      return;
    }
    const quota = est.quota;
    const usage = est.usage ?? 0;
    const ratio = quota > 0 ? usage / quota : 0;
    activate('storage', 'healthy');
    renderRows('card-storage', [
      { label: 'Terpakai (Situs Ini)', value: fmtBytes(usage), mono: true },
      { label: 'Kuota Tersedia (Origin)', value: fmtBytes(quota), mono: true },
      { label: 'Rasio Terpakai', value: fmtPct(ratio), mono: true },
      { label: 'Status Alokasi', value: quota >= 1e9 ? 'Tersedia Luas (>1 GB)' : 'Terbatas', mono: false },
    ]);
    setEntry('storage', {
      status: 'info',
      value: `${fmtBytes(usage)} terpakai / ${fmtBytes(quota)} kuota origin (${fmtPct(ratio)})`,
      note: 'Kuota penyimpanan browser origin (bukan kapasitas memori flash total HP karena sandbox keamanan web).',
    });
  } catch {
    deactivate('storage', 'Estimasi penyimpanan gagal dibaca.');
  }
}

/* ---------- Extra Modules ---------- */
async function initExtraCards() {
  // Kualitas Layar (Refresh rate, HDR, Color Gamut)
  try {
    const displayRows = await collectDisplayExtra();
    activate('displayx', 'neutral');
    renderRows('card-displayx', displayRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('displayx', 'Gagal membaca kualitas layar.');
  }

  // Sensor & Radio
  try {
    const sensorRows = collectSensors();
    activate('sensors', 'neutral');
    renderRows('card-sensors', sensorRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('sensors', 'Gagal mendeteksi sensor.');
  }

  // Codec Media
  try {
    const codecRows = collectCodecs();
    activate('codecs', 'neutral');
    renderRows('card-codecs', codecRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('codecs', 'Gagal memeriksa codec.');
  }

  // Media Devices
  try {
    const mediaRows = await collectMediaDevices();
    activate('mediadev', 'neutral');
    renderRows('card-mediadev', mediaRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('mediadev', 'Gagal membaca perangkat media.');
  }

  // Kapabilitas Web
  try {
    const platformRows = collectPlatformFeatures();
    activate('platform', 'neutral');
    renderRows('card-platform', platformRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('platform', 'Gagal membaca fitur web.');
  }

  // Memori JS Heap
  try {
    const memoryRows = collectMemory();
    activate('memory', 'neutral');
    renderRows('card-memory', memoryRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('memory', 'Memori JS heap tidak tersedia.');
  }

  // Waktu & Locale
  try {
    const localeRows = collectLocale();
    activate('locale', 'neutral');
    renderRows('card-locale', localeRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('locale', 'Gagal membaca locale sistem.');
  }
}

export function initInfoDashboard() {
  updateOnlineBadge();
  initIpNetwork();
  initBattery();
  initConnection();
  initDevice();
  initScreen();
  initGPU();
  initStorage();
  initExtraCards();
}
