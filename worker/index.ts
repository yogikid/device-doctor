/**
 * Cloudflare Worker entry.
 *
 * Dua tugas:
 *  1. Serve static assets hasil `astro build` (binding ASSETS).
 *  2. Proxy ke gateway AI (9Router) untuk /api/ai/* — API key TETAP di server,
 *     tidak pernah dikirim ke browser.
 */

interface Env {
  ASSETS: Fetcher;
  AI_API_KEY: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}

const DEFAULT_BASE = 'http://163.172.110.146:1047/v1';
const DEFAULT_MODEL = 'gcli/grok-4.6-xhigh';

const SYSTEM_ANALYZE = `Kamu "Dokter Device" — analis hardware HP yang jujur dan membumi, menjawab dalam Bahasa Indonesia santai tapi kredibel.

Kamu menerima data JSON hasil pemeriksaan sebuah HP yang dibaca lewat Web API browser.

ATURAN KERAS:
- Data browser itu TERBATAS. Jangan pernah mengarang angka yang tidak ada di data (contoh: JANGAN sebut "battery health 80%", cycle count, kekuatan sinyal dBm, atau suhu baterai). Data itu memang tidak tersedia di web.
- Status "unsupported" berarti BROWSER tidak mendukung API-nya — itu BUKAN tanda HP rusak. Jelaskan bedanya kalau relevan.
- Selalu bingkai kesimpulan sebagai INDIKASI/DUGAAN, bukan diagnosis pasti.
- Kalau user sedang cek HP bekas, beri saran pengecekan fisik yang tidak bisa dilakukan browser (tombol, port charging, IMEI, garansi).

FORMAT JAWABAN (pakai markdown, ringkas, total maksimal ~300 kata):
## Ringkasan
2-3 kalimat kondisi umum device.

## Yang Terlihat Bagus
Poin-poin singkat (maksimal 4 bullet).

## Perlu Diperhatikan
Poin-poin singkat + saran konkret (maksimal 4 bullet). Kalau tidak ada, tulis "Tidak ada temuan yang mengkhawatirkan dari data yang terbaca."

## Saran Langkah Berikutnya
2-3 langkah praktis dan spesifik.`;

const SYSTEM_CHAT = `Kamu "Dokter Device" — asisten yang membantu user memahami kondisi HP mereka, menjawab dalam Bahasa Indonesia yang santai, hangat, dan mudah dipahami orang awam.

Kamu punya akses ke data hasil pemeriksaan device user (dikirim sebagai konteks JSON).

ATURAN KERAS:
- Jangan mengarang data yang tidak tersedia di web (battery health, cycle count, sinyal dBm, suhu). Kalau user menanyakan itu, jelaskan dengan jujur bahwa browser TIDAK BISA membacanya dan sarankan cara lain (aplikasi native, kode dial *#*#4636#*#*, atau service center).
- Status "unsupported" = keterbatasan browser, bukan kerusakan HP.
- Jawaban ringkas: maksimal 180 kata, langsung ke inti, boleh pakai bullet.
- Kalau data pemeriksaan masih kosong, ajak user menjalankan test dulu di tab Periksa.`;

function cors(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

async function callAI(env: Env, messages: unknown[], maxTokens: number): Promise<Response> {
  const base = env.AI_BASE_URL || DEFAULT_BASE;
  const model = env.AI_MODEL || DEFAULT_MODEL;

  const upstream = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: maxTokens }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return new Response(
      JSON.stringify({
        error: `Gateway AI menolak permintaan (HTTP ${upstream.status}).`,
        detail: detail.slice(0, 300),
      }),
      { status: 502, headers: cors({ 'Content-Type': 'application/json' }) },
    );
  }

  // Ubah SSE OpenAI → stream teks polos, biar client-side sederhana.
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* chunk belum lengkap — abaikan */
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[Koneksi ke AI terputus: ${String(err)}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: cors({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    }),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors() });
      }
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Gunakan POST.' }), {
          status: 405,
          headers: cors({ 'Content-Type': 'application/json' }),
        });
      }
      if (!env.AI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Fitur AI belum dikonfigurasi di server (AI_API_KEY kosong).' }),
          { status: 503, headers: cors({ 'Content-Type': 'application/json' }) },
        );
      }

      let body: { snapshot?: unknown; question?: string; history?: unknown[] };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return new Response(JSON.stringify({ error: 'Body JSON tidak valid.' }), {
          status: 400,
          headers: cors({ 'Content-Type': 'application/json' }),
        });
      }

      const snapshot = JSON.stringify(body.snapshot ?? {}).slice(0, 12000);

      if (url.pathname === '/api/ai/analyze') {
        return callAI(
          env,
          [
            { role: 'system', content: SYSTEM_ANALYZE },
            { role: 'user', content: `Data pemeriksaan device (JSON):\n${snapshot}` },
          ],
          1400,
        );
      }

      if (url.pathname === '/api/ai/chat') {
        const question = String(body.question ?? '').slice(0, 1500);
        if (!question) {
          return new Response(JSON.stringify({ error: 'Pertanyaan kosong.' }), {
            status: 400,
            headers: cors({ 'Content-Type': 'application/json' }),
          });
        }
        const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
        return callAI(
          env,
          [
            { role: 'system', content: SYSTEM_CHAT },
            { role: 'system', content: `Data pemeriksaan device user (JSON):\n${snapshot}` },
            ...history,
            { role: 'user', content: question },
          ],
          900,
        );
      }

      return new Response(JSON.stringify({ error: 'Endpoint tidak dikenal.' }), {
        status: 404,
        headers: cors({ 'Content-Type': 'application/json' }),
      });
    }

    return env.ASSETS.fetch(request);
  },
};
