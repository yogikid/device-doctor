import { Button } from '@/components/ui/button';
import { resetSession } from '@/lib/diagnostics/store';

/** Tombol reset sesi — island kecil, di-hydrate pas kelihatan. */
export default function ResetButton() {
  return (
    <Button
      variant="neutral"
      size="sm"
      onClick={() => {
        resetSession();
        window.dispatchEvent(new CustomEvent('dd:reset'));
      }}
    >
      🗑️ Mulai Sesi Baru
    </Button>
  );
}
