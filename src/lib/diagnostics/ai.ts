/**
 * Klien AI — bicara ke Worker proxy (/api/ai/*).
 * Dilengkapi dengan Super RAG Context yang mengumpulkan 100% data spesifikasi
 * hardware, jaringan IP/ISP, Web APIs, dan seluruh riwayat hasil pengujian diagnostik.
 */
import { getSession } from './store';
import { buildVerdict } from './engine';

const LABEL: Record<string, string> = {
  touch: 'Layar Sentuh (Multi-Touch Grid)',
  display: 'Dead Pixel & Layar Solid 8 Warna',
  speaker: 'Speaker Stereo (L/R)',
  mic: 'Mikrofon Live Level',
  camera: 'Kamera Depan & Belakang',
  vibrate: 'Motor Getar Haptic',
  motion: 'Sensor Gerak 3D Gyroscope',
  benchmark: 'Stress Test CPU/GPU Benchmark',
  gps: 'Presisi Kuncian GPS & Satelit',
  location: 'Peta & Koordinat Lokasi',
};

/**
 * Bangun RAG Snapshot Super Lengkap (Spesifikasi 14 Modul + Hasil Tes + State Browser)
 */
export function buildSnapshot(): Record<string, unknown> {
  const s = getSession();
  const v = buildVerdict();

  // 1. Kumpulkan seluruh hasil tes fisik
  const tests: Record<string, unknown> = {};
  for (const id of Object.keys(s.entries)) {
    const e = s.entries[id];
    if (!e) continue;
    const name = LABEL[id] ?? id;
    tests[name] = {
      status: e.status,
      nilai: e.value ?? '—',
      catatan: e.note ?? '—',
    };
  }

  // 2. Kumpulkan spesifikasi mendalam secara langsung dari Web APIs
  const glInfo = getWebGLInfo();
  const perfMem = getPerfMemory();
  const dtf = Intl.DateTimeFormat().resolvedOptions();
  const nav = navigator as any;

  const deepSpecs = {
    jaringan_dan_ip: {
      ip_publik_dan_isp: s.entries['ip_network']?.value || 'Memuat...',
      catatan_jaringan: s.entries['ip_network']?.note || '—',
      status_online: navigator.onLine ? 'Online' : 'Offline',
      tipe_koneksi: nav.connection?.effectiveType || '—',
      downlink_est: nav.connection?.downlink ? `${nav.connection.downlink} Mbps` : '—',
      rtt_latency: nav.connection?.rtt ? `${nav.connection.rtt} ms` : '—',
      hemat_data: nav.connection?.saveData ? 'Aktif' : 'Nonaktif',
    },
    hardware_dan_cpu: {
      platform_os: nav.userAgentData?.platform || nav.platform || '—',
      cpu_cores_threads: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} Core` : '—',
      ram_kapasitas_est: nav.deviceMemory ? `≥ ${nav.deviceMemory} GB RAM` : 'Tidak di-expose',
      max_touch_points: `${navigator.maxTouchPoints ?? 0} Titik Sentuh`,
      bahasa_browser: navigator.language,
      daftar_bahasa: navigator.languages?.join(', ') || navigator.language,
    },
    layar_dan_display: {
      resolusi_aktual: `${screen.width * (window.devicePixelRatio || 1)} × ${screen.height * (window.devicePixelRatio || 1)} px`,
      viewport_css: `${screen.width} × ${screen.height} px`,
      pixel_ratio_dpr: `${window.devicePixelRatio || 1}x`,
      color_depth: `${screen.colorDepth || 24}-bit`,
      hdr_support: matchMedia('(dynamic-range: high)').matches ? 'Ya (HDR Capable)' : 'Tidak (SDR)',
      color_gamut: matchMedia('(color-gamut: p3)').matches ? 'Display-P3 (Wide Gamut)' : 'sRGB',
      orientasi: screen.orientation?.type || 'portrait',
      tema_os: matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark Mode' : 'Light Mode',
    },
    gpu_dan_grafis: {
      chipset_renderer: glInfo.renderer,
      vendor_hardware: glInfo.vendor,
      webgl2_support: glInfo.hasWebGL2 ? 'Didukung' : 'Tidak',
      webgpu_support: 'gpu' in navigator ? 'Didukung Browser' : 'Belum Didukung',
    },
    baterai: {
      status_terbaca: s.entries['battery']?.value || '—',
      catatan_baterai: s.entries['battery']?.note || '—',
    },
    penyimpanan_browser: {
      status_storage: s.entries['storage']?.value || '—',
      catatan_storage: s.entries['storage']?.note || '—',
    },
    sensor_dan_radio: {
      accelerometer: 'Accelerometer' in window || 'DeviceMotionEvent' in window ? 'Tersedia' : 'Tidak',
      gyroscope: 'Gyroscope' in window || 'DeviceOrientationEvent' in window ? 'Tersedia' : 'Tidak',
      magnetometer: 'Magnetometer' in window ? 'Tersedia' : 'Tidak',
      ambient_light: 'AmbientLightSensor' in window ? 'Tersedia' : 'Tidak',
      vibration_motor: 'vibrate' in navigator ? 'Tersedia' : 'Tidak',
      bluetooth: 'bluetooth' in navigator ? 'Tersedia' : 'Tidak',
      nfc: 'NDEFReader' in window ? 'Tersedia' : 'Tidak',
      usb_otg: 'usb' in navigator ? 'Tersedia' : 'Tidak',
    },
    memori_js_heap: perfMem,
    waktu_dan_wilayah: {
      timezone: dtf.timeZone,
      locale: dtf.locale,
      kalender: dtf.calendar || 'gregory',
      offset_utc: `${-new Date().getTimezoneOffset() / 60} Jam`,
      jam_lokal: new Date().toLocaleString('id-ID'),
    },
    keamanan_dan_web: {
      pwa_mode: matchMedia('(display-mode: standalone)').matches ? 'Standalone App' : 'Browser Tab',
      service_worker: 'serviceWorker' in navigator ? 'Aktif' : 'Tidak',
      biometrik_webauthn: window.PublicKeyCredential ? 'Mendukung Fingerprint/Passkey' : 'Tidak',
      secure_context: window.isSecureContext ? 'HTTPS / Secure' : 'Insecure',
    },
  };

  return {
    stempel_diagnosa: v.stamp,
    ringkasan_singkat: v.sub,
    rekomendasi_mesin: v.items.map((i) => ({ tipe: i.kind, judul: i.title, keterangan: i.body })),
    hasil_pengujian_diagnostik: tests,
    rag_spesifikasi_lengkap_perangkat: deepSpecs,
    user_agent_mentah: navigator.userAgent,
    panduan_analisis:
      'Semua data ini dibaca dari browser user. Kamu memiliki seluruh konteks spesifikasi mulai dari IP/ISP, CPU, GPU, Layar, Sensor, Storage, hingga Hasil Tes Hardware.',
  };
}

function getWebGLInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    const hasWebGL2 = !!canvas.getContext('webgl2');
    if (!gl) return { renderer: 'Tidak tersedia', vendor: 'Tidak tersedia', hasWebGL2 };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return { renderer: 'Di-masking browser', vendor: 'Di-masking browser', hasWebGL2 };
    return {
      renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string,
      vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string,
      hasWebGL2,
    };
  } catch {
    return { renderer: 'Gagal dibaca', vendor: 'Gagal dibaca', hasWebGL2: false };
  }
}

function getPerfMemory() {
  const perf = performance as any;
  const m = perf?.memory;
  if (!m) return { status: 'Tidak di-expose (Non-Chromium)' };
  return {
    heap_terpakai_mb: (m.usedJSHeapSize / 1048576).toFixed(1) + ' MB',
    total_heap_mb: (m.totalJSHeapSize / 1048576).toFixed(1) + ' MB',
    limit_heap_mb: (m.jsHeapSizeLimit / 1048576).toFixed(0) + ' MB',
  };
}

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

async function streamPost(
  path: string,
  payload: unknown,
  h: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      let msg = `Server menjawab HTTP ${res.status}.`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* biarkan pesan default */
      }
      h.onError(msg);
      return;
    }
    if (!res.body) {
      h.onError('Respons AI kosong.');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      h.onChunk(decoder.decode(value, { stream: true }));
    }
    h.onDone();
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;
    h.onError(
      `Gagal menghubungi AI: ${String((err as Error)?.message ?? err)}. Cek koneksi internetmu lalu coba lagi.`,
    );
  }
}

/** Minta analisis lengkap atas hasil pemeriksaan. */
export function requestAnalysis(h: StreamHandlers, signal?: AbortSignal): Promise<void> {
  return streamPost('/api/ai/analyze', { snapshot: buildSnapshot() }, h, signal);
}

/** Tanya-jawab dengan asisten, membawa konteks hasil pemeriksaan. */
export function requestChat(
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  h: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  return streamPost('/api/ai/chat', { question, history, snapshot: buildSnapshot() }, h, signal);
}

/** Markdown → HTML minimal */
export function renderMarkdown(md: string): string {
  const esc = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = esc.split('\n');
  let html = '';
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^##\s+/.test(line)) {
      closeList();
      html += `<h4 class="mt-3 font-heading text-sm font-bold uppercase tracking-wide text-primary">${line.replace(/^##\s+/, '')}</h4>`;
    } else if (/^#\s+/.test(line)) {
      closeList();
      html += `<h3 class="mt-3 font-heading text-base font-bold">${line.replace(/^#\s+/, '')}</h3>`;
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul class="ml-4 list-disc space-y-1">';
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else if (line === '') {
      closeList();
    } else {
      closeList();
      html += `<p class="mt-2">${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-secondary-background px-1 font-data text-xs">$1</code>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>');
}
