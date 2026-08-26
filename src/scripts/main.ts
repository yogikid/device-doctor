/**
 * Entry point vanilla TS — dipanggil dari BaseLayout.
 * Semua interaksi pakai event delegation di level document supaya
 * tetap jalan walau island React (tabs/dialog) melakukan re-mount DOM.
 */
import { $ } from '../lib/dom';
import { initInfoDashboard } from '../lib/diagnostics/info';
import {
  startTouchTest,
  startDisplayTest,
  startSpeakerTest,
  startMicTest,
  startCameraTest,
  initVibrateCard,
  startVibrateTest,
  startMotionTest,
  startBenchmark,
  startGpsTest,
} from '../lib/diagnostics/tests';
import { buildVerdict } from '../lib/diagnostics/engine';
import {
  getSession,
  onSession,
  completedTestCount,
  setEntry,
} from '../lib/diagnostics/store';
import { TEST_IDS } from '../lib/diagnostics/types';
import type { Recommendation } from '../lib/diagnostics/types';
import { requestAnalysis, requestChat, renderMarkdown } from '../lib/diagnostics/ai';

const STARTERS: Record<string, () => void> = {
  touch: startTouchTest,
  display: startDisplayTest,
  speaker: () => void startSpeakerTest(),
  mic: () => void startMicTest(),
  camera: () => void startCameraTest(),
  vibrate: startVibrateTest,
  motion: () => void startMotionTest(),
  benchmark: startBenchmark,
  gps: startGpsTest,
};

/* ---------------- Navigasi tab (chrome React + panel vanilla) --------------- */

function showPanel(value: string) {
  const map: Record<string, string> = {
    info: 'panel-info',
    tests: 'panel-tests',
    ringkasan: 'panel-ringkasan',
  };
  for (const [val, id] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el instanceof HTMLElement) el.hidden = val !== value;
  }
  if (value === 'ringkasan') renderSummary();
}

/* ---------------- Chip status per test & Progress Ring ---------------- */

const CHIP_STYLE: Record<string, string> = {
  pass: 'bg-healthy text-black',
  warn: 'bg-attention text-black',
  fail: 'bg-critical text-white',
  denied: 'bg-attention text-black',
  unsupported: 'bg-secondary-background text-muted-foreground',
  info: 'bg-accent text-black',
  pending: 'bg-secondary-background text-muted-foreground',
};

const CHIP_TEXT: Record<string, string> = {
  pass: '✓ Lolos',
  warn: '! Catatan',
  fail: '✕ Bermasalah',
  denied: '⊘ Ditolak',
  unsupported: '— Tak didukung',
  info: 'i Terbaca',
  pending: '… Belum',
};

function refreshChips() {
  for (const id of TEST_IDS) {
    const chip = document.querySelector(`[data-status="${id}"]`);
    if (!chip) continue;
    const st = getSession().entries[id]?.status ?? 'pending';
    chip.className = `inline-block rounded-base border-2 border-border px-2 py-0.5 text-[10px] font-bold ${CHIP_STYLE[st] ?? CHIP_STYLE.pending}`;
    chip.textContent = CHIP_TEXT[st] ?? CHIP_TEXT.pending;
  }
  const prog = $('#progress-text');
  const ring = document.getElementById('progress-ring') as SVGCircleElement | null;
  const done = completedTestCount(TEST_IDS);
  if (prog) {
    prog.textContent = `${done}/${TEST_IDS.length} test selesai`;
  }
  if (ring) {
    // Keliling lingkaran r=22 -> 2 * PI * 22 = ~138.23
    const perimeter = 138.23;
    const offset = perimeter - (done / TEST_IDS.length) * perimeter;
    ring.style.strokeDashoffset = String(offset);
  }
}

/* ---------------- Ringkasan + stempel diagnosis ---------------- */

function renderSummary() {
  const box = $('#summary-box');
  if (!box) return;
  const v = buildVerdict();
  const s = getSession();

  const chips = TEST_IDS.map((id: string) => {
    const st = s.entries[id]?.status ?? 'pending';
    return `<span class="inline-block rounded-base border-2 border-border px-2 py-0.5 text-[11px] font-semibold ${CHIP_STYLE[st]}">${id}: ${CHIP_TEXT[st]}</span>`;
  }).join(' ');

  const items =
    v.items.length > 0
      ? v.items
          .map(
            (it: Recommendation) => `<li class="border-l-[5px] border-border pl-3 py-1 bg-card rounded-r-base border-2 border-border" style="border-left-color:${it.kind === 'critical' ? 'var(--status-critical)' : it.kind === 'attention' ? 'var(--status-attention)' : 'var(--accent)'}">
              <p class="font-heading font-bold text-sm">${it.title}</p>
              <p class="text-xs text-muted-foreground mt-0.5">${it.body}</p>
            </li>`,
          )
          .join('')
      : '<li class="text-sm text-muted-foreground p-3 border-2 border-dashed border-border rounded-base">Belum ada catatan khusus. Coba jalankan test di tab Periksa terlebih dahulu.</li>';

  box.innerHTML = `
    <div class="flex flex-col items-center gap-4 rounded-base border-[3px] border-border bg-card p-6 shadow-[5px_5px_0_0_var(--border)]">
      <span class="stamp-diagnosis text-xl" data-reveal="true">${v.stamp}</span>
      <p class="max-w-sm text-center text-sm font-medium">${v.sub}</p>
    </div>
    <div class="mt-4 flex flex-wrap gap-1.5">${chips}</div>
    <ul class="mt-4 flex flex-col gap-2.5">${items}</ul>
    <p class="mt-4 text-xs text-muted-foreground">Stempel ini kesimpulan <b>indikatif</b> dari data yang bisa dibaca browser (${new Date(s.updatedAt).toLocaleTimeString('id-ID')}). Bukan pengganti alat lab resmi.</p>`;
}

/* ---------------- Lokasi (on-demand) ---------------- */

function initLocation() {
  const btn = $('#btn-location');
  const out = $('#loc-result');
  if (!('geolocation' in navigator)) {
    if (out) out.textContent = 'Geolocation tidak tersedia di browser ini.';
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    return;
  }
  btn?.addEventListener('click', () => {
    if (out) out.textContent = 'Meminta izin GPS & menghitung posisi…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (out)
          out.innerHTML = `Lat: <b>${latitude.toFixed(5)}</b>, Lon: <b>${longitude.toFixed(5)}</b> · Presisi: <b>±${accuracy.toFixed(0)} m</b>`;
        setEntry('location', {
          status: accuracy <= 25 ? 'pass' : 'warn',
          value: `±${accuracy.toFixed(0)} m`,
          note: accuracy > 25 ? 'Akurasi GPS longgar — disarankan di area terbuka.' : undefined,
        });
      },
      (err) => {
        if (out)
          out.textContent =
            err.code === err.PERMISSION_DENIED
              ? 'Izin lokasi ditolak via browser.'
              : `Gagal membaca GPS (${err.message}).`;
        setEntry('location', {
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'fail',
          note: 'Lokasi tidak bisa diakses.',
        });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

/* ---------------- Integrasi AI Grok 4.6 Analysis ---------------- */

let isAnalyzing = false;
let analyzeAbort: AbortController | null = null;

function setupAiAnalysis() {
  const btn = document.getElementById('btn-ai-analyze') as HTMLButtonElement | null;
  const out = document.getElementById('ai-output');
  if (!btn || !out) return;

  btn.addEventListener('click', async () => {
    if (isAnalyzing) {
      analyzeAbort?.abort();
      isAnalyzing = false;
      btn.textContent = '✨ Minta Analisis AI';
      return;
    }

    isAnalyzing = true;
    btn.textContent = '⏹️ Hentikan Analisis';
    out.innerHTML = '<div class="dd-skeleton h-24 w-full mt-2"></div>';

    let buffer = '';
    analyzeAbort = new AbortController();

    await requestAnalysis(
      {
        onChunk(chunk) {
          buffer += chunk;
          out.innerHTML = `<div class="dd-caret">${renderMarkdown(buffer)}</div>`;
        },
        onDone() {
          isAnalyzing = false;
          btn.textContent = '✨ Analisis Ulang AI';
          out.innerHTML = renderMarkdown(buffer);
        },
        onError(msg) {
          isAnalyzing = false;
          btn.textContent = '✨ Coba Lagi';
          out.innerHTML = `<div class="p-3 border-2 border-border bg-critical/20 rounded-base text-xs font-mono text-critical font-bold">✕ ${msg}</div>`;
        },
      },
      analyzeAbort.signal,
    );
  });
}

/* ---------------- Floating Chat Widget ---------------- */

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const chatHistory: ChatMsg[] = [];
let isChatStreaming = false;
let chatAbort: AbortController | null = null;

const SUGGESTIONS = [
  'Apakah layar HP-ku normal?',
  'Berapa estimasi refresh rate layar?',
  'Kenapa baterai health tak muncul?',
  'HP ini cocok buat main game?',
];

function setupChat() {
  const openBtn = document.getElementById('btn-chat');
  const closeBtn = document.getElementById('btn-chat-close');
  const panel = document.getElementById('chat-panel');
  const log = document.getElementById('chat-log');
  const form = document.getElementById('chat-form') as HTMLFormElement | null;
  const input = document.getElementById('chat-input') as HTMLInputElement | null;
  const sugBox = document.getElementById('chat-suggestions');

  if (!openBtn || !panel || !log || !form || !input) return;

  // Render initial suggestion chips
  if (sugBox) {
    sugBox.innerHTML = SUGGESTIONS.map(
      (s) => `<button type="button" class="dd-btn bg-secondary-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">${s}</button>`,
    ).join('');

    sugBox.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn && btn.textContent) {
        input.value = btn.textContent;
        form.requestSubmit();
      }
    });
  }

  const renderMessages = () => {
    if (chatHistory.length === 0) {
      log.innerHTML = `
        <div class="dd-bubble" data-who="ai">
          <p class="font-bold text-xs mb-1">Halo sayang! 👋</p>
          <p class="text-xs">Aku Dokter Device. Tanyakan apa saja mengenai kondisi atau spesifikasi HP kamu berdasarkan hasil test di atas!</p>
        </div>`;
      return;
    }

    log.innerHTML = chatHistory
      .map(
        (m) => `<div class="dd-bubble ${m.role === 'user' ? 'self-end bg-main' : 'self-start bg-card'}" data-who="${m.role}">
          <p class="text-xs leading-relaxed">${m.role === 'assistant' ? renderMarkdown(m.content) : m.content}</p>
        </div>`,
      )
      .join('');
    log.scrollTop = log.scrollHeight;
  };

  openBtn.addEventListener('click', () => {
    panel.hidden = false;
    openBtn.hidden = true;
    renderMessages();
    setTimeout(() => input.focus(), 50);
  });

  closeBtn?.addEventListener('click', () => {
    panel.hidden = true;
    openBtn.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query || isChatStreaming) return;

    input.value = '';
    chatHistory.push({ role: 'user', content: query });
    renderMessages();

    // Placeholder untuk assistant response
    const assistantIndex = chatHistory.length;
    chatHistory.push({ role: 'assistant', content: '' });

    isChatStreaming = true;
    chatAbort = new AbortController();

    let buffer = '';

    await requestChat(
      query,
      chatHistory.slice(0, -2), // History sebelum pertanyaan ini
      {
        onChunk(chunk) {
          buffer += chunk;
          chatHistory[assistantIndex].content = buffer;
          renderMessages();
        },
        onDone() {
          isChatStreaming = false;
          renderMessages();
        },
        onError(msg) {
          isChatStreaming = false;
          chatHistory[assistantIndex].content = `⚠️ *Gagal merespons:* ${msg}`;
          renderMessages();
        },
      },
      chatAbort.signal,
    );
  });
}

/* ---------------- Reset & boot ---------------- */

window.addEventListener('dd:reset', () => {
  refreshChips();
  renderSummary();
  chatHistory.length = 0;
  const out = document.getElementById('ai-output');
  if (out) out.innerHTML = '';
});

// Event delegation klik di level document
document.addEventListener('click', (ev) => {
  const target = ev.target instanceof Element ? ev.target : null;
  if (!target) return;

  const tab = target.closest('[role="tab"]');
  if (tab) {
    const val = tab.getAttribute('data-value') ?? tab.getAttribute('value');
    if (val) showPanel(val);
    return;
  }

  const testBtn = target.closest<HTMLElement>('[data-test]');
  if (testBtn) {
    const id = testBtn.dataset.test!;
    STARTERS[id]?.();
    return;
  }

  if (target.closest('#btn-run-all')) {
    // Mulai dari test pertama
    startTouchTest();
    return;
  }

  if (target.closest('#btn-summary')) {
    renderSummary();
    return;
  }
});

onSession(() => refreshChips());

initInfoDashboard();
initVibrateCard();
initLocation();
refreshChips();
setupAiAnalysis();
setupChat();

// PWA Install hint
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  const hint = document.getElementById('install-hint');
  if (hint) {
    hint.hidden = false;
    hint.addEventListener('click', () => {
      (e as any).prompt?.();
    });
  }
});

if (Object.keys(getSession().entries).length > 0) renderSummary();
