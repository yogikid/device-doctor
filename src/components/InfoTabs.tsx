import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Chrome navigasi — satu-satunya island yang selalu interaktif (client:load).
 * Panel kontennya statis di .astro dan ditampilkan/disembunyikan oleh
 * vanilla TS lewat event delegation (lihat src/scripts/main.ts).
 */
export default function InfoTabs() {
  return (
    <Tabs defaultValue="info">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="info">📱 Info Device</TabsTrigger>
        <TabsTrigger value="tests">🩺 Periksa</TabsTrigger>
        <TabsTrigger value="ringkasan">📋 Ringkasan</TabsTrigger>
      </TabsList>
      {/* Tanpa TabsContent — konten dikelola vanilla TS biar payload tetap minimal */}
    </Tabs>
  );
}
