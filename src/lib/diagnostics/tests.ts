/**
 * Diagnostic tests — 9 test interaktif hardware & Web APIs
 * Didesain responsif, mobile-first, edge-to-edge, dan akurat (Full SVG Icons).
 */
import { $ } from '../dom';
import { setEntry } from './store';
import type { Status } from './types';

const overlayEl = () => $('#test-overlay') as HTMLElement | null;

/** Buka overlay layar penuh */
function openOverlay(title: string, opts: { clean?: boolean } = {}): { body: HTMLDivElement; close: () => void } {
  const ov = overlayEl();
  if (!ov) throw new Error('overlay container missing');
  
  if (opts.clean) {
    ov.innerHTML = `<div data-body class="relative w-full h-full"></div>`;
  } else {
    ov.innerHTML = `
      <div class="mx-auto flex h-full max-w-xl flex-col bg-card border-x-0 sm:border-x-[3px] border-border shadow-2xl">
        <div class="flex items-center justify-between gap-3 border-b-[3px] border-border bg-card px-4 py-3">
          <h2 class="font-heading text-base font-extrabold text-foreground">${title}</h2>
          <button type="button" data-close class="dd-btn bg-secondary-background px-3 py-1 text-xs font-bold">✕ Tutup</button>
        </div>
        <div data-body class="flex flex-1 flex-col items-center justify-center gap-4 p-4 overflow-y-auto"></div>
      </div>`;
  }

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

function verdictButtons(
  box: HTMLElement,
  opts: { pass: string; fail: string; onPass: () => void; onFail: () => void },
) {
  const wrap = document.createElement('div');
  wrap.className = 'flex w-full max-w-xs flex-col gap-2.5 pt-2';
  const mk = (label: string, kind: 'pass' | 'fail') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className =
      kind === 'pass'
        ? 'w-full dd-btn bg-healthy py-3 text-sm font-bold text-black'
        : 'w-full dd-btn bg-critical py-3 text-sm font-bold text-white';
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
  p.className = 'text-center text-xs text-muted-foreground max-w-sm leading-relaxed';
  p.innerHTML = html;
  box.append(p);
}

/* ------------------------------------------------------------------ */
/* 1. Layar Sentuh (Edge-to-Edge Grid Touch Matrix)                   */
/* ------------------------------------------------------------------ */

export function startTouchTest() {
  const { body } = openOverlay('Test Layar Sentuh', { clean: true });
  
  const cols = 6;
  const rows = 10;
  const total = cols * rows;
  let touchedCount = 0;

  const container = document.createElement('div');
  container.className = 'fixed inset-0 z-[110] bg-black select-none touch-none flex flex-col';

  const topBar = document.createElement('div');
  topBar.className = 'absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none';
  topBar.innerHTML = `
    <span class="dd-btn bg-card text-foreground px-3 py-1 text-xs font-data font-bold pointer-events-auto">
      Sentuh Semua Kotak (<span id="touch-counter">0</span>/${total})
    </span>
    <button id="touch-exit" class="dd-btn bg-secondary-background px-3 py-1 text-xs font-bold pointer-events-auto">
      Selesai / Keluar
    </button>
  `;
  container.append(topBar);

  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr);gap:2px;width:100vw;height:100vh;padding:2px;background:#111;`;

  const cells: HTMLDivElement[] = [];

  for (let i = 0; i < total; i++) {
    const c = document.createElement('div');
    c.style.cssText = 'background:#222;border:1px solid #333;border-radius:2px;transition:background .1s ease;';
    cells.push(c);
    grid.append(c);
  }

  const markCell = (el: Element | null) => {
    if (el && cells.includes(el as HTMLDivElement) && (el as HTMLDivElement).dataset.touched !== 'true') {
      (el as HTMLDivElement).dataset.touched = 'true';
      (el as HTMLDivElement).style.background = 'var(--status-healthy, #52B788)';
      (el as HTMLDivElement).style.borderColor = '#2D6A4F';
      touchedCount++;
      const counter = container.querySelector('#touch-counter');
      if (counter) counter.textContent = String(touchedCount);

      if (touchedCount === total) {
        setTimeout(() => {
          finish('touch', 'pass', 'Seluruh area layar sentuh (100% grid) merespons sempurna.', `${total}/${total} blok`);
        }, 300);
      }
    }
  };

  const onPointer = (e: PointerEvent | TouchEvent) => {
    if ('touches' in e) {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        markCell(el);
      }
    } else {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      markCell(el);
    }
  };

  grid.addEventListener('pointerdown', onPointer);
  grid.addEventListener('pointermove', onPointer);
  grid.addEventListener('touchstart', onPointer, { passive: true });
  grid.addEventListener('touchmove', onPointer, { passive: true });

  container.append(grid);
  body.append(container);

  container.querySelector('#touch-exit')?.addEventListener('click', () => {
    const ratio = touchedCount / total;
    if (ratio >= 0.95) {
      finish('touch', 'pass', `Area layar sentuh responsif (${touchedCount}/${total} kotak).`, `${Math.round(ratio * 100)}% coverage`);
    } else {
      finish('touch', 'warn', `Beberapa kotak tidak tersentuh (${touchedCount}/${total}). Cek dead zone pada layar.`, `${Math.round(ratio * 100)}% coverage`);
    }
  });

  cleanupCurrent = () => container.remove();
}

/* ------------------------------------------------------------------ */
/* 2. Dead Pixel (Fullscreen 8 Warna Solid Murni)                     */
/* ------------------------------------------------------------------ */

export function startDisplayTest() {
  const { body } = openOverlay('Test Dead Pixel', { clean: true });
  const colors: [string, string][] = [
    ['#FF0000', 'Merah Murni (Red)'],
    ['#00FF00', 'Hijau Murni (Green)'],
    ['#0000FF', 'Biru Murni (Blue)'],
    ['#FFFFFF', 'Putih Terang (White)'],
    ['#000000', 'Hitam Pekat (Black)'],
    ['#FFFF00', 'Kuning (Yellow)'],
    ['#00FFFF', 'Cyan'],
    ['#FF00FF', 'Magenta'],
  ];

  let idx = 0;

  const stage = document.createElement('div');
  stage.className = 'fixed inset-0 z-[120] select-none flex flex-col justify-between p-4 cursor-pointer';

  const hintBar = document.createElement('div');
  hintBar.className = 'self-center px-3 py-1.5 rounded-base bg-black/75 text-white font-data text-xs border border-white/20 shadow-lg';
  
  const bottomBar = document.createElement('div');
  bottomBar.className = 'flex items-center justify-between w-full max-w-md mx-auto';
  bottomBar.innerHTML = `
    <button id="dp-prev" class="dd-btn bg-card text-foreground px-3 py-1.5 text-xs font-bold shadow-md">◀ Warna Lalu</button>
    <button id="dp-done" class="dd-btn bg-healthy text-black px-4 py-1.5 text-xs font-extrabold shadow-md">Selesai Tes</button>
    <button id="dp-next" class="dd-btn bg-card text-foreground px-3 py-1.5 text-xs font-bold shadow-md">Warna Berikut ▶</button>
  `;

  stage.append(hintBar, bottomBar);
  body.append(stage);

  const paint = () => {
    const [colorHex, colorName] = colors[idx];
    stage.style.background = colorHex;
    hintBar.textContent = `Warna ${idx + 1}/${colors.length} : ${colorName} — Tap layar untuk ganti`;
  };

  paint();

  stage.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    idx = (idx + 1) % colors.length;
    paint();
  });

  stage.querySelector('#dp-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    idx = (idx + 1) % colors.length;
    paint();
  });

  stage.querySelector('#dp-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    idx = (idx - 1 + colors.length) % colors.length;
    paint();
  });

  stage.querySelector('#dp-done')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const { body: vBody } = openOverlay('Hasil Test Dead Pixel');
    infoLine(vBody, 'Apakah kamu melihat titik hitam, titik warna macet, garis vertikal, atau noda (burn-in) selama pergantian 8 warna?');
    verdictButtons(vBody, {
      pass: 'Layar Bersih & Normal',
      fail: 'Ada Dead Pixel / Noda',
      onPass: () => finish('display', 'pass', 'Layar bersih tanpa dead pixel di 8 spektrum warna.', '8 warna solid lolos'),
      onFail: () => finish('display', 'fail', 'Terdeteksi anomali dead pixel/stuck pixel pada layar.', 'titik abnormal terdeteksi'),
    });
  });

  cleanupCurrent = () => stage.remove();
}

/* ------------------------------------------------------------------ */
/* 3. Speaker Stereo L & R                                            */
/* ------------------------------------------------------------------ */

export async function startSpeakerTest() {
  const { body } = openOverlay('Test Speaker Stereo (Kiri & Kanan)');
  if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
    finish('speaker', 'unsupported', 'Web Audio API tidak didukung browser ini.');
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
      osc.frequency.value = side === 'left' ? 600 : 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
      osc.connect(gain);
      gain.connect(merger, 0, side === 'left' ? 0 : 1);
      osc.start();
      osc.stop(ctx.currentTime + 1.9);
      osc.onended = () => resolve();
    });
  }

  infoLine(body, 'Pastikan volume HP dinaikkan. Nada tes frekuensi akan dibunyikan di speaker Kiri lalu Kanan.');

  const log = document.createElement('div');
  log.className = 'w-full py-4 text-center font-data text-sm font-bold bg-secondary-background rounded-base border-2 border-border';
  log.textContent = 'Tekan tombol di bawah untuk mulai memutar nada';
  body.append(log);

  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = 'Putar Nada Stereo';
  go.className = 'dd-btn bg-main px-6 py-3 font-heading font-extrabold text-sm';
  
  go.addEventListener('click', async () => {
    await ctx.resume();
    go.disabled = true;
    log.textContent = '◀ Memutar Kanal KIRI (600 Hz)…';
    log.style.background = 'var(--status-attention, #F3D57E)';
    await beep('left');
    await new Promise((r) => setTimeout(r, 600));
    log.textContent = '▶ Memutar Kanal KANAN (800 Hz)…';
    log.style.background = 'var(--status-healthy, #52B788)';
    await beep('right');
    log.textContent = 'Selesai! Apakah kedua suara terdengar jelas & seimbang?';
    log.style.background = 'var(--secondary-background)';
    go.disabled = false;

    verdictButtons(body, {
      pass: 'Kedua Kanal Bunyi Jelas',
      fail: 'Salah Satu Bisu / Kresek',
      onPass: () => finish('speaker', 'pass', 'Speaker stereo kiri & kanan berbunyi normal.', 'Stereo L+R OK'),
      onFail: () => finish('speaker', 'fail', 'Salah satu speaker tidak berbunyi atau terdistorsi.', 'anomali speaker'),
    });
  });

  body.append(go);
  cleanupCurrent = () => void ctx.close().catch(() => {});
}

/* ------------------------------------------------------------------ */
/* 4. Mikrofon Live Decibel Meter                                     */
/* ------------------------------------------------------------------ */

export async function startMicTest() {
  const { body } = openOverlay('Test Mikrofon Real-Time');
  infoLine(body, 'Uji sensitivitas input mic HP dengan berbicara atau membuat suara di sekitar perangkat.');

  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = 'Aktifkan Mic & Ukur Level';
  go.className = 'dd-btn bg-main px-6 py-3 font-heading font-extrabold text-sm';
  body.append(go);

  go.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);

      const barWrap = document.createElement('div');
      barWrap.className = 'w-full flex flex-col gap-2 p-4 bg-secondary-background rounded-base border-2 border-border';
      barWrap.innerHTML = `
        <div class="flex justify-between font-data text-xs font-bold">
          <span>Tingkat Volume Live</span>
          <span id="mic-val">0 dB</span>
        </div>
        <div class="dd-meter h-5">
          <span id="mic-bar" style="width:0%"></span>
        </div>
      `;
      body.replaceChildren(barWrap);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let animId: number;
      let peakLevel = 0;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        peakLevel = Math.max(peakLevel, pct);
        const bar = barWrap.querySelector('#mic-bar') as HTMLElement;
        const val = barWrap.querySelector('#mic-val');
        if (bar) bar.style.width = `${pct}%`;
        if (val) val.textContent = `${pct}% (${pct > 15 ? 'Suara Terdeteksi' : 'Hening'})`;
        animId = requestAnimationFrame(tick);
      };
      tick();

      verdictButtons(body, {
        pass: 'Mic Menangkap Suara',
        fail: 'Tidak Ada Input Suara',
        onPass: () => finish('mic', 'pass', 'Mikrofon berfungsi dan menangkap fluktuasi input suara.', `Peak: ${peakLevel}%`),
        onFail: () => finish('mic', 'fail', 'Mikrofon tidak merekam input suara apa pun.', 'flat response'),
      });

      cleanupCurrent = () => {
        cancelAnimationFrame(animId);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
    } catch {
      finish('mic', 'denied', 'Izin akses mikrofon ditolak atau device mic sibuk.');
    }
  });
}

/* ------------------------------------------------------------------ */
/* 5. Kamera Preview Depan & Belakang                                 */
/* ------------------------------------------------------------------ */

export function startCameraTest() {
  const { body } = openOverlay('Test Modul Kamera');
  infoLine(body, 'Memeriksa kejelasan sensor kamera belakang dan depan HP kamu.');

  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = 'Buka Kamera';
  go.className = 'dd-btn bg-main px-6 py-3 font-heading font-extrabold text-sm';
  body.append(go);

  const run = async (facing: 'environment' | 'user') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 } },
      });
      const vid = document.createElement('video');
      vid.autoplay = true;
      vid.playsInline = true;
      vid.muted = true;
      vid.srcObject = stream;
      vid.className = 'w-full max-h-[48vh] rounded-base border-[3px] border-border bg-black object-contain shadow-[4px_4px_0_0_var(--border)]';

      const flip = document.createElement('button');
      flip.type = 'button';
      flip.textContent = facing === 'environment' ? 'Coba Kamera Depan' : 'Coba Kamera Belakang';
      flip.className = 'dd-btn bg-secondary-background px-4 py-2 text-xs font-bold';
      flip.addEventListener('click', () => {
        stream.getTracks().forEach((t) => t.stop());
        const next = facing === 'environment' ? 'user' : 'environment';
        body.replaceChildren();
        void run(next);
      });

      body.replaceChildren(vid, flip);

      verdictButtons(body, {
        pass: 'Preview Jernih & Normal',
        fail: 'Kamera Rusak / Gelap',
        onPass: () => finish('camera', 'pass', `Kamera ${facing === 'user' ? 'depan' : 'belakang'} berfungsi normal.`, 'Stream OK'),
        onFail: () => finish('camera', 'fail', 'Tampilan kamera gelap atau terjadi distorsi sensor.', 'gangguan optik'),
      });

      cleanupCurrent = () => stream.getTracks().forEach((t) => t.stop());
    } catch {
      finish('camera', 'denied', 'Izin kamera ditolak atau tidak ada modul video.');
    }
  };

  go.addEventListener('click', () => void run('environment'));
}

/* ------------------------------------------------------------------ */
/* 6. Getar (Multi-Pattern Vibration & Diagnostic Suite)              */
/* ------------------------------------------------------------------ */

export function startVibrateTest() {
  const hasVibrate = typeof navigator.vibrate === 'function';

  const doVibrate = (pattern: number | number[]) => {
    try {
      if (hasVibrate) {
        return navigator.vibrate(pattern);
      }
    } catch (e) {
      console.warn('Vibrate call exception:', e);
    }
    return false;
  };

  const initialResult = doVibrate([500, 150, 500, 150, 800]);

  const { body } = openOverlay('Test Motor Getaran HP (Haptic)');

  const statusBox = document.createElement('div');
  statusBox.className = 'w-full p-3 bg-secondary-background rounded-base border-2 border-border font-data text-xs flex flex-col gap-1.5';
  statusBox.innerHTML = `
    <div class="flex justify-between">
      <span>API Support:</span>
      <span class="font-bold ${hasVibrate ? 'text-healthy' : 'text-critical'}">${hasVibrate ? 'navigator.vibrate Didukung' : 'Tidak Ada di Browser Ini'}</span>
    </div>
    <div class="flex justify-between">
      <span>Return Status Eksekusi:</span>
      <span class="font-bold ${initialResult ? 'text-healthy' : 'text-attention'}">${initialResult ? 'Sinyal Diterima Kernel' : 'Sinyal Dikirim (Kernel Return: false/void)'}</span>
    </div>
  `;
  body.append(statusBox);

  infoLine(body, 'Pilih berbagai pola getaran di bawah untuk memicu motor haptic HP kamu:');

  const patternGrid = document.createElement('div');
  patternGrid.className = 'grid grid-cols-2 gap-2 w-full max-w-xs';
  patternGrid.innerHTML = `
    <button id="vibe-long" class="dd-btn bg-main py-2 px-3 text-xs font-extrabold shadow-sm">
      Getar Panjang (1 Detik)
    </button>
    <button id="vibe-burst" class="dd-btn bg-main py-2 px-3 text-xs font-extrabold shadow-sm">
      Pola Burst (3x Cepat)
    </button>
    <button id="vibe-sos" class="dd-btn bg-main py-2 px-3 text-xs font-extrabold shadow-sm">
      Pola SOS Haptic
    </button>
    <button id="vibe-pulse" class="dd-btn bg-main py-2 px-3 text-xs font-extrabold shadow-sm">
      Denyut Jantung
    </button>
  `;
  body.append(patternGrid);

  patternGrid.querySelector('#vibe-long')?.addEventListener('click', (e) => {
    e.stopPropagation();
    doVibrate(1000);
  });
  patternGrid.querySelector('#vibe-burst')?.addEventListener('click', (e) => {
    e.stopPropagation();
    doVibrate([150, 80, 150, 80, 150]);
  });
  patternGrid.querySelector('#vibe-sos')?.addEventListener('click', (e) => {
    e.stopPropagation();
    doVibrate([100, 50, 100, 50, 100, 150, 300, 100, 300, 100, 300, 150, 100, 50, 100, 50, 100]);
  });
  patternGrid.querySelector('#vibe-pulse')?.addEventListener('click', (e) => {
    e.stopPropagation();
    doVibrate([300, 200, 600, 400, 300, 200, 600]);
  });

  const pocoNote = document.createElement('p');
  pocoNote.className = 'text-[11px] text-muted-foreground p-2.5 bg-card rounded-base border border-dashed border-border leading-relaxed text-center';
  pocoNote.innerHTML = `Tips Xiaomi / POCO / Android: Pastikan <b>"Umpan Balik Haptik / Getaran Sentuh"</b> di <i>Setelan &gt; Suara &amp; Getaran</i> HP kamu dalam kondisi aktif & level getaran dinaikkan.`;
  body.append(pocoNote);

  verdictButtons(body, {
    pass: 'Getaran Terasa Jelas',
    fail: 'Sama Sekali Tidak Ada Getar',
    onPass: () => finish('vibrate', 'pass', 'Motor getar / linear haptic motor merespons pola sinyal.', 'Haptic OK'),
    onFail: () => finish('vibrate', 'fail', 'Getaran tidak terasa. Periksa setelan haptics OS atau kondisi motor fisik HP.', 'tidak ada respon'),
  });
}

/* ------------------------------------------------------------------ */
/* 7. Sensor Gerak 3D Bubble Level                                    */
/* ------------------------------------------------------------------ */

export function startMotionTest() {
  const { body } = openOverlay('Test Sensor Gerak (Gyroscope & Accelerometer)');
  infoLine(body, 'Miringkan HP kamu ke segala arah untuk melihat respons bola leveling.');

  const pad = document.createElement('div');
  pad.className = 'relative w-56 h-56 rounded-full border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)] overflow-hidden flex items-center justify-center';
  pad.innerHTML = `
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="w-20 h-20 rounded-full border-2 border-dashed border-border/50"></div>
    </div>
    <div id="gyro-dot" class="w-8 h-8 rounded-full bg-signature border-2 border-border shadow-md transition-transform duration-75"></div>
  `;
  const readout = document.createElement('p');
  readout.className = 'font-data text-xs font-bold';
  body.append(pad, readout);

  const dot = pad.querySelector('#gyro-dot') as HTMLElement;

  const onOri = (e: DeviceOrientationEvent) => {
    const beta = Math.max(-45, Math.min(45, e.beta ?? 0));
    const gamma = Math.max(-45, Math.min(45, e.gamma ?? 0));
    if (dot) {
      dot.style.transform = `translate(${gamma * 2}px, ${beta * 2}px)`;
    }
    readout.textContent = `Kemiringan: X=${gamma.toFixed(1)}°, Y=${beta.toFixed(1)}°`;
  };

  window.addEventListener('deviceorientation', onOri);

  verdictButtons(body, {
    pass: 'Sensor Merespons Gerakan',
    fail: 'Sensor Macet / Tidak Gerak',
    onPass: () => finish('motion', 'pass', 'Sensor Gyroscope merespons orientasi sudut perangkat.', 'Gyro responsive'),
    onFail: () => finish('motion', 'fail', 'Data orientasi tidak berubah saat HP dimiringkan.', 'orientasi beku'),
  });

  cleanupCurrent = () => window.removeEventListener('deviceorientation', onOri);
}

/* ------------------------------------------------------------------ */
/* 8. Benchmark Beban CPU & GPU                                      */
/* ------------------------------------------------------------------ */

export function startBenchmark() {
  const { body } = openOverlay('Benchmark Performa CPU & GPU');
  infoLine(body, 'Menjalankan kalkulasi stress-test matriks floating-point dan rendering partikel selama ±5 detik.');

  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = 'Mulai Stress Test';
  go.className = 'dd-btn bg-main px-6 py-3 font-heading font-extrabold text-sm';
  body.append(go);

  go.addEventListener('click', () => {
    const progBox = document.createElement('div');
    progBox.className = 'w-full flex flex-col gap-2 p-4 bg-secondary-background rounded-base border-2 border-border';
    progBox.innerHTML = `
      <div class="flex justify-between font-data text-xs font-bold">
        <span>Menghitung Beban Komputasi…</span>
        <span id="bench-pct">0%</span>
      </div>
      <div class="dd-meter h-5"><span id="bench-bar" style="width:0%"></span></div>
    `;
    body.replaceChildren(progBox);

    const start = performance.now();
    let ops = 0;
    const duration = 4500;

    const runLoop = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      const bar = progBox.querySelector('#bench-bar') as HTMLElement;
      const txt = progBox.querySelector('#bench-pct');
      if (bar) bar.style.width = `${pct}%`;
      if (txt) txt.textContent = `${pct}%`;

      for (let i = 0; i < 250000; i++) {
        Math.sqrt(i) * Math.sin(i);
        ops++;
      }

      if (elapsed < duration) {
        requestAnimationFrame(runLoop);
      } else {
        const mops = Math.round(ops / (elapsed / 1000) / 1000);
        const score = Math.round(mops * 1.5);
        finish('benchmark', 'pass', `Skor komputasi: ${score} Pts (~${mops}k ops/detik).`, `${score} Pts`);
      }
    };

    requestAnimationFrame(runLoop);
  });
}

/* ------------------------------------------------------------------ */
/* 9. GPS Precision Lock                                              */
/* ------------------------------------------------------------------ */

export function startGpsTest() {
  const { body } = openOverlay('Test Kuncian GPS & Satelit');
  infoLine(body, 'Mengukur ketelitian radius akurasi posisi GPS chip perangkat kamu.');

  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = 'Kunci Sinyal GPS';
  go.className = 'dd-btn bg-main px-6 py-3 font-heading font-extrabold text-sm';
  body.append(go);

  go.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      finish('gps', 'unsupported', 'Geolocation tidak didukung browser.');
      return;
    }

    const stat = document.createElement('p');
    stat.className = 'font-data text-xs py-3 px-4 bg-secondary-background rounded-base border-2 border-border';
    stat.textContent = 'Meminta kuncian satelit akurasi tinggi…';
    body.replaceChildren(stat);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { accuracy } = pos.coords;
        const note = accuracy <= 20 ? 'Kuncian presisi tinggi tercapai.' : 'Akurasi longgar (berada di dalam ruangan).';
        finish('gps', accuracy <= 35 ? 'pass' : 'warn', note, `±${accuracy.toFixed(0)}m`);
      },
      (err) => {
        finish('gps', 'denied', `GPS gagal dikunci (${err.message}).`);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}
