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

/** Byte → string manusiawi (GB/MB) pakai desimal ala vendor storage. */
export function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1e6;
  return `${mb.toFixed(0)} MB`;
}

export function fmtPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
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
