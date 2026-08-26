/**
 * Cloudflare Worker entry.
 *
 * Tiga tugas:
 *  1. Serve static assets hasil `astro build` (binding ASSETS).
 *  2. Endpoint /api/ip: Multi-source IP & Network lookup (Cloudflare Edge request.cf + ipapi.co / ipwho.is fallback).
 *  3. Proxy ke gateway AI (9Router) untuk /api/ai/* — API key TETAP di server.
 */

interface Env {
  ASSETS: Fetcher;
  AI_API_KEY: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}

const DEFAULT_BASE = 'http://163-172-110-146.rev.poneytelecom.eu:1047/v1';
const DEFAULT_MODEL = 'gcli/grok-4.6-xhigh';

const SYSTEM_ANALYZE = `Kamu "Dokter Device" — analis hardware dan spesifikasi HP profesional, jujur, membumi, dan berwawasan teknis mendalam. Kamu menjawab dalam Bahasa Indonesia santai tapi sangat kredibel dan presisi.

Data RAG spesifikasi perangkat dan hasil tes sudah disediakan di prompt. Analisis secara holistik.

FORMAT JAWABAN (Markdown rapi & padat):
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
- Jawablah langsung dengan jelas, akurat, santai, dan bersahabat dalam Bahasa Indonesia.`;

function cors(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
              /* chunk belum lengkap */
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

    // 1. Endpoint /api/ip: Detail IP publik, ASN, ISP, Organisasi, dan Lokasi Edge
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

      // Fallback jika Cloudflare Edge tidak memberikan data ISP/ASN lengkap
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
          /* fallback diam */
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

    // 2. Endpoints AI (/api/ai/analyze dan /api/ai/chat)
    if (url.pathname.startsWith('/api/ai/')) {
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

      const snapshot = JSON.stringify(body.snapshot ?? {}, null, 2).slice(0, 20000);

      if (url.pathname === '/api/ai/analyze') {
        return callAI(
          env,
          [
            { role: 'system', content: SYSTEM_ANALYZE },
            { role: 'user', content: `Berikut adalah Data RAG Spesifikasi Perangkat & Hasil Pengujian Diagnostik Lengkap:\n${snapshot}\n\nLakukan analisis menyeluruh dan berikan diagnosa komprehensif.` },
          ],
          1800,
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
            { role: 'system', content: `${SYSTEM_CHAT}\n\n[DATA RAG SPESIFIKASI & DIAGNOSTIK DEVICE USER]:\n${snapshot}` },
            ...history,
            { role: 'user', content: question },
          ],
          1200,
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
