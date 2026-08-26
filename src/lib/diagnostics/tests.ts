/**
 * Diagnostic tests — 9 test interaktif, vanilla TypeScript murni
 * (tanpa React) supaya payload JS tetap minimal.
 *
 * Aturan main:
 * - Permission DIMINTA on-demand, dengan penjelasan SEBELUM prompt browser.
 * - API nggak didukung → tombol disembunyikan/dinonaktifkan + pesan jelas
 *   bahwa itu keterbatasan browser, BUKAN device bermasalah.
 * - Gagal/izin ditolak → pesan tampil di layar + saran langkah berikutnya.
 */
import { $ } from '../dom';
import { setEntry } from './store';
import type { Status } from './types';
import { isIOS } from '../dom';

/* ------------------------------------------------------------------ */
/* Overlay fullscreen bersama                                          */
/* ------------------------------------------------------------------ */

const overlayEl = () => $('#test-overlay') as HTMLElement | null;

function openOverlay(title: string): { body: HTMLDivElement; close: () => void } {
  const ov = overlayEl();
  if (!ov) throw new Error('overlay missing');
  ov.innerHTML = `
    <div class="mx-auto flex h-full max-w-xl flex-col">
      <div class="flex items-center justify-between gap-3 border-b-[3px] border-border bg-card px-4 py-3">
        <h2 class="font-heading text-lg font-bold">${title}</h2>
        <button type="button" data-close class="border-2 border-border bg-secondary-background px-3 py-1 font-base text-sm font-semibold" style="box-shadow:3px 3px 0 0 var(--border)">✕ Tutup</button>
      </div>
      <div data-body class="flex flex-1 flex-col items-center justify-center gap-5 p-4"></div>
    </div>`;
  ov.dataset.active = 'true';
  document.documentElement.style.overflow = 'hidden';
  const close = () => {
    cleanupCurrent();
    ov.dataset.active = 'false';
    ov.innerHTML = '';
    document.documentElement.style.overflow = '';
  };
  ov.querySelector('[data-close]')?.addEventListener('click', close);
  return { body: ov.querySelector('[data-body]') as HTMLDivElement, close };
}

/** Stop-hook buat resource yang harus dibersihin (stream/audio/watcher). */
let cleanupCurrent: () => void = () => {};

function finish(
  id: string,
  status: Status,
  note: string,
  value?: string,
  after?: () => void,
) {
  setEntry(id, { status, note, value });
  cleanupCurrent();
  const ov = overlayEl();
  if (ov) {
    ov.dataset.active = 'false';
    ov.innerHTML = '';
    document.documentElement.style.overflow = '';
  }
  after?.();
}

/** Dialog konfirmasi akhir buat test manual — hasil ditentukan user. */
function verdictButtons(
  box: HTMLElement,
  opts: { pass: string; fail: string; onPass: () => void; onFail: () => void },
) {
  const wrap = document.createElement('div');
  wrap.className = 'flex w-full max-w-xs flex-col gap-3 pt-2';
  const mk = (label: string, kind: 'pass' | 'fail') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className =
      kind === 'pass'
        ? 'w-full border-[3px] border-border bg-primary px-4 py-3 font-heading font-bold'
        : 'w-full border-[3px] border-border bg-critical px-4 py-3 font-heading font-bold';
    b.style.boxShadow = '5px 5px 0 0 var(--border)';
    return b;
  };
  const bp = mk(opts.pass, 'pass');
  const bf = mk(opts.fail, 'fail');
  bp.addEventListener('click', opts.onPass);
  bf.addEventListener('click', opts.onFail);
  wrap.append(bp, bf);
  box.append(wrap);
}

function infoLine(box: HTMLElement, html: string) {
  const p = document.createElement('p');
  p.className = 'text-center text-sm text-muted-foreground max-w-sm';
  p.innerHTML = html;
  box.append(p);
}

/* ------------------------------------------------------------------ */
/* 1. Layar sentuh                                                     */
/* ------------------------------------------------------------------ */

export function startTouchTest() {
  const { body, close } = openOverlay('Test Layar Sentuh');
  let missedHint = false;
  const cols = window.innerWidth < 420 ? 4 : 6;
  const rows = 9;
  const total = cols * rows;
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;width:100%;max-height:62vh;`;
  const cells: HTMLElement[] = [];
  for (let i = 0; i < total; i++) {
    const c = document.createElement('button');
    c.type = 'button';
    c.style.cssText =
      'aspect-ratio:1;border:2px solid var(--border);background:#fff;border-radius:2px;touch-action:none;';
    c.addEventListener('pointerdown', () => {
      c.style.background = 'var(--primary)';
      c.textContent = '✓';
    });
    cells.push(c);
    grid.append(c);
  }
  infoLine(body, 'Sentuh <b>semua kotak</b>. Kotak yang tidak berubah warna = kemungkinan dead zone sentuhan.');
  body.append(grid);
  verdictButtons(body, {
    pass: 'Semua kotak merespons',
    fail: 'Ada kotak yang tidak respons',
    onPass: () => finish('touch', 'pass', 'Semua area sentuh yang dicoba merespons.', `${total} kotak`),
    onFail: () => {
      missedHint = true;
      finish(
        'touch',
        'fail',
        'Ada area sentuh yang tidak respons — bisa indikasi digitizer bermasalah. Coba ulangi pelan-pelan untuk memastikan.',
        'dead zone terdeteksi',
      );
      void missedHint;
    },
  });
  // tombol tutup tetap available via header (close dipakai di sini biar tak unused)
  void close;
}

/* ------------------------------------------------------------------ */
/* 2. Layar / dead pixel                                               */
/* ------------------------------------------------------------------ */

export function startDisplayTest() {
  const { body } = openOverlay('Test Dead Pixel');
  const colors: [string, string][] = [
    ['#FF0000', 'Merah'],
    ['#00FF00', 'Hijau'],
    ['#0000FF', 'Biru'],
    ['#FFFFFF', 'Putih'],
    ['#000000', 'Hitam'],
  ];
  let idx = 0;
  const stage = document.createElement('div');
  stage.style.cssText =
    'position:absolute;inset:0;z-index:-1;display:flex;align-items:center;justify-content:center;';
  const label = document.createElement('div');
  label.style.cssText =
    'font-family:var(--font-mono);font-size:12px;background:rgba(255,255,255,.85);padding:4px 8px;border-radius:2px;color:#111;';
  const hint = document.createElement('p');
  hint.className = 'text-center text-sm text-muted-foreground max-w-xs';
  stage.append(label);
  body.parentElement?.append(stage);
  const paint = () => {
    const [c, name] = colors[idx];
    stage.style.background = c;
    label.textContent = `Warna ${idx + 1}/5 — ${name}`;
    hint.innerHTML =
      c === '#000000' || c === '#FFFFFF'
        ? 'Perhatikan titik/selaput aneh di layar. Geser ke warna berikutnya lalu selesai.'
        : 'Tap layar untuk lanjut ke warna berikutnya.';
    // teks header overlay perlu kontras di atas warna apapun:
    const hd = $('.test-overlay [data-body]');
    if (hd instanceof HTMLElement) hd.style.visibility = 'visible';
  };
  paint();
  const advance = (e: Event) => {
    e.stopPropagation();
    idx = (idx + 1) % colors.length;
    paint();
  };
  stage.addEventListener('click', advance);
  infoLine(body, 'Layar akan menampilkan warna solid satu per satu. Cari titik yang tidak ikut berubah warna (dead pixel).');
  verdictButtons(body, {
    pass: 'Layar bersih',
    fail: 'Ada dead pixel / noda',
    onPass: () => finish('display', 'pass', 'Tidak ada anomali piksel yang kamu temukan.', '5 warna dicek'),
    onFail: () =>
      finish('display', 'fail', 'Dead pixel/noda terdeteksi secara visual. Catat lokasinya kalau mau klaim garansi.', 'anomali terlihat'),
  });
  cleanupCurrent = () => stage.remove();
}

/* ------------------------------------------------------------------ */
/* 3. Speaker                                                          */
/* ------------------------------------------------------------------ */

export async function startSpeakerTest() {
  const { body } = openOverlay('Test Speaker');
  if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
    finish('speaker', 'unsupported', 'Web Audio API tidak tersedia di browser ini.');
    return;
  }
  type AC = typeof AudioContext;
  const Ctor: AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: AC }).webkitAudioContext;
  const ctx = new Ctor();
  const merger = ctx.createChannelMerger(2);
  merger.connect(ctx.destination);

  function beep(side: 'left' | 'right'): Promise<void> {
    return new Promise((resolve) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = side === 'left' ? 660 : 520;
      osc.type = 'sine';
      gain.gain.value = 0.35;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.001, ctx.currentTime);
      out.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      out.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
      osc.connect(gain).connect(out);
      out.connect(merger, 0, side === 'left' ? 0 : 1);
      osc.start();
      osc.stop(ctx.currentTime + 1.9);
      osc.onended = () => resolve();
    });
  }

  const status = { left: false, right: false };
  infoLine(body, 'Nada akan dibunyikan bergantian lewat speaker kiri lalu kanan (volume HP diperbesar ya).');
  const log = document.createElement('p');
  log.className = 'font-data text-sm';
  body.append(log);

  const playSeq = async () => {
    log.textContent = '▶ Nada KIRI…';
    await beep('left');
    await new Promise((r) => setTimeout(r, 600));
    log.textContent = '▶ Nada KANAN…';
    await beep('right');
    log.textContent = 'Selesai. Dengerin dua-duanya?';
    verdictButtons(body, {
      pass: 'Kedua sisi kedengeran',
      fail: 'Ada sisi yang bisu / pecah',
      onPass: () => finish('speaker', 'pass', 'Kedua channel speaker terkonfirmasi berbunyi.', 'L+R'),
      onFail: () =>
        finish('speaker', 'fail', 'Salah satu speaker tidak berbunyi/pecah — bisa indikasi speaker rusak atau mode mono aktif.', 'masalah di salah satu sisi'),
    });
  };
  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = '🔊 Bunyikan nada tes';
  go.className = 'border-[3px] border-border bg-primary px-5 py-3 font-heading font-bold';
  go.style.boxShadow = '5px 5px 0 0 var(--border)';
  go.addEventListener('click', () => {
    void ctx.resume().then(() => playSeq());
  });
  body.append(go);
  cleanupCurrent = () => void ctx.close().catch(() => {});
  void status;
}

/* ------------------------------------------------------------------ */
/* 4. Mikrofon                                                         */
/* ------------------------------------------------------------------ */

export async function startMicTest() {
  const { body } = openOverlay('Test Mikrofon');
  if (!navigator.mediaDevices?.getUserMedia) {
    finish('mic', 'unsupported', 'Browser ini tidak mendukung akses mikrofon.');
    return;
  }
  infoLine(body, 'Aku akan minta izin mikrofon buat menampilkan level suara live. Ngomong atau tepuk tangan, dan lihat barnya bergerak.');
  const btnWrap = document.createElement('div');
  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = '🎤 Izinkan mikrofon & mulai';
  go.className = 'border-[3px] border-border bg-primary px-5 py-3 font-heading font-bold';
  go.style.boxShadow = '5px 5px 0 0 var(--border)';
  btnWrap.append(go);
  body.append(btnWrap);

  const run = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const meterOuter = document.createElement('div');
      meterOuter.style.cssText = 'width:min(80vw,320px);height:26px;border:3px solid var(--border);background:#fff;';
      const meter = document.createElement('div');
      meter.style.cssText = 'height:100%;width:2%;background:var(--primary);transition:width .08s linear;';
      meterOuter.append(meter);
      const peakLabel = document.createElement('p');
      peakLabel.className = 'font-data text-sm';
      body.replaceChildren(meterOuter, peakLabel);
      let peak = 0;
      let moving = false;
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const pct = Math.min(100, Math.round(rms * 260));
        meter.style.width = `${Math.max(2, pct)}%`;
        if (rms > 0.04) moving = true;
        peak = Math.max(peak, rms);
        raf = requestAnimationFrame(tick);
      };
      tick();

      verdictButtons(body, {
        pass: 'Barnya bergerak saat suara masuk',
        fail: 'Barnya diam terus',
        onPass: () => finish('mic', 'pass', 'Mikrofon menangkap suara dengan baik.', `peak ${(peak * 100).toFixed(0)}%`),
        onFail: () =>
          finish('mic', 'fail', 'Level mikrofon tidak bergerak — cek apakah mic tertutup case, atau coba ulangi lebih dekat.', 'tidak ada input'),
      });

      cleanupCurrent = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => {});
      };
      void moving;
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError') {
        finish('mic', 'denied', 'Izin mikrofon ditolak — aktifkan lewat pengaturan browser (ikon gembok di address bar) lalu refresh halaman.');
      } else if (e.name === 'NotFoundError') {
        finish('mic', 'fail', 'Browser tidak menemukan mikrofon di perangkat ini.');
      } else {
        finish('mic', 'fail', `Mikrofon gagal diakses (${e.name}). Coba tutup aplikasi lain yang memakai mic.`);
      }
    }
  };
  go.addEventListener('click', () => void run());
}

/* ------------------------------------------------------------------ */
/* 5. Kamera                                                           */
/* ------------------------------------------------------------------ */

export async function startCameraTest() {
  const { body } = openOverlay('Test Kamera');
  if (!navigator.mediaDevices?.getUserMedia) {
    finish('camera', 'unsupported', 'Browser ini tidak mendukung akses kamera.');
    return;
  }
  infoLine(body, 'Aku akan minta izin kamera buat nampilin preview live. Kamu bisa ganti kamera depan/belakang dari tombol yang tersedia.');
  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = '📷 Izinkan kamera & mulai';
  go.className = 'border-[3px] border-border bg-primary px-5 py-3 font-heading font-bold';
  go.style.boxShadow = '5px 5px 0 0 var(--border)';
  body.append(go);

  const run = async (facing: 'environment' | 'user') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      const vid = document.createElement('video');
      vid.autoplay = true;
      vid.playsInline = true;
      vid.muted = true;
      vid.srcObject = stream;
      vid.style.cssText = 'width:min(88vw,480px);max-height:56vh;border:3px solid var(--border);background:#000;';
      const flip = document.createElement('button');
      flip.type = 'button';
      flip.textContent = facing === 'environment' ? '🤳 Ganti ke kamera depan' : '🔄 Ganti ke kamera belakang';
      flip.className = 'border-2 border-border bg-secondary-background px-4 py-2 font-base text-sm font-semibold';
      flip.style.boxShadow = '3px 3px 0 0 var(--border)';
      flip.addEventListener('click', () => {
        stream.getTracks().forEach((t) => t.stop());
        const next = facing === 'environment' ? 'user' : 'environment';
        cleanupCurrent = () => {};
        body.replaceChildren();
        void run(next);
      });
      body.replaceChildren(vid, flip);
      verdictButtons(body, {
        pass: 'Gambar tampil normal',
        fail: 'Gambar hitam / aneh',
        onPass: () => finish('camera', 'pass', `Preview kamera ${facing === 'user' ? 'depan' : 'belakang'} normal.`),
        onFail: () =>
          finish('camera', 'fail', 'Preview bermasalah walau izin diberikan — bisa indikasi modul kamera bermasalah.'),
      });
      cleanupCurrent = () => stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError') {
        finish('camera', 'denied', 'Izin kamera ditolak — aktifkan lewat pengaturan browser (ikon gembok di address bar) lalu coba lagi.');
      } else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
        finish('camera', 'warn', `Kamera ${facing === 'user' ? 'depan' : 'belakang'} tidak tersedia/ditemukan di perangkat ini.`);
      } else {
        finish('camera', 'fail', `Kamera gagal diakses (${e.name}). Tutup aplikasi kamera lain lalu ulangi.`);
      }
    }
  };
  go.addEventListener('click', () => void run('environment'));
}

/* ------------------------------------------------------------------ */
/* 6. Getar                                                            */
/* ------------------------------------------------------------------ */

export function initVibrateCard() {
  // Feature detect: tanpa navigator.vibrate → JANGAN bikin user mikir HP-nya rusak.
  const btn = $('#btn-vibrate') as HTMLButtonElement | null;
  const msg = $('[data-vibrate-msg]');
  if (typeof navigator.vibrate !== 'function') {
    if (btn) btn.hidden = true;
    if (msg instanceof HTMLElement) {
      msg.hidden = false;
      msg.textContent =
        'API getar tidak tersedia di browser ini (umumnya hanya Chrome Android). Ini keterbatasan browser, bukan kerusakan HP.';
    }
    setEntry('vibrate', { status: 'unsupported', note: 'navigator.vibrate tidak ada di browser ini.' });
  }
}

export function startVibrateTest() {
  if (typeof navigator.vibrate !== 'function') return;
  navigator.vibrate([300, 120, 300, 120, 500]);
  const { body } = openOverlay('Test Getar');
  infoLine(body, 'Pola getar dikirim. Rasakan HP-nya sekarang…');
  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = '🔁 Getarkan lagi';
  again.className = 'border-2 border-border bg-secondary-background px-4 py-2 font-base text-sm font-semibold';
  again.style.boxShadow = '3px 3px 0 0 var(--border)';
  again.addEventListener('click', () => navigator.vibrate([300, 120, 300, 120, 500]));
  body.append(again);
  verdictButtons(body, {
    pass: 'Getarannya kerasa',
    fail: 'Nggak kerasa apa-apa',
    onPass: () => finish('vibrate', 'pass', 'Motor getar merespons pola yang dikirim.', '~1.3s'),
    onFail: () => finish('vibrate', 'fail', 'Getaran tidak terasa — bisa indikasi motor getar mati, atau HP dalam mode silent tertentu.'),
  });
}

/* ------------------------------------------------------------------ */
/* 7. Sensor gerak & orientasi                                         */
/* ------------------------------------------------------------------ */

interface MotionPermissionCtor {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}
type DeviceOrientationCtor = (new () => DeviceOrientationEvent) & MotionPermissionCtor;

export async function startMotionTest() {
  const { body } = openOverlay('Test Sensor Gerak');
  const DOE = (window as unknown as { DeviceOrientationEvent?: DeviceOrientationCtor })
    .DeviceOrientationEvent;
  if (!DOE) {
    finish('motion', 'unsupported', 'Sensor orientasi tidak tersedia di browser ini.');
    return;
  }

  const startListening = () => {
    const pad = document.createElement('div');
    pad.style.cssText = 'position:relative;width:min(70vw,280px);aspect-ratio:1;border:3px solid var(--border);border-radius:9999px;background:#fff;';
    const dot = document.createElement('div');
    dot.style.cssText = 'position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px;border-radius:9999px;background:var(--secondary);border:3px solid var(--border);transition:transform .08s linear;';
    pad.append(dot);
    const readout = document.createElement('p');
    readout.className = 'font-data text-sm';
    body.replaceChildren(pad, readout);
    let samples = 0;
    let maxDelta = 0;
    const last = { b: 0, g: 0 };
    const onOri = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const cl = (v: number) => Math.max(-40, Math.min(40, v));
      dot.style.transform = `translate(${cl(gamma) * 1.7}%, ${cl(beta) * 1.7}%)`;
      readout.textContent = `β ${beta.toFixed(1)}° · γ ${gamma.toFixed(1)}°`;
      maxDelta = Math.max(maxDelta, Math.abs(beta - last.b) + Math.abs(gamma - last.g));
      last.b = beta;
      last.g = gamma;
      samples++;
    };
    window.addEventListener('deviceorientation', onOri);

    setTimeout(() => {
      window.removeEventListener('deviceorientation', onOri);
      const semiAuto = samples >= 15 && maxDelta > 1.5;
      infoLine(body, semiAuto ? 'Sensor merespons perubahan kemiringan ✓' : `Data sensor diterima (${samples} sampel). Miringkan HP — kalau bolanya ikut berguling, sensornya sehat.`);
      verdictButtons(body, {
        pass: 'Bola mengikuti kemiringan',
        fail: 'Bola diam / nilai mentok',
        onPass: () => finish('motion', semiAuto ? 'pass' : 'pass', 'Sensor gerak & orientasi merespons.', `${samples} sampel`),
        onFail: () => finish('motion', 'fail', 'Sensor tidak merespons pergerakan — bisa indikasi gyroscope/accelerometer bermasalah.'),
      });
    }, 5000);
    cleanupCurrent = () => window.removeEventListener('deviceorientation', onOri);
  };

  // iOS Safari WAJIB requestPermission dari user gesture
  if (typeof DOE.requestPermission === 'function') {
    infoLine(body, 'Di iPhone/iPad, aku harus minta izin sensor gerak dulu (dipicu dari tombol ini).');
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = '📲 Izinkan sensor gerak';
    go.className = 'border-[3px] border-border bg-primary px-5 py-3 font-heading font-bold';
    go.style.boxShadow = '5px 5px 0 0 var(--border)';
    go.addEventListener('click', () => {
      DOE.requestPermission!()
        .then((res) => {
          if (res === 'granted') startListening();
          else finish('motion', 'denied', 'Izin sensor gerak ditolak — aktifkan di Pengaturan › Safari › Motion & Orientation Access (atau pengaturan situs).');
        })
        .catch(() => finish('motion', 'denied', 'Permintaan izin sensor gagal. Coba lagi dari tombol.'));
    });
    body.append(go);
  } else {
    infoLine(body, 'Miringkan HP-nya selama beberapa detik — bola harusnya ikut berguling mengikuti kemiringan.');
    startListening();
  }
  void isIOS;
}

/* ------------------------------------------------------------------ */
/* 8. Benchmark CPU/GPU                                                */
/* ------------------------------------------------------------------ */

export function startBenchmark() {
  const { body } = openOverlay('Benchmark Performa');
  const cv = document.createElement('canvas');
  cv.width = Math.min(window.innerWidth, 480);
  cv.height = 300;
  cv.style.cssText = 'border:3px solid var(--border);background:#fff;width:100%;';
  const label = document.createElement('p');
  label.className = 'font-data text-sm';
  body.append(cv, label);
  const ctx = cv.getContext('2d');
  if (!ctx) {
    finish('benchmark', 'unsupported', 'Canvas 2D tidak tersedia — benchmark tidak bisa jalan.');
    return;
  }
  interface P { x: number; y: number; vx: number; vy: number; r: number }
  const N = 220;
  const parts: P[] = Array.from({ length: N }, () => ({
    x: Math.random() * cv.width,
    y: Math.random() * cv.height,
    vx: (Math.random() - 0.5) * 3.2,
    vy: (Math.random() - 0.5) * 3.2,
    r: 4 + Math.random() * 14,
  }));
  const DUR = 6000;
  const t0 = performance.now();
  let frames = 0;
  let worstSpan = 0;
  let prev = t0;
  const loop = (now: number) => {
    const span = now - prev;
    if (span > worstSpan) worstSpan = span;
    prev = now;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.shadowColor = '#26241F';
    ctx.shadowBlur = 8;
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > cv.width) p.vx *= -1;
      if (p.y < 0 || p.y > cv.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'var(--signature)';
      ctx.fill();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    const elapsed = now - t0;
    label.textContent = `${(elapsed / 1000).toFixed(1)}s · ${(frames * 1000) / Math.max(1, elapsed)} fps`;
    if (elapsed < DUR) {
      requestAnimationFrame(loop);
    } else {
      const fps = Math.round((frames * 1000) / DUR);
      let status: Status = 'pass';
      let note = 'Skor relatif/indikatif — bandingkan antar kondisi HP yang sama (bukan antar HP beda kelas).';
      if (fps < 30) {
        status = 'fail';
        note = 'Performa terasa lambat — tutup tab/app lain atau restart HP. Kalau HP kerasa panas, ini bisa indikasi thermal throttling.';
      } else if (fps < 45) {
        status = 'warn';
        note = 'FPS sedang di bawah nyaman — coba ulangi saat HP dingin dan tanpa app lain untuk perbandingan adil.';
      }
      finish('benchmark', status, note, `${fps} fps`, () => {});
    }
    frames++;
  };
  requestAnimationFrame(loop);
  cleanupCurrent = () => {};
}

/* ------------------------------------------------------------------ */
/* 9. GPS                                                              */
/* ------------------------------------------------------------------ */

export function startGpsTest() {
  const { body } = openOverlay('Test GPS');
  if (!('geolocation' in navigator)) {
    finish('gps', 'unsupported', 'Geolocation tidak tersedia di browser ini.');
    return;
  }
  infoLine(body, 'Aku akan minta izin lokasi buat ngukur presisi GPS (accuracy makin kecil = makin bagus). Data lokasi cuma dipakai di perangkatmu, nggak dikirim ke mana pun.');
  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = '🛰️ Izinkan lokasi & ukur';
  go.className = 'border-[3px] border-border bg-primary px-5 py-3 font-heading font-bold';
  go.style.boxShadow = '5px 5px 0 0 var(--border)';
  body.append(go);

  const run = () => {
    const readout = document.createElement('p');
    readout.className = 'font-data text-sm text-center';
    body.replaceChildren(readout);
    readout.textContent = 'Mencari satelit…';
    const accs: number[] = [];
    let done = false;
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        accs.push(pos.coords.accuracy);
        const best = Math.min(...accs);
        readout.innerHTML = `Sampel: ${accs.length} · Accuracy terbaik: <b>${best.toFixed(0)} m</b>`;
        if (!done && accs.length >= 6) {
          done = true;
          navigator.geolocation.clearWatch(wid);
          const bestAcc = Math.min(...accs);
          let status: Status = 'pass';
          let note = 'Kunci GPS cukup presisi.';
          if (bestAcc > 50) {
            status = 'fail';
            note = 'Presisi GPS rendah — coba di area terbuka, jauhkan dari dinding tebal/jendela kaca.';
          } else if (bestAcc > 20) {
            status = 'warn';
            note = 'Presisi GPS sedang — masih wajar di dalam ruangan, ulangi di luar untuk hasil terbaik.';
          }
          finish('gps', status, note, `±${bestAcc.toFixed(0)} m`);
        }
      },
      (err) => {
        navigator.geolocation.clearWatch(wid);
        if (err.code === err.PERMISSION_DENIED) {
          finish('gps', 'denied', 'Izin lokasi ditolak — beri izin lewat pengaturan situs di browser, lalu ulangi.');
        } else {
          finish('gps', 'fail', `GPS gagal (${err.message}). Coba pindah ke tempat lebih terbuka.`);
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
    cleanupCurrent = () => navigator.geolocation.clearWatch(wid);
  };
  go.addEventListener('click', run);
}
