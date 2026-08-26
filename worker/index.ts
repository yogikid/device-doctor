/**
 * Cloudflare Worker entry.
 *
 * Endpoint /api/ai proxy langsung ke https://ai.gimita.id/v1
 * dengan API key dan model Grok 4.6 yang sudah di-hardcode di server.
 */

interface Env {
  ASSETS: Fetcher;
}

const AI_BASE_URL = 'https://ai.gimita.id/v1';
const AI_API_KEY = 'sk-2ba05e607c7dff5c-zhagyv-66f0cc14';
const AI_MODEL = 'gcli/grok-4.6-xhigh';

const SYSTEM_ANALYZE = `Kamu "Dokter Device" — analis hardware dan spesifikasi HP profesional, jujur, membumi, dan berwawasan teknis mendalam.
Kamu menerima data RAG lengkap dari browser user yang berisi seluruh detail hardware, jaringan IP/ISP, sensor, dan hasil tes fisik.

FORMAT JAWABAN (Gunakan Markdown terstruktur standar):
## Ringkasan Eksekutif
2-3 kalimat kondisi umum perangkat dan identitas hardware utama.

## Kekuatan & Kondisi Prima
Poin-poin komponen yang sehat dan spesifikasi unggulan.

## Temuan & Catatan Khusus
Catatan komponen yang butuh perhatian atau keterbatasan yang terdeteksi.

## Rekomendasi Dokter Device
Saran optimasi praktis, tips perawatan hardware, atau tips verifikasi jika ini HP bekas.`;

const SYSTEM_CHAT = `Kamu "Dokter Device" — partner dan asisten cerdas yang mengetahui SEGALA HAL tentang spesifikasi teknis dan kondisi fisik perangkat user.

PENTING:
- Kamu SUDAH DIBEKALI data RAG spesifikasi & diagnosa perangkat user yang nyata pada context.
- BACA LANGSUNG dari data tersebut saat user bertanya tentang:
  * Alamat IP Publik, ISP Operator, ASN, Kota & Lokasi Jaringan
  * Hardware Vendor, Hardware Model (Galaxy A14 / POCO / dll), OS Version
  * Chipset GPU, Vendor Hardware, WebGL2, WebGPU
  * Layar (Resolusi Aktual, Refresh Rate Hz live, Gamut P3, HDR, DPR)
  * CPU Cores, RAM Kapasitas, Battery Level & Charging Status
  * Storage kuota origin, Sensor (Gyro, Akselerometer, NFC, Bluetooth), Codec (AV1, HEVC), dll.
  * Hasil Test Fisik (Layar sentuh, dead pixel, speaker, mic, getar, benchmark Pts, GPS)
- JANGAN PERNAH meminta user mengirimkan JSON snapshot atau menyuruh user kirim data lagi, karena kamu SUDAH MEMEGANG DATANYA di memory prompt kamu!
- Jawablah langsung dengan jelas, akurat, santai, dan bersahabat dalam Bahasa Indonesia menggunakan Markdown yang rapi.`;

function cors(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

async function callAI(messages: unknown[], maxTokens: number): Promise<Response> {
  const upstream = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: AI_MODEL, messages, stream: true, max_tokens: maxTokens }),
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
              /* chunk parsial */
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

    // 1. Endpoint /api/ip
    if (url.pathname === '/api/ip') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors() });
      }

      const cf = (request as any).cf || {};
      const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
      
      let asn = cf.asn ? `AS${cf.asn}` : '—';
      let org = cf.asOrganization || '—';
      let isp = cf.asOrganization || '—';
      let city = cf.city || '—';
      let region = cf.region || '—';
      let country = cf.country || '—';

      if (isp === '—' || asn === '—') {
        try {
          const extRes = await fetch(`https://ipwho.is/${clientIp}`, { signal: AbortSignal.timeout(2500) });
          if (extRes.ok) {
            const extData: any = await extRes.json();
            if (extData.success) {
              if (asn === '—' && extData.connection?.asn) asn = `AS${extData.connection.asn}`;
              if (org === '—' && extData.connection?.org) org = extData.connection.org;
              if (isp === '—' && extData.connection?.isp) isp = extData.connection.isp;
              if (city === '—' && extData.city) city = extData.city;
              if (region === '—' && extData.region) region = extData.region;
              if (country === '—' && extData.country_code) country = extData.country_code;
            }
          }
        } catch {
          /* fallback */
        }
      }

      const ipData = {
        ip: clientIp,
        asn,
        asOrganization: org,
        isp,
        city,
        region,
        country,
        colo: cf.colo || '—',
        timezone: cf.timezone || 'Asia/Jakarta',
        httpProtocol: cf.httpProtocol || 'HTTP/2',
        tlsVersion: cf.tlsVersion || 'TLS 1.3',
      };

      return new Response(JSON.stringify(ipData), {
        status: 200,
        headers: cors({
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        }),
      });
    }

    // 2. Endpoint /api/ai (Menerima POST analyze & chat terpadu)
    if (url.pathname === '/api/ai' || url.pathname.startsWith('/api/ai/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors() });
      }
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Gunakan POST.' }), {
          status: 405,
          headers: cors({ 'Content-Type': 'application/json' }),
        });
      }

      let body: { snapshot?: unknown; question?: string; history?: unknown[]; mode?: 'analyze' | 'chat' };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return new Response(JSON.stringify({ error: 'Body JSON tidak valid.' }), {
          status: 400,
          headers: cors({ 'Content-Type': 'application/json' }),
        });
      }

      const snapshot = JSON.stringify(body.snapshot ?? {}, null, 2).slice(0, 25000);
      const isChat = body.mode === 'chat' || !!body.question || url.pathname.endsWith('/chat');

      if (!isChat) {
        // Mode Analisis Diagnosa
        return callAI(
          [
            { role: 'system', content: SYSTEM_ANALYZE },
            { role: 'user', content: `Berikut adalah Data RAG Spesifikasi Perangkat & Hasil Pengujian Diagnostik Lengkap (JSON):\n${snapshot}\n\nLakukan analisis menyeluruh dan berikan diagnosa komprehensif.` },
          ],
          1800,
        );
      } else {
        // Mode Konsultasi Chat
        const question = String(body.question ?? '').slice(0, 1500);
        if (!question) {
          return new Response(JSON.stringify({ error: 'Pertanyaan kosong.' }), {
            status: 400,
            headers: cors({ 'Content-Type': 'application/json' }),
          });
        }
        const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
        return callAI(
          [
            { role: 'system', content: `${SYSTEM_CHAT}\n\n[DATA RAG SPESIFIKASI & DIAGNOSTIK DEVICE USER]:\n${snapshot}` },
            ...history,
            { role: 'user', content: question },
          ],
          1200,
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
