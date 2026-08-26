import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Chrome navigasi. PENTING: Radix TIDAK merender prop `value` ke DOM,
 * jadi kita kirim `data-value` eksplisit (Radix meneruskan atribut data-*)
 * supaya handler vanilla di main.ts bisa membaca tab mana yang diklik.
 */
export default function InfoTabs() {
  return (
    <Tabs defaultValue="info">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="info" data-value="info">
          📱 Info
        </TabsTrigger>
        <TabsTrigger value="tests" data-value="tests">
          🩺 Periksa
        </TabsTrigger>
        <TabsTrigger value="ringkasan" data-value="ringkasan">
          📋 Ringkasan
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
