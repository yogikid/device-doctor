/** Helper DOM kecil buat modul vanilla TS — tanpa dependency apa pun. */

export function $(sel: string, root: ParentNode = document): Element | null {
  return root.querySelector(sel);
}

export function $all(sel: string, root: ParentNode = document): Element[] {
  return Array.from(root.querySelectorAll(sel));
}

/** Nunggu elemen muncul (island React baru ke-hydrate belakangan). */
export function whenReady(sel: string, timeoutMs = 6000): Promise<Element[]> {
  const found = $all(sel);
  if (found.length > 0) return Promise.resolve(found);
  return new Promise((resolve) => {
    const started = Date.now();
    const obs = new MutationObserver(() => {
      const els = $all(sel);
      if (els.length > 0 || Date.now() - started > timeoutMs) {
        obs.disconnect();
        resolve(els);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
}

export function setText(el: Element | null | undefined, text: string) {
  if (el) el.textContent = text;
}

export function setHidden(el: Element | null | undefined, hidden: boolean) {
  if (el instanceof HTMLElement) el.hidden = hidden;
}

/** Byte → string manusiawi (GB/MB/KB/B) */
export function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function fmtPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Deteksi browser kasar — cuma buat pesan keterbatasan, bukan fingerprinting. */
export function browserName(): string {
  const ua = navigator.userAgent;
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/SamsungBrowser\//i.test(ua)) return 'Samsung Internet';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Browser ini';
}

export function isIOS(): boolean {
  return (
    /iP(hone|ad|od)/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Escaping attribute buat markup yang dibangun via string. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
