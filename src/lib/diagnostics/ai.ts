/**
 * Klien AI — bicara ke Worker proxy (/api/ai/*).
 * Dilengkapi dengan Super RAG Context & Markdown Parser berbasis 'marked'.
 */
import { marked } from 'marked';
import { getSession } from './store';
import { buildVerdict } from './engine';

// Konfigurasi marked agar aman dan mendukung line breaks GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});

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
 * Bangun RAG Snapshot Super Lengkap (Semua Data Spesifikasi Hardware, Jaringan & Chromium APIs)
 */
export function buildSnapshot(): Record<string, unknown> {
  const s = getSession();
  const v = buildVerdict();

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

  const glInfo = getWebGLInfo();
  const perfMem = getPerfMemory();
  const dtf = Intl.DateTimeFormat().resolvedOptions();
  const nav = navigator as any;

  const dpr = window.devicePixelRatio || 1;
  const screenW = Math.round(screen.width * dpr);
  const screenH = Math.round(screen.height * dpr);

  const deepSpecs = {
    identitas_perangkat: {
      model_terdeteksi: s.entries['device']?.value || '—',
      catatan_device: s.entries['device']?.note || '—',
      platform: nav.userAgentData?.platform || nav.platform || 'Android',
      mobile_flag: nav.userAgentData?.mobile ?? true,
      user_agent_lengkap: navigator.userAgent,
    },
    jaringan_dan_ip: {
      ip_publik_dan_isp: s.entries['network_ip']?.value || s.entries['ip_network']?.value || 'Memuat...',
      catatan_jaringan_lengkap: s.entries['network_ip']?.note || s.entries['ip_network']?.note || '—',
      status_online: navigator.onLine ? 'Online Terhubung' : 'Offline Terputus',
      media_transmisi_fisik: s.entries['connection']?.value || 'Wi-Fi / LAN',
      tipe_koneksi_browser: nav.connection?.effectiveType || '4G/Broadband',
      downlink_est: nav.connection?.downlink ? `≈ ${nav.connection.downlink} Mbps` : '—',
      rtt_latency: nav.connection?.rtt ? `≈ ${nav.connection.rtt} ms` : '—',
      mode_hemat_data: nav.connection?.saveData ? 'Aktif' : 'Nonaktif',
    },
    hardware_dan_cpu: {
      cpu_cores_threads: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} Cores` : '—',
      ram_kapasitas_est: nav.deviceMemory ? `≥ ${nav.deviceMemory} GB RAM` : 'Tidak di-expose',
      max_touch_points: `${navigator.maxTouchPoints ?? 1} Titik Sentuh`,
      bahasa_browser: navigator.language,
      daftar_bahasa: navigator.languages?.join(', ') || navigator.language,
    },
    layar_dan_display: {
      resolusi_fisik_aktual: `${screenW} × ${screenH} px`,
      viewport_css: `${window.innerWidth} × ${window.innerHeight} px`,
      pixel_ratio_dpr: `${dpr.toFixed(2)}x Density`,
      color_depth: `${screen.colorDepth || 24}-bit`,
      hdr_support: matchMedia('(dynamic-range: high)').matches ? 'Ya (High Dynamic Range)' : 'SDR Standard',
      color_gamut: matchMedia('(color-gamut: p3)').matches ? 'Display-P3 (Wide Gamut)' : 'sRGB Standard',
      orientasi: screen.orientation?.type || (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'),
      tema_os: matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark Mode' : 'Light Mode',
    },
    gpu_dan_grafis: {
      chipset_renderer: glInfo.renderer,
      vendor_hardware: glInfo.vendor,
      webgl_version: glInfo.version,
      webgl2_support: glInfo.hasWebGL2 ? 'Aktif & Didukung' : 'Tidak',
      webgpu_support: 'gpu' in navigator ? 'Didukung Browser' : 'Belum Diaktifkan',
      max_texture_size: glInfo.maxTexture ? `${glInfo.maxTexture} px` : '—',
    },
    baterai: {
      status_terbaca: s.entries['battery']?.value || '—',
      catatan_baterai: s.entries['battery']?.note || '—',
    },
    penyimpanan_browser: {
      status_storage: s.entries['storage']?.value || '—',
      catatan_storage: s.entries['storage']?.note || '—',
      opfs_private_filesystem: 'getDirectory' in (navigator.storage || {}) ? 'Mendukung' : 'Tidak',
      indexed_db: 'indexedDB' in window ? 'Tersedia' : 'Nonaktif',
    },
    sensor_dan_hardware_apis: {
      gyroscope_accelerometer: 'DeviceOrientationEvent' in window ? 'Tersedia di Hardware' : 'Tidak',
      vibration_motor: 'vibrate' in navigator ? 'Tersedia (Vibration API)' : 'Tidak',
      screen_wake_lock: 'wakeLock' in navigator ? 'Mendukung (Wake Lock API)' : 'Tidak',
      web_nfc: 'NDEFReader' in window ? 'Hardware NFC Terdeteksi' : 'Tidak di-expose browser',
      web_bluetooth: 'bluetooth' in navigator ? 'Mendukung BLE' : 'Nonaktif',
      web_usb: 'usb' in navigator ? 'Mendukung WebUSB Direct' : 'Nonaktif',
      web_serial: 'serial' in navigator ? 'Mendukung Serial Ports' : 'Nonaktif',
      web_hid: 'hid' in navigator ? 'Mendukung Human Interface Devices' : 'Nonaktif',
      gamepad_controller: 'getGamepads' in navigator ? 'Mendukung Stik Gamepad' : 'Tidak',
    },
    audio_dan_multimedia: {
      web_audio: 'AudioContext' in window || 'webkitAudioContext' in window ? 'Mendukung AudioContext' : 'Tidak',
      media_devices: 'mediaDevices' in navigator ? 'Mendukung (Kamera & Mic)' : 'Tidak',
      media_recorder: 'MediaRecorder' in window ? 'Mendukung Rekam Audio/Video' : 'Tidak',
      speech_synthesis_tts: 'speechSynthesis' in window ? 'Aktif' : 'Tidak',
      speech_recognition_stt: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window ? 'Aktif' : 'Tidak',
    },
    memori_js_heap_v8: perfMem,
    waktu_dan_wilayah: {
      timezone: dtf.timeZone,
      locale: dtf.locale,
      kalender: dtf.calendar || 'gregory',
      offset_utc: `${-new Date().getTimezoneOffset() / 60} Jam`,
      jam_lokal: new Date().toLocaleString('id-ID'),
    },
    keamanan_dan_web_features: {
      pwa_mode: matchMedia('(display-mode: standalone)').matches ? 'Standalone App' : 'Browser Tab',
      service_worker: 'serviceWorker' in navigator ? 'Aktif (Offline Cache)' : 'Tidak',
      biometrik_webauthn_fido2: window.PublicKeyCredential ? 'Mendukung Fingerprint / Passkey' : 'Tidak',
      async_clipboard: 'clipboard' in navigator ? 'Akses Clipboard Aman' : 'Tidak',
      web_share_target: 'share' in navigator ? 'Native Mobile Share Aktif' : 'Tidak',
      secure_context: window.isSecureContext ? 'HTTPS / Secure Context' : 'Insecure',
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
      'Semua data ini diinspeksi secara live dari Web APIs perangkat user. Kamu memiliki seluruh konteks spesifikasi mulai dari Model HP, Jaringan/ISP, Chipset CPU & GPU, Display Hz, Sensor, Storage, hingga Hasil Tes Hardware.',
  };
}

function getWebGLInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    const hasWebGL2 = !!canvas.getContext('webgl2');
    if (!gl) return { renderer: 'Tidak tersedia', vendor: 'Tidak tersedia', hasWebGL2, version: 'None' };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const version = gl.getParameter(gl.VERSION) || 'WebGL 1.0/2.0';
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (!dbg) return { renderer: 'Di-masking browser', vendor: 'Di-masking browser', hasWebGL2, version, maxTexture };
    return {
      renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string,
      vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string,
      hasWebGL2,
      version,
      maxTexture,
    };
  } catch {
    return { renderer: 'Gagal dibaca', vendor: 'Gagal dibaca', hasWebGL2: false, version: 'Error' };
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
    tekanan_memori: `${((m.usedJSHeapSize / m.jsHeapSizeLimit) * 100).toFixed(1)}%`,
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
  const snapshot = buildSnapshot();
  return streamPost('/api/ai', { mode: 'analyze', snapshot }, h, signal);
}

/**
 * Konsultasi chat dengan Dokter Device (Mengirim riwayat chat history agar selalu ingat konteks sebelumnya)
 */
export function requestChat(
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  h: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const snapshot = buildSnapshot();
  return streamPost('/api/ai', { mode: 'chat', question, history, snapshot }, h, signal);
}

/**
 * Helper untuk me-render string Markdown menjadi HTML terstruktur via 'marked'
 */
export function renderMarkdown(rawMd: string): string {
  if (!rawMd) return '';
  try {
    return marked.parse(rawMd) as string;
  } catch {
    return rawMd;
  }
}
