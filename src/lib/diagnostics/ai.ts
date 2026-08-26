/**
 * Klien AI — bicara ke Worker proxy kita sendiri (/api/ai/*),
 * BUKAN langsung ke gateway. API key tidak pernah ada di browser.
 */
import { getSession } from './store';
import { buildVerdict } from './engine';
import { TEST_IDS } from './types';

const LABEL: Record<string, string> = {
  touch: 'Layar sentuh',
  display: 'Dead pixel / layar',
  speaker: 'Speaker',
  mic: 'Mikrofon',
  camera: 'Kamera',
  vibrate: 'Getar',
  motion: 'Sensor gerak',
  benchmark: 'Performa CPU/GPU',
  gps: 'GPS',
};

/** Rangkum kondisi device jadi JSON kompak untuk konteks AI. */
export function buildSnapshot(): Record<string, unknown> {
  const s = getSession();
  const v = buildVerdict();

  const tests: Record<string, unknown> = {};
  for (const id of TEST_IDS) {
    const e = s.entries[id];
    if (!e) continue;
    tests[LABEL[id] ?? id] = {
      status: e.status,
      nilai: e.value ?? null,
      catatan: e.note ?? null,
    };
  }

  const info: Record<string, unknown> = {};
  for (const [k, e] of Object.entries(s.entries)) {
    if ((TEST_IDS as readonly string[]).includes(k)) continue;
    info[k] = { status: e.status, nilai: e.value ?? null, catatan: e.note ?? null };
  }

  return {
    stempel_diagnosis: v.stamp,
    ringkasan_mesin_aturan: v.sub,
    temuan_rule_based: v.items.map((i) => ({ tingkat: i.kind, judul: i.title, saran: i.body })),
    hasil_test: tests,
    info_perangkat: info,
    user_agent: navigator.userAgent,
    catatan_penting:
      'Semua data ini dibaca lewat Web API browser sehingga terbatas. Status "unsupported" berarti browser tidak mendukung API-nya, BUKAN indikasi kerusakan hardware.',
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

/** Markdown → HTML minimal (tanpa dependency, aman dari HTML injection). */
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
      html += `<h4 class="mt-3 font-heading text-sm font-bold uppercase tracking-wide">${line.replace(/^##\s+/, '')}</h4>`;
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
