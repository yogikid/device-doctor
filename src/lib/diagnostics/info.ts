/**
 * Device info dashboard — 14 kategori data via Web API + High Entropy Client Hints.
 */
import { $, setText, setHidden, fmtBytes, fmtPct, esc } from '../dom';
import { setEntry } from './store';
import type { Status } from './types';
import { initExtraInfo } from './info-extra';

function activate(cardId: string, accent: 'healthy' | 'attention' | 'critical' | 'neutral' = 'neutral') {
  const card = $(`#${cardId}`);
  if (!card) return;
  card.setAttribute('data-accent', accent);
  const pill = card.querySelector('[data-pill]') as HTMLElement | null;
  if (pill) {
    pill.classList.remove('dd-pill-dim');
    pill.classList.add('dd-pill-live');
  }
}

function deactivate(cardId: string, reason?: string) {
  const card = $(`#${cardId}`);
  if (!card) return;
  card.setAttribute('data-accent', 'attention');
  const pill = card.querySelector('[data-pill]') as HTMLElement | null;
  if (pill) {
    pill.classList.remove('dd-pill-live');
    pill.classList.add('dd-pill-dim');
  }
  const body = card.querySelector('.dd-card-body');
  if (body && reason) {
    body.innerHTML = `<p class="text-xs text-muted-foreground">${esc(reason)}</p>`;
  }
}

export function renderRows(cardId: string, rows: { label: string; value: string; mono?: boolean }[]) {
  const card = $(`#${cardId}`);
  if (!card) return;
  const body = card.querySelector('.dd-card-body');
  if (!body) return;

  const html = rows
    .map((r) => {
      const monoCls = r.mono ? 'font-data' : 'font-sans';
      return `
        <div class="dd-row">
          <dt class="text-xs text-muted-foreground">${esc(r.label)}</dt>
          <dd class="${monoCls} text-xs font-bold text-foreground">${esc(r.value)}</dd>
        </div>
      `;
    })
    .join('');

  body.innerHTML = `<dl class="flex flex-col gap-1">${html}</dl>`;
}

/* ---------- 1. IP Publik & Jaringan Edge (Cloudflare + IPWhois Hybrid) ---------- */
async function initIpNetwork() {
  activate('card-ip', 'neutral');

  try {
    const res = await fetch('/api/ip', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    renderRows('card-ip', [
      { label: 'Alamat IP Publik', value: data.ip || '—', mono: true },
      { label: 'ISP / Operator', value: data.isp || '—', mono: false },
      { label: 'Organisasi Jaringan', value: data.asOrganization || data.isp || '—', mono: false },
      { label: 'Nomor Autonomous System', value: data.asn || '—', mono: true },
      { label: 'Lokasi Datacenter / Kota', value: `${data.city || '—'}, ${data.region || '—'} (${data.country || 'ID'})`, mono: false },
      { label: 'Protokol & Enkripsi', value: `${data.httpProtocol || 'HTTP/2'} · ${data.tlsVersion || 'TLS 1.3'}`, mono: true },
    ]);

    setEntry('network_ip', {
      status: 'pass',
      value: `${data.ip} (${data.isp})`,
      note: `IP Publik: ${data.ip}, ISP: ${data.isp}, ASN: ${data.asn}, Lokasi: ${data.city}, ${data.country}.`,
    });
  } catch {
    // Fallback Client-side jika /api/ip timeout
    try {
      const extRes = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
      const ext = await extRes.json();
      if (ext.success) {
        renderRows('card-ip', [
          { label: 'Alamat IP Publik', value: ext.ip, mono: true },
          { label: 'ISP / Operator', value: ext.connection?.isp || '—', mono: false },
          { label: 'Organisasi Jaringan', value: ext.connection?.org || '—', mono: false },
          { label: 'Nomor Autonomous System', value: ext.connection?.asn ? `AS${ext.connection.asn}` : '—', mono: true },
          { label: 'Lokasi Datacenter / Kota', value: `${ext.city}, ${ext.region} (${ext.country_code})`, mono: false },
          { label: 'Protokol & Enkripsi', value: 'HTTPS / TLS', mono: true },
        ]);
        setEntry('network_ip', {
          status: 'pass',
          value: `${ext.ip} (${ext.connection?.isp})`,
          note: `IP: ${ext.ip}, ISP: ${ext.connection?.isp}, Lokasi: ${ext.city}.`,
        });
        return;
      }
    } catch {}
    deactivate('card-ip', 'Gagal memuat detail IP publik.');
  }
}

/* ---------- 2. Baterai & Daya ---------- */
async function initBattery() {
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{
      charging: boolean;
      level: number;
      chargingTime: number;
      dischargingTime: number;
      addEventListener: (type: string, listener: () => void) => void;
    }>;
  };

  if (!nav.getBattery) {
    deactivate('battery', 'Battery Status API tidak didukung di browser ini (fitur ini dibatasi di iOS/Safari demi privasi).');
    setEntry('battery', { status: 'unsupported', note: 'Browser tidak mengekspos Battery Status API.' });
    return;
  }

  try {
    const bat = await nav.getBattery();
    activate('battery', 'healthy');

    const paint = () => {
      const level = Math.round(bat.level * 100);
      renderRows('card-battery', [
        { label: 'Status Daya', value: bat.charging ? 'Sedang Mengisi Daya (Charging)' : 'Menggunakan Baterai (Discharging)', mono: false },
        { label: 'Kapasitas Baterai', value: `${level}%`, mono: true },
        { label: 'Estimasi Waktu Cas Penuh', value: bat.charging && isFinite(bat.chargingTime) && bat.chargingTime > 0 ? `${Math.round(bat.chargingTime / 60)} menit` : '—', mono: true },
        { label: 'Estimasi Waktu Habis', value: !bat.charging && isFinite(bat.dischargingTime) && bat.dischargingTime > 0 ? `${Math.round(bat.dischargingTime / 60)} menit` : '—', mono: true },
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

/* ---------- 3. Sinyal & Network Info (Deteksi Akurat Wi-Fi / Seluler) ---------- */
function initConnection() {
  const nav = navigator as Navigator & {
    connection?: { 
      type?: string; 
      effectiveType?: string; 
      downlink?: number; 
      rtt?: number; 
      saveData?: boolean;
    };
  };
  const conn = nav.connection;
  if (!conn) {
    deactivate('connection', 'Network Information API tidak didukung di browser ini. Status online/offline tetap dicek.');
    setEntry('connection', { status: 'unsupported', note: 'Detail koneksi (rtt/downlink) tidak tersedia di browser ini.' });
    updateOnlineBadge();
    return;
  }
  activate('connection', 'healthy');

  const paint = () => {
    const online = navigator.onLine;

    // 1. Deteksi Fisik Interface Jaringan (Wi-Fi vs Seluler)
    let physicalType = 'Wi-Fi / LAN Broadband';
    if (conn.type) {
      if (conn.type === 'wifi') physicalType = 'Wi-Fi (Wireless LAN)';
      else if (conn.type === 'cellular') physicalType = 'Jaringan Seluler (Mobile Data)';
      else if (conn.type === 'ethernet') physicalType = 'Kabel Ethernet LAN';
      else if (conn.type === 'bluetooth') physicalType = 'Bluetooth Tethering';
      else if (conn.type === 'none') physicalType = 'Tidak Ada Koneksi';
      else physicalType = conn.type.toUpperCase();
    } else {
      // conn.type sering disembunyikan browser untuk privasi.
      // Jika RTT sangat rendah (<80ms) dan downlink tinggi, hampir pasti Wi-Fi/Fiber.
      physicalType = (conn.rtt && conn.rtt < 100) ? 'Wi-Fi / Fixed Broadband (Terdeteksi)' : 'Jaringan Data / Wi-Fi';
    }

    // 2. Profil Throughput (Effective Performance Class)
    const perfProfile = conn.effectiveType 
      ? `${conn.effectiveType.toUpperCase()} (Kecepatan Setara Broadband)` 
      : 'Broadband';

    renderRows('card-connection', [
      { label: 'Status Jaringan', value: online ? 'Online Terhubung' : 'Offline Terputus', mono: false },
      { label: 'Media Transmisi (Fisik)', value: physicalType, mono: false },
      { label: 'Profil Kecepatan Web', value: perfProfile, mono: false },
      { label: 'Estimasi Downlink (Bandwidth)', value: conn.downlink != null ? `≈ ${conn.downlink} Mbps` : '—', mono: true },
      { label: 'Latensi Server (RTT)', value: conn.rtt != null ? `≈ ${conn.rtt} ms` : '—', mono: true },
      { label: 'Mode Hemat Data (Data Saver)', value: conn.saveData ? 'Aktif' : 'Nonaktif', mono: false },
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
      value: `${online ? 'online' : 'offline'} · ${physicalType} · ${conn.effectiveType?.toUpperCase() ?? 'Fast'}`,
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
    { label: 'Hardware Model', value: modelName, mono: false },
    { label: 'Sistem Operasi (OS)', value: osFull || 'Android', mono: false },
    { label: 'Browser Name', value: browserName, mono: false },
    { label: 'Screen Width (Physical)', value: `${screenW} px`, mono: true },
    { label: 'Screen Height (Physical)', value: `${screenH} px`, mono: true },
    { label: 'Is it a mobile device', value: isMobile ? 'Yes' : 'No', mono: true },
    { label: 'Is it a desktop device', value: isDesktop ? 'Yes' : 'No', mono: true },
    { label: 'Is it a tablet', value: isTablet ? 'Yes' : 'No', mono: true },
    { label: 'Is it a crawler/robot', value: isBot ? 'Yes' : 'No', mono: true },
    { label: 'CPU Cores / Threads', value: `${navigator.hardwareConcurrency ?? '—'} Cores`, mono: true },
    { label: 'Device RAM (Est)', value: (nav as any).deviceMemory ? `≥ ${(nav as any).deviceMemory} GB RAM` : '—', mono: true },
  ]);

  setEntry('device', {
    status: 'info',
    value: `${modelName} · ${osFull}`,
    note: `Vendor: ${vendor}, Model: ${modelName}, CPU: ${navigator.hardwareConcurrency ?? '?'} Cores, Screen: ${screenW}x${screenH}px.`,
  });
}

function parseDeviceInfo(model: string, ua: string): { vendor: string; modelName: string } {
  let vendor = 'Unknown Vendor';
  let modelName = model !== '—' ? model : 'Smartphone / Generic Device';

  if (/Samsung|SM-|Galaxy/i.test(model) || /SM-[A-Z0-9]+/i.test(ua) || /Samsung/i.test(ua)) {
    vendor = 'Samsung';
    if (model.includes('SM-A145F')) modelName = 'Galaxy A14 4G (SM-A145F)';
    else if (model.includes('SM-A146')) modelName = 'Galaxy A14 5G';
    else if (model.includes('SM-A546')) modelName = 'Galaxy A54 5G';
    else if (model.includes('SM-S918')) modelName = 'Galaxy S23 Ultra';
    else if (model.includes('SM-S928')) modelName = 'Galaxy S24 Ultra';
    else if (model.startsWith('SM-')) modelName = `Galaxy (${model})`;
  } else if (/POCO|Xiaomi|Redmi|M2102|2201/i.test(model) || /POCO|Redmi|Xiaomi|Mi /i.test(ua)) {
    vendor = 'Xiaomi / POCO';
    if (/M2102J20SG|POCO X3 Pro/i.test(model) || /M2102J20SG/i.test(ua)) modelName = 'POCO X3 Pro';
    else if (/2201116SG|POCO X4 Pro/i.test(model)) modelName = 'POCO X4 Pro 5G';
    else if (/23049PCD8G|POCO F5/i.test(model)) modelName = 'POCO F5';
    else if (/2311DRK48G|POCO X6 Pro/i.test(model)) modelName = 'POCO X6 Pro';
    else if (/Redmi/i.test(model)) modelName = model;
    else modelName = `Xiaomi / POCO (${model})`;
  } else if (/iPhone|iPad|Apple/i.test(ua) || /iPhone|iPad/i.test(model)) {
    vendor = 'Apple';
    modelName = /iPad/i.test(ua) ? 'iPad' : 'iPhone';
  } else if (/Pixel/i.test(model) || /Pixel/i.test(ua)) {
    vendor = 'Google';
    modelName = model;
  }

  return { vendor, modelName };
}

/* ---------- 5. Layar & Display Hardware ---------- */
function initDisplay() {
  activate('card-display', 'neutral');

  const dpr = window.devicePixelRatio || 1;
  const screenW = Math.round(screen.width * dpr);
  const screenH = Math.round(screen.height * dpr);
  const colorDepth = screen.colorDepth ? `${screen.colorDepth}-bit` : '24-bit';
  const colorGamut = window.matchMedia('(color-gamut: p3)').matches
    ? 'DCI-P3 (Wide Color)'
    : window.matchMedia('(color-gamut: srgb)').matches
      ? 'sRGB Standard'
      : 'Standard';
  const isHdr = window.matchMedia('(dynamic-range: high)').matches;
  const orientation = screen.orientation?.type?.replace('-primary', '').replace('-secondary', '') || (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');

  renderRows('card-display', [
    { label: 'Resolusi Fisik Layar', value: `${screenW} × ${screenH} px`, mono: true },
    { label: 'Viewport Browser CSS', value: `${window.innerWidth} × ${window.innerHeight} px`, mono: true },
    { label: 'Device Pixel Ratio (DPR)', value: `${dpr.toFixed(2)}x Density`, mono: true },
    { label: 'Refresh Rate Layar (Hz)', value: 'Mengukur…', mono: true },
    { label: 'Kedalaman Warna', value: colorDepth, mono: true },
    { label: 'Color Gamut Layar', value: colorGamut, mono: false },
    { label: 'Dukungan HDR Display', value: isHdr ? 'Mendukung (High Dynamic Range)' : 'SDR Standard', mono: false },
    { label: 'Orientasi Layar', value: orientation.toUpperCase(), mono: false },
    { label: 'Titik Sentuh (Multi-touch)', value: `${navigator.maxTouchPoints || 1} Titik Sentuh`, mono: true },
  ]);

  // Mengukur live refresh rate (Hz)
  let frames = 0;
  const startTime = performance.now();
  const measure = () => {
    frames++;
    const elapsed = performance.now() - startTime;
    if (elapsed < 1000) {
      requestAnimationFrame(measure);
    } else {
      const fps = Math.round((frames * 1000) / elapsed);
      const rows = [
        { label: 'Resolusi Fisik Layar', value: `${screenW} × ${screenH} px`, mono: true },
        { label: 'Viewport Browser CSS', value: `${window.innerWidth} × ${window.innerHeight} px`, mono: true },
        { label: 'Device Pixel Ratio (DPR)', value: `${dpr.toFixed(2)}x Density`, mono: true },
        { label: 'Refresh Rate Layar (Hz)', value: `≈ ${fps} Hz`, mono: true },
        { label: 'Kedalaman Warna', value: colorDepth, mono: true },
        { label: 'Color Gamut Layar', value: colorGamut, mono: false },
        { label: 'Dukungan HDR Display', value: isHdr ? 'Mendukung (High Dynamic Range)' : 'SDR Standard', mono: false },
        { label: 'Orientasi Layar', value: orientation.toUpperCase(), mono: false },
        { label: 'Titik Sentuh (Multi-touch)', value: `${navigator.maxTouchPoints || 1} Titik Sentuh`, mono: true },
      ];
      renderRows('card-display', rows);
    }
  };
  requestAnimationFrame(measure);
}

/* ---------- 6. Penyimpanan & Storage Origin ---------- */
async function initStorage() {
  activate('card-storage', 'neutral');

  if (navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const quota = est.quota ? fmtBytes(est.quota) : '—';
      const used = est.usage != null ? fmtBytes(est.usage) : '0 B';
      const pct = est.quota && est.usage ? fmtPct((est.usage / est.quota) * 100) : '0%';

      let persisted = 'Tidak';
      if (navigator.storage.persisted) {
        persisted = (await navigator.storage.persisted()) ? 'Ya (Aman dari Eviction)' : 'Sementara (Session)';
      }

      renderRows('card-storage', [
        { label: 'Penyimpanan Terpakai (Origin)', value: used, mono: true },
        { label: 'Kuota Dialokasikan Browser', value: quota, mono: true },
        { label: 'Rasio Terpakai', value: pct, mono: true },
        { label: 'Status Persistensi Data', value: persisted, mono: false },
        { label: 'IndexedDB Engine', value: 'indexedDB' in window ? 'Tersedia' : 'Nonaktif', mono: false },
        { label: 'OPFS (Private File System)', value: 'getDirectory' in (navigator.storage || {}) ? 'Mendukung' : 'Tidak', mono: false },
      ]);
    } catch {
      deactivate('card-storage', 'Gagal mengukur kuota penyimpanan.');
    }
  } else {
    deactivate('card-storage', 'Storage Estimation API tidak didukung browser ini.');
  }
}

/* ---------- Inisialisasi Seluruh Modul Spesifikasi ---------- */
export function initInfoDashboard() {
  initIpNetwork();
  initBattery();
  initConnection();
  initDevice();
  initDisplay();
  initStorage();
  initExtraInfo();
}
