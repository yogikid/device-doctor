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

const STARTERS: Record<string, () => void> = {
  touch: startTouchTest,
  display: startDisplayTest,
  speaker: () => void startSpeakerTest(),
  mic: () => void startMicTest(),
  camera: () => void startCameraTest(),
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

/* ---------------- Chip status per test ---------------- */

const CHIP_STYLE: Record<string, string> = {
  pass: 'bg-healthy',
  warn: 'bg-attention',
  fail: 'bg-critical',
  denied: 'bg-attention',
  unsupported: 'bg-secondary-background text-muted-foreground',
  info: 'bg-accent',
  pending: 'bg-secondary-background text-muted-foreground',
};

const CHIP_TEXT: Record<string, string> = {
  pass: '✓ Lolos',
  warn: '! Catatan',
  fail: '✕ Bermasalah',
  denied: '⊘ Izin ditolak',
  unsupported: '— Browser tak dukung',
  info: 'i Terbaca',
  pending: '… Belum dites',
};

function refreshChips() {
  for (const id of TEST_IDS) {
    const chip = document.querySelector(`[data-status="${id}"]`);
    if (!chip) continue;
    const st = getSession().entries[id]?.status ?? 'pending';
    chip.className = `inline-block rounded-base border-2 border-border px-2 py-0.5 text-[11px] font-semibold ${CHIP_STYLE[st] ?? CHIP_STYLE.pending}`;
    chip.textContent = CHIP_TEXT[st] ?? CHIP_TEXT.pending;
  }
  const prog = $('#progress-text');
  if (prog) {
    const done = completedTestCount(TEST_IDS);
    prog.textContent = `${done}/${TEST_IDS.length} test dijalankan`;
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
    return `<span class="${`inline-block rounded-base border-2 border-border px-2 py-0.5 text-[11px] font-semibold ${CHIP_STYLE[st]}`}">${id}: ${CHIP_TEXT[st]}</span>`;
  }).join(' ');

  const items =
    v.items.length > 0
      ? v.items
          .map(
            (it: Recommendation) => `<li class="border-l-[5px] border-border pl-3 py-1" style="border-color:${it.kind === 'critical' ? 'var(--status-critical)' : it.kind === 'attention' ? 'var(--status-attention)' : 'var(--accent)'}">
              <p class="font-heading font-bold text-sm">${it.title}</p>
              <p class="text-sm text-muted-foreground">${it.body}</p>
            </li>`,
          )
          .join('')
      : '<li class="text-sm text-muted-foreground">Belum ada catatan khusus.</li>';

  box.innerHTML = `
    <div class="flex flex-col items-center gap-4 rounded-base border-[3px] border-border bg-card p-6" style="box-shadow:6px 6px 0 0 var(--border)">
      <span class="stamp-diagnosis text-xl ${v.kind === 'critical' ? '' : ''}" data-stamp>${v.stamp}</span>
      <p class="max-w-sm text-center text-sm">${v.sub}</p>
    </div>
    <div class="mt-4 flex flex-wrap gap-1.5">${chips}</div>
    <ul class="mt-4 flex flex-col gap-2">${items}</ul>
    <p class="mt-4 text-xs text-muted-foreground">Stempel ini kesimpulan <b>indikatif</b> dari data yang bisa dibaca browser (${new Date(s.updatedAt).toLocaleString('id-ID')}). Bukan pengganti diagnostic alat service.</p>`;
}

/* ---------------- Lokasi (on-demand + penjelasan dulu) ---------------- */

function initLocation() {
  const btn = $('#btn-location');
  const out = $('#loc-result');
  if (!('geolocation' in navigator)) {
    if (out) out.textContent = 'Geolocation tidak tersedia di browser ini.';
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    return;
  }
  btn?.addEventListener('click', () => {
    if (out) out.textContent = 'Meminta izin & mencari posisi…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (out)
          out.innerHTML = `lat <b>${latitude.toFixed(5)}</b>, lon <b>${longitude.toFixed(5)}</b> · akurasi ±${accuracy.toFixed(0)} m`;
        setEntry('location', {
          status: accuracy <= 20 ? 'pass' : 'warn',
          value: `±${accuracy.toFixed(0)} m`,
          note: accuracy > 20 ? 'Akurasi longgar — coba di area terbuka.' : undefined,
        });
      },
      (err) => {
        if (out)
          out.textContent =
            err.code === err.PERMISSION_DENIED
              ? 'Izin lokasi ditolak — beri izin lewat ikon gembok di address bar lalu ulangi.'
              : `Lokasi gagal (${err.message}).`;
        setEntry('location', {
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'fail',
          note: 'Lokasi tidak bisa dibaca.',
        });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

/* ---------------- Reset & boot ---------------- */

window.addEventListener('dd:reset', () => {
  refreshChips();
  renderSummary();
});

document.addEventListener('click', (ev) => {
  const target = ev.target instanceof Element ? ev.target : null;
  if (!target) return;

  const tab = target.closest('[role="tab"]');
  if (tab) {
    const val = tab.getAttribute('value') ?? tab.getAttribute('data-value');
    if (val) showPanel(val);
    return;
  }

  const testBtn = target.closest<HTMLElement>('[data-test]');
  if (testBtn) {
    const id = testBtn.dataset.test!;
    if (id === 'vibrate') startVibrateTest();
    else STARTERS[id]?.();
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

// Kalau sebelumnya udah ada sesi, siapin ringkasan diam-diam
if (Object.keys(getSession().entries).length > 0) renderSummary();
