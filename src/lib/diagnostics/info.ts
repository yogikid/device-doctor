/**
 * Device info dashboard — 13 kategori data via Web API.
 * Menghubungkan info dasar + info-extra (display Hz, sensor, codec, platform, JS heap, media devices, locale).
 */
import { $, setText, setHidden, fmtBytes, fmtPct, esc } from '../dom';
import { setEntry } from './store';
import type { Status } from './types';
import {
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

/** Card nonaktif: tampil redup + alasan */
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

/* ---------- Baterai ---------- */
interface BatteryLike extends EventTarget {
  level: number;
  charging: boolean;
}

async function initBattery() {
  if (!('getBattery' in navigator)) {
    deactivate('battery', 'API Baterai tidak didukung di browser ini (hanya Chromium desktop/Android).');
    return;
  }
  try {
    const bat = await (navigator as Navigator & { getBattery(): Promise<BatteryLike> }).getBattery();
    activate('battery', 'healthy');
    const paint = () => {
      const level = Math.round(bat.level * 100);
      renderRows('card-battery', [
        { label: 'Level Daya', value: `${level}%`, mono: true },
        { label: 'Status Cas', value: bat.charging ? 'Sedang di-cas ⚡' : 'Baterai (Discharging)', mono: false },
      ]);
      setEntry('battery', {
        status: 'info',
        value: `${level}%${bat.charging ? ' (cas)' : ''}`,
        note: 'Persentase daya saat ini — browser tidak bisa membaca battery health fisik.',
      });
    };
    paint();
    bat.addEventListener('levelchange', paint);
    bat.addEventListener('chargingchange', paint);
  } catch {
    deactivate('battery', 'Data baterai gagal dibaca oleh browser.');
  }
}

/* ---------- Koneksi ---------- */
function initConnection() {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
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
      { label: 'Status', value: online ? 'Online' : 'Offline', mono: false },
      { label: 'Kualitas (estimasi)', value: conn.effectiveType?.toUpperCase() ?? '—', mono: true },
      { label: 'Downlink', value: conn.downlink != null ? `≈ ${conn.downlink} Mbps` : '—', mono: true },
      { label: 'RTT', value: conn.rtt != null ? `≈ ${conn.rtt} ms` : '—', mono: true },
    ]);
    let st: Status = 'info';
    let note: string | undefined;
    if (!online) {
      st = 'warn';
      note = 'Perangkat sedang offline.';
    } else if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
      st = 'warn';
      note = 'Koneksi lambat terdeteksi — kemungkinan bukan masalah HP.';
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
    el.className = `dd-btn px-2 py-0.5 font-data text-xs ${navigator.onLine ? 'bg-healthy' : 'bg-critical text-white'}`;
  }
}
window.addEventListener('online', updateOnlineBadge);
window.addEventListener('offline', updateOnlineBadge);

/* ---------- Perangkat & Browser ---------- */
function initDevice() {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string; brands?: { brand: string; version: string }[] };
    deviceMemory?: number;
  };
  activate('card-device', 'neutral');
  const uaBrands = nav.userAgentData?.brands?.map((b) => b.brand).filter((b) => !/Not.A.Brand/i.test(b)) ?? [];
  renderRows('card-device', [
    { label: 'Platform', value: nav.userAgentData?.platform ?? (nav.platform || '—'), mono: true },
    { label: 'Brand Browser', value: uaBrands.length > 0 ? uaBrands.join(', ') : '(via UA string)', mono: false },
    { label: 'Core CPU', value: nav.hardwareConcurrency != null ? `${nav.hardwareConcurrency} core` : '—', mono: true },
    { label: 'RAM (approx)', value: nav.deviceMemory != null ? `≥ ${nav.deviceMemory} GB` : 'tidak tersedia', mono: true },
    { label: 'Touch Points', value: String(navigator.maxTouchPoints ?? 0), mono: true },
    { label: 'Bahasa', value: navigator.language, mono: true },
  ]);
  setEntry('device', {
    status: 'info',
    value: `${nav.hardwareConcurrency ?? '?'} core · ${nav.deviceMemory ?? '?'}GB RAM`,
    note: 'RAM dan core CPU adalah estimasi browser.',
  });
  const uaEl = $('[data-ua]');
  if (uaEl) uaEl.textContent = navigator.userAgent;
}

/* ---------- Layar ---------- */
function initScreen() {
  activate('screen', 'neutral');
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const orientation =
    screen.orientation?.type?.replace('-primary', '').replace('-', ' ') ??
    (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  renderRows('card-screen', [
    { label: 'Resolusi', value: `${screen.width} × ${screen.height} px`, mono: true },
    { label: 'Pixel Ratio', value: `${window.devicePixelRatio}×`, mono: true },
    { label: 'Orientasi', value: orientation, mono: false },
    { label: 'Mode Warna', value: dark ? 'Dark Mode' : 'Light Mode', mono: false },
  ]);
  setEntry('screen', {
    status: 'info',
    value: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
  });
}

/* ---------- GPU ---------- */
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
      deactivate('gpu', 'Browser menyembunyikan identitas GPU (kebijakan privasi browser).');
      return;
    }
    const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
    const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string;
    activate('gpu', 'neutral');
    renderRows('card-gpu', [
      { label: 'Renderer', value: renderer || '—', mono: true },
      { label: 'Vendor', value: vendor || '—', mono: true },
    ]);
    setEntry('gpu', { status: 'info', value: renderer });
  } catch {
    deactivate('gpu', 'GPU gagal dibaca di browser ini.');
  }
}

/* ---------- Penyimpanan ---------- */
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
    activate('storage', 'neutral');
    renderRows('card-storage', [
      { label: 'Terpakai (Origin)', value: fmtBytes(usage), mono: true },
      { label: 'Kuota (Origin)', value: fmtBytes(quota), mono: true },
      { label: 'Rasio', value: fmtPct(ratio), mono: true },
    ]);
    setEntry('storage', {
      status: ratio > 0.9 ? 'warn' : 'info',
      value: `${fmtBytes(usage)} / ${fmtBytes(quota)} (${fmtPct(ratio)})`,
      note: 'Ini kuota storage browser origin, bukan kapasitas internal HP.',
    });
  } catch {
    deactivate('storage', 'Estimasi penyimpanan gagal dibaca.');
  }
}

/* ---------- Extra Modules ---------- */
async function initExtraCards() {
  // 1. Kualitas Layar (Refresh rate, HDR, Color Gamut)
  try {
    const displayRows = await collectDisplayExtra();
    activate('displayx', 'neutral');
    renderRows('card-displayx', displayRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('displayx', 'Gagal membaca kualitas layar.');
  }

  // 2. Sensor & Radio
  try {
    const sensorRows = collectSensors();
    activate('sensors', 'neutral');
    renderRows('card-sensors', sensorRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('sensors', 'Gagal mendeteksi sensor.');
  }

  // 3. Codec Media
  try {
    const codecRows = collectCodecs();
    activate('codecs', 'neutral');
    renderRows('card-codecs', codecRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('codecs', 'Gagal memeriksa codec.');
  }

  // 4. Media Devices
  try {
    const mediaRows = await collectMediaDevices();
    activate('mediadev', 'neutral');
    renderRows('card-mediadev', mediaRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('mediadev', 'Gagal membaca perangkat media.');
  }

  // 5. Kapabilitas Web
  try {
    const platformRows = collectPlatformFeatures();
    activate('platform', 'neutral');
    renderRows('card-platform', platformRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('platform', 'Gagal membaca fitur web.');
  }

  // 6. Memori JS Heap
  try {
    const memoryRows = collectMemory();
    activate('memory', 'neutral');
    renderRows('card-memory', memoryRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('memory', 'Memori JS heap tidak tersedia.');
  }

  // 7. Waktu & Locale
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
  initBattery();
  initConnection();
  initDevice();
  initScreen();
  initGPU();
  initStorage();
  initExtraCards();
}
