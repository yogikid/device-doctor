/**
 * Device info dashboard — 7 kategori data via Web API.
 * Prinsip: feature-detect dulu ('x' in navigator), jangan pernah asumsi.
 * Card API-nya nggak didukung TETAP dirender dalam state nonaktif + alasan.
 */
import { $, setText, setHidden, fmtBytes, fmtPct, esc } from '../dom';
import { setEntry } from './store';
import type { Status } from './types';

interface FieldRow {
  label: string;
  value: string;
  mono?: boolean;
}

function renderRows(containerId: string, rows: FieldRow[]) {
  const box = $(`#${containerId} [data-rows]`);
  if (!box) return;
  box.innerHTML = rows
    .map(
      (r) => `<div class="flex items-start justify-between gap-3 py-1.5">
        <span class="text-sm text-muted-foreground shrink-0">${esc(r.label)}</span>
        <span class="${r.mono === false ? 'text-sm font-medium text-right' : 'font-data text-[13px] text-right break-all'}">${esc(r.value)}</span>
      </div>`,
    )
    .join('');
}

/** Card nonaktif: tampil abu-abu + alasan, JANGAN disembunyikan. */
function deactivate(id: string, reason: string) {
  const card = $(`#card-${id}`);
  const body = $(`#card-${id} [data-body]`);
  const note = $(`#card-${id} [data-note]`);
  if (card instanceof HTMLElement) card.dataset.inactive = 'true';
  setHidden(body, true);
  setText(note, reason);
  setEntry(id, { status: 'unsupported', note: reason });
}

function activate(id: string) {
  const card = $(`#card-${id}`);
  const note = $(`#card-${id} [data-note]`);
  if (card instanceof HTMLElement) card.dataset.inactive = 'false';
  setText(note, '');
}

/* ---------- Baterai (Chromium; Firefox/Safari nggak expose lagi) ---------- */
interface BatteryLike extends EventTarget {
  level: number;
  charging: boolean;
}

async function initBattery() {
  if (!('getBattery' in navigator)) {
    deactivate('battery', 'Baterai tidak dapat dibaca di browser ini, coba Chrome/Edge.');
    return;
  }
  try {
    const bat = await (navigator as Navigator & { getBattery(): Promise<BatteryLike> }).getBattery();
    const paint = () => {
      const level = Math.round(bat.level * 100);
      renderRows('card-battery', [
        { label: 'Level', value: `${level}%`, mono: true },
        { label: 'Status', value: bat.charging ? 'Sedang di-cas ⚡' : 'Tidak di-cas', mono: false },
      ]);
      // PENTING: ini CUMA persentase & status cas. Bukan battery health/wear.
      setEntry('battery', {
        status: 'info',
        value: `${level}%${bat.charging ? ' (cas)' : ''}`,
        note: 'Persentase daya saat ini — browser tidak bisa membaca battery health.',
      });
    };
    paint();
    bat.addEventListener('levelchange', paint);
    bat.addEventListener('chargingchange', paint);
  } catch {
    deactivate('battery', 'Data baterai gagal dibaca oleh browser ini.');
  }
}

/* ---------- Koneksi ---------- */
function initConnection() {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  };
  const conn = nav.connection;
  if (!conn) {
    deactivate('connection', 'Detail koneksi hanya tersedia di browser Chromium. Status online/offline tetap bisa dipantau di bawah.');
    // Tetap kasih info onLine minimal lewat bar status global
    setEntry('connection', { status: 'unsupported', note: 'Detail koneksi (4g/rtt) tidak tersedia di browser ini.' });
    updateOnlineBadge();
    return;
  }
  activate('connection');
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
      note = 'Koneksi lambat terdeteksi — kemungkinan besar bukan masalah HP. Cek sinyal atau pindah ke WiFi.';
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
  if (el) el.textContent = navigator.onLine ? 'Online' : 'Offline';
}
window.addEventListener('online', updateOnlineBadge);
window.addEventListener('offline', updateOnlineBadge);

/* ---------- Perangkat & Browser ---------- */
function initDevice() {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string; brands?: { brand: string; version: string }[] };
    deviceMemory?: number;
  };
  const uaBrands = nav.userAgentData?.brands?.map((b) => b.brand).filter((b) => !/Not.A.Brand/i.test(b)) ?? [];
  renderRows('card-device', [
    { label: 'Platform', value: nav.userAgentData?.platform ?? (nav.platform || '—'), mono: true },
    { label: 'Brand browser', value: uaBrands.length > 0 ? uaBrands.join(', ') : '(via UA string)', mono: false },
    { label: 'Core CPU', value: nav.hardwareConcurrency != null ? `${nav.hardwareConcurrency} core` : '—', mono: true },
    { label: 'RAM (approx)', value: nav.deviceMemory != null ? `≥ ${nav.deviceMemory} GB` : 'tidak tersedia', mono: true },
    { label: 'Touch points', value: String(navigator.maxTouchPoints ?? 0), mono: true },
    { label: 'Bahasa', value: navigator.language, mono: true },
  ]);
  setEntry('device', {
    status: 'info',
    value: `${nav.hardwareConcurrency ?? '?'} core · ${nav.deviceMemory ?? '?'}GB RAM`,
    note: 'RAM dan model HP hanya estimasi dari browser, bukan angka pasti.',
  });
  // UA mentah disimpan buat ringkasan (dilipat biar nggak makan tempat)
  const uaEl = $('[data-ua]');
  if (uaEl) uaEl.textContent = navigator.userAgent;
}

/* ---------- Layar ---------- */
function initScreen() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const orientation =
    screen.orientation?.type?.replace('-primary', '').replace('-', ' ') ??
    (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  renderRows('card-screen', [
    { label: 'Resolusi', value: `${screen.width} × ${screen.height} px`, mono: true },
    { label: 'Pixel ratio', value: `${window.devicePixelRatio}×`, mono: true },
    { label: 'Orientasi', value: orientation, mono: false },
    { label: 'Mode warna', value: dark ? 'Dark (preferensi OS)' : 'Light (preferensi OS)', mono: false },
  ]);
  setEntry('screen', {
    status: 'info',
    value: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
  });
}

/* ---------- GPU (WebGL debug renderer) ---------- */
function initGPU() {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      deactivate('gpu', 'WebGL tidak tersedia di browser/mode privasi ini — GPU tidak bisa dibaca.');
      return;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) {
      deactivate('gpu', 'Browser menyembunyikan identitas GPU (umum di mode privasi ketat).');
      return;
    }
    const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
    const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string;
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
    renderRows('card-storage', [
      { label: 'Terpakai (origin)', value: fmtBytes(usage), mono: true },
      { label: 'Kuota (origin)', value: fmtBytes(quota), mono: true },
      { label: 'Rasio', value: fmtPct(ratio), mono: true },
    ]);
    // Catatan penting: ini kuota origin browser, BUKAN kapasitas fisik HP!
    setEntry('storage', {
      status: ratio > 0.9 ? 'warn' : 'info',
      value: `${fmtBytes(usage)} / ${fmtBytes(quota)} (${fmtPct(ratio)})`,
      note:
        ratio > 0.9
          ? 'Penyimpanan origin hampir penuh — coba hapus cache/file yang nggak kepake.'
          : 'Ini kuota storage browser untuk situs ini, bukan kapasitas fisik HP.',
    });
  } catch {
    deactivate('storage', 'Estimasi penyimpanan gagal dibaca.');
  }
}

export function initInfoDashboard() {
  initBattery();
  initConnection();
  initDevice();
  initScreen();
  initGPU();
  initStorage();
}
