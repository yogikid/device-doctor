import React, { useState, useEffect } from 'react';
import { X, Check, ShieldAlert } from 'lucide-react';

const HIDE_KEY = 'dd_dismiss_chromium_alert';

export const ChromiumNoticeModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    try {
      // 1. Jika user sudah pernah centang "Jangan tampilkan lagi", skip
      const isDismissed = localStorage.getItem(HIDE_KEY) === 'true';
      if (isDismissed) return;

      // 2. Deteksi apakah browser saat ini sudah merupakan keluarga Chromium
      const nav = navigator as any;
      const ua = navigator.userAgent || '';
      
      // Cek melalui userAgentData (modern) atau User-Agent string (klasik)
      let isChromium = false;
      
      if (nav.userAgentData && Array.isArray(nav.userAgentData.brands)) {
        isChromium = nav.userAgentData.brands.some((b: { brand: string }) =>
          /Chromium|Chrome|Google Chrome|Microsoft Edge|Opera|Brave/i.test(b.brand)
        );
      }
      
      if (!isChromium) {
        // Deteksi via regex UA string
        // Chromium UA biasanya memuat Chrome/xxx atau CriOS/xxx dan bukan standalone Safari murni atau Firefox Gecko murni
        const hasChromeToken = /Chrome\/|CriOS\/|Edg\/|OPR\/|SamsungBrowser\/|Brave\//i.test(ua);
        const isFirefox = /Firefox\/|FxiOS\//i.test(ua);
        const isPureSafari = /Safari\//i.test(ua) && !hasChromeToken;

        if (hasChromeToken && !isFirefox && !isPureSafari) {
          isChromium = true;
        }
      }

      // Jika user SUDAH pakai browser Chromium (Chrome, Brave, Edge, Samsung Internet, dll), JANGAN tampilkan alert!
      if (isChromium) {
        return;
      }

      // Jika BUKAN Chromium (misal Safari iOS, Firefox, WebView non-standard), munculkan rekomendasi setelah 600ms
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    } catch {
      /* ignore */
    }
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(HIDE_KEY, 'true');
      } catch {}
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card rounded-base border-[3px] border-border p-5 shadow-[6px_6px_0_0_var(--border)] flex flex-col gap-4">
        
        {/* Header Modal & Tombol X */}
        <div className="flex items-center justify-between border-b-2 border-border/30 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-base bg-main border-2 border-border shadow-2xs">
              <ShieldAlert className="w-5 h-5 text-foreground stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-heading text-base font-black text-foreground">Rekomendasi Browser</h3>
              <p className="text-[11px] font-bold text-muted-foreground">Optimalisasi Fitur Hardware Diagnostik</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup Notifikasi"
            className="p-1.5 rounded-base border-2 border-border bg-secondary-background hover:bg-destructive/20 text-foreground transition-colors shadow-2xs cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Isi Pesan Rekomendasi */}
        <div className="flex flex-col gap-2.5 text-xs text-foreground/90 leading-relaxed">
          <p>
            Kami mendeteksi kamu menggunakan browser non-Chromium. Untuk menjalankan seluruh pengujian hardware tingkat rendah secara maksimal (seperti <b>High-Entropy Client Hints, Motor Getar Haptics, WebAudio Stereo, WebGPU, WebHID & Storage Quota</b>), disarankan menggunakan browser keluarga <b>Chromium</b>:
          </p>

          <div className="flex flex-wrap gap-2 pt-1 font-heading font-extrabold text-[11px]">
            <span className="px-2.5 py-1 rounded bg-secondary-background border border-border">Google Chrome</span>
            <span className="px-2.5 py-1 rounded bg-secondary-background border border-border">Brave Browser</span>
            <span className="px-2.5 py-1 rounded bg-secondary-background border border-border">Microsoft Edge</span>
            <span className="px-2.5 py-1 rounded bg-secondary-background border border-border">Samsung Internet</span>
          </div>
        </div>

        {/* Checkbox Jangan Tampilkan Lagi & Tombol Oke */}
        <div className="flex flex-col gap-3 pt-2 border-t-2 border-border/30">
          <label className="flex items-center gap-2.5 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer accent-[#9fc9b0]"
            />
            <span>Jangan tampilkan pesan ini lagi</span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="dd-btn bg-main px-5 py-2 text-xs font-black flex items-center justify-center gap-1.5 w-full shadow-xs cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Saya Mengerti & Lanjutkan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
