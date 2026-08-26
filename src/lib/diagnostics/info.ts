/**
 * Device info dashboard — 14 kategori data via Web API + High Entropy Client Hints.
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

/* ---------- 4. Perangkat & CPU (High Entropy Client Hints & StatCounter Pro Specs) ---------- */
async function initDevice() {
  const nav = navigator as any;
  activate('device', 'neutral');

  let rawModel = '—';
  let platformVer = '—';
  let platformName = nav.userAgentData?.platform || nav.platform || 'Android';

  // 1. Ambil High Entropy Values (API modern Chrome)
  if (nav.userAgentData?.getHighEntropyValues) {
    try {
      const highEntropy = await nav.userAgentData.getHighEntropyValues([
        'model',
        'platformVersion',
        'architecture',
        'bitness',
      ]);
      if (highEntropy.model) rawModel = highEntropy.model;
      if (highEntropy.platformVersion) platformVer = highEntropy.platformVersion;
      if (highEntropy.platform) platformName = highEntropy.platform;
    } catch {
      /* fallback */
    }
  }

  // 2. Fallback regex dari User-Agent jika model belum terisi
  const ua = navigator.userAgent;
  if (rawModel === '—' || !rawModel) {
    const match = ua.match(/\b(SM-[A-Z0-9]+|M2[0-9]{3}[A-Z0-9]+|POCO [A-Z0-9 ]+|Redmi [A-Z0-9 ]+|Pixel [A-Z0-9 ]+|iPhone|iPad)\b/i);
    if (match) rawModel = match[1];
  }

  const { vendor, modelName } = parseDeviceInfo(rawModel, ua);

  // 3. Tentukan kategori device (Mobile, Desktop, Tablet, Crawler, Console)
  const isMobile = nav.userAgentData?.mobile ?? (/Android|iPhone|iPad|Mobile/i.test(ua) || navigator.maxTouchPoints > 1);
  const isTablet = /iPad|Tablet|Nexus 7|Nexus 10|SM-T/i.test(ua);
  const isDesktop = !isMobile && !isTablet;
  const isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(ua);

  // 4. Hitung resolusi layar fisik aktual
  const dpr = window.devicePixelRatio || 1;
  const screenW = Math.round(screen.width * dpr);
  const screenH = Math.round(screen.height * dpr);

  // 5. Versi browser & OS
  const uaBrands = nav.userAgentData?.brands?.map((b: any) => b.brand).filter((b: string) => !/Not.A.Brand/i.test(b)) ?? [];
  const browserName = uaBrands.length > 0 ? uaBrands.join(', ') : (/Chrome/i.test(ua) ? 'Chrome for Android' : 'Mobile Browser');
  const osFull = `${platformName} ${platformVer !== '—' ? platformVer : (ua.match(/Android (\d+(\.\d+)?)/)?.[1] ?? '')}`.trim();

  renderRows('card-device', [
    { label: 'Hardware Vendor', value: vendor, mono: false },
    { label: 'Hardware Model', value: `${modelName} ${rawModel !== '—' && rawModel !== modelName ? `(${rawModel})` : ''}`.trim(), mono: true },
    { label: 'Sistem Operasi (OS)', value: osFull || 'Android', mono: false },
    { label: 'Browser Name', value: browserName, mono: false },
    { label: 'Screen Resolution', value: `${screenW} × ${screenH} px (Physical)`, mono: true },
    { label: 'Is it a mobile device', value: isMobile ? 'Yes' : 'No', mono: true },
    { label: 'Is it a desktop device', value: isDesktop ? 'Yes' : 'No', mono: true },
    { label: 'Is it a tablet', value: isTablet ? 'Yes' : 'No', mono: true },
    { label: 'Is it a crawler/robot', value: isBot ? 'Yes (Bot Detected)' : 'No', mono: true },
    { label: 'CPU Cores / Threads', value: `${nav.hardwareConcurrency ?? '?'} Cores`, mono: true },
    { label: 'Device RAM (Est)', value: nav.deviceMemory ? `≥ ${nav.deviceMemory} GB RAM` : 'Tidak di-expose', mono: true },
  ]);

  setEntry('device_model', { status: 'info', value: `${vendor} ${modelName} (${rawModel})` });
  setEntry('device_os', { status: 'info', value: osFull });
  setEntry('device_type', { status: 'info', value: isMobile ? 'Mobile Smartphone' : isTablet ? 'Tablet' : 'Desktop' });
  setEntry('device', {
    status: 'info',
    value: `${vendor} ${modelName} · ${osFull} · ${screenW}x${screenH}`,
    note: `Model: ${rawModel}, Vendor: ${vendor}, Browser: ${browserName}`,
  });

  const uaEl = $('[data-ua]');
  if (uaEl) uaEl.textContent = navigator.userAgent;
}

/** Parser cerdas vendor & nama model komersial smartphone */
function parseDeviceInfo(model: string, ua: string): { vendor: string; modelName: string } {
  const m = model.toUpperCase();
  const u = ua.toUpperCase();

  // SAMSUNG
  if (m.includes('SM-') || u.includes('SAMSUNG') || m.includes('SAMSUNG')) {
    if (m.includes('A145F') || m.includes('A145')) return { vendor: 'Samsung', modelName: 'Galaxy A14 4G' };
    if (m.includes('A146')) return { vendor: 'Samsung', modelName: 'Galaxy A14 5G' };
    if (m.includes('A546')) return { vendor: 'Samsung', modelName: 'Galaxy A54 5G' };
    if (m.includes('A556')) return { vendor: 'Samsung', modelName: 'Galaxy A55 5G' };
    if (m.includes('S918')) return { vendor: 'Samsung', modelName: 'Galaxy S23 Ultra' };
    if (m.includes('S928')) return { vendor: 'Samsung', modelName: 'Galaxy S24 Ultra' };
    if (m.includes('SM-')) return { vendor: 'Samsung', modelName: `Galaxy (${model})` };
    return { vendor: 'Samsung', modelName: 'Galaxy Device' };
  }

  // XIAOMI / POCO / REDMI
  if (m.includes('POCO') || u.includes('POCO') || m.includes('M2102J20SG') || m.includes('M2007J20CG')) {
    if (m.includes('M2102J20SG') || m.includes('M2102J20SI') || u.includes('POCO X3 PRO')) return { vendor: 'Xiaomi / POCO', modelName: 'POCO X3 Pro' };
    if (m.includes('M2007J20CG') || u.includes('POCO X3')) return { vendor: 'Xiaomi / POCO', modelName: 'POCO X3 NFC' };
    if (m.includes('22011211G') || u.includes('POCO F4')) return { vendor: 'Xiaomi / POCO', modelName: 'POCO F4 GT' };
    if (m.includes('23049PCD8G') || u.includes('POCO F5')) return { vendor: 'Xiaomi / POCO', modelName: 'POCO F5' };
    if (m.includes('24069PC21G') || u.includes('POCO F6')) return { vendor: 'Xiaomi / POCO', modelName: 'POCO F6' };
    return { vendor: 'Xiaomi / POCO', modelName: model !== '—' ? model : 'POCO Smartphone' };
  }

  if (m.includes('REDMI') || u.includes('REDMI')) {
    return { vendor: 'Xiaomi / Redmi', modelName: model !== '—' ? model : 'Redmi Device' };
  }

  // APPLE
  if (/iPhone/i.test(ua) || m.includes('IPHONE')) {
    return { vendor: 'Apple', modelName: 'iPhone' };
  }
  if (/iPad/i.test(ua) || m.includes('IPAD')) {
    return { vendor: 'Apple', modelName: 'iPad' };
  }

  // GOOGLE PIXEL
  if (m.includes('PIXEL') || u.includes('PIXEL')) {
    return { vendor: 'Google', modelName: model !== '—' ? model : 'Pixel Device' };
  }

  // OPPO / REALME / VIVO
  if (/OPPO/i.test(ua) || m.includes('CPH')) return { vendor: 'OPPO', modelName: model !== '—' ? model : 'OPPO Smartphone' };
  if (/REALME/i.test(ua) || m.includes('RMX')) return { vendor: 'Realme', modelName: model !== '—' ? model : 'Realme Smartphone' };
  if (/VIVO/i.test(ua) || m.includes('V2')) return { vendor: 'Vivo', modelName: model !== '—' ? model : 'Vivo Smartphone' };

  return {
    vendor: model !== '—' ? 'Android Device' : 'Generic Hardware',
    modelName: model !== '—' ? model : 'Mobile Smartphone',
  };
}

/* ---------- 5. Layar & Resolusi ---------- */
function initScreen() {
  activate('screen', 'neutral');
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dpr = window.devicePixelRatio || 1;
  const orientation =
    screen.orientation?.type?.replace('-primary', '').replace('-', ' ') ??
    (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  
  const physW = Math.round(screen.width * dpr);
  const physH = Math.round(screen.height * dpr);

  renderRows('card-screen', [
    { label: 'Resolusi Layar Fisik', value: `${physW} × ${physH} px (Aktual Hardware)`, mono: true },
    { label: 'Viewport Virtual CSS', value: `${screen.width} × ${screen.height} px`, mono: true },
    { label: 'Pixel Density (DPR)', value: `${dpr}× Scale Multiplier`, mono: true },
    { label: 'Orientasi Layar', value: orientation.toUpperCase(), mono: false },
    { label: 'Tema Sistem OS', value: dark ? 'Dark Mode Aktif' : 'Light Mode', mono: false },
  ]);
  setEntry('screen', {
    status: 'info',
    value: `${physW}×${physH} px (${screen.width}×${screen.height}@${dpr}x)`,
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
  try {
    const displayRows = await collectDisplayExtra();
    activate('displayx', 'neutral');
    renderRows('card-displayx', displayRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('displayx', 'Gagal membaca kualitas layar.');
  }

  try {
    const sensorRows = collectSensors();
    activate('sensors', 'neutral');
    renderRows('card-sensors', sensorRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('sensors', 'Gagal mendeteksi sensor.');
  }

  try {
    const codecRows = collectCodecs();
    activate('codecs', 'neutral');
    renderRows('card-codecs', codecRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('codecs', 'Gagal memeriksa codec.');
  }

  try {
    const mediaRows = await collectMediaDevices();
    activate('mediadev', 'neutral');
    renderRows('card-mediadev', mediaRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('mediadev', 'Gagal membaca perangkat media.');
  }

  try {
    const platformRows = collectPlatformFeatures();
    activate('platform', 'neutral');
    renderRows('card-platform', platformRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('platform', 'Gagal membaca fitur web.');
  }

  try {
    const memoryRows = collectMemory();
    activate('memory', 'neutral');
    renderRows('card-memory', memoryRows.map(([label, value]) => ({ label, value })));
  } catch {
    deactivate('memory', 'Memori JS heap tidak tersedia.');
  }

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
