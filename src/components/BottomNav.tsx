import { useState, useEffect } from 'react';
import { 
  Info, 
  Activity, 
  MapPin, 
  Sparkles
} from 'lucide-react';

interface NavProps {
  currentPath: string;
}

export default function BottomNav({ currentPath: initialPath }: NavProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);

  useEffect(() => {
    // Sinkronkan state saat URL berubah via Astro ClientRouter (View Transitions)
    const updatePath = () => {
      const p = window.location.pathname.replace(/\/$/, '') || '/';
      setCurrentPath(p);
    };

    updatePath();
    document.addEventListener('astro:page-load', updatePath);
    return () => {
      document.removeEventListener('astro:page-load', updatePath);
    };
  }, []);

  const links = [
    { href: '/', label: 'Spesifikasi', icon: Info, path: '/' },
    { href: '/periksa', label: 'Periksa', icon: Activity, path: '/periksa' },
    { href: '/lokasi', label: 'Peta & GPS', icon: MapPin, path: '/lokasi' },
    { href: '/ringkasan', label: 'Ringkasan & AI', icon: Sparkles, path: '/ringkasan' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t-[3px] border-border pb-safe">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-2">
        {links.map((link) => {
          const Icon = link.icon;
          // Normalisasi path agar cocok baik dengan /periksa maupun /periksa/
          const normCurrent = currentPath.replace(/\/$/, '') || '/';
          const normLink = link.path.replace(/\/$/, '') || '/';
          const isActive = normCurrent === normLink;
          
          return (
            <a
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-base transition-all ${
                isActive
                  ? 'bg-main text-black font-extrabold shadow-[3px_3px_0_0_var(--border)] border-2 border-border translate-y-[-2px]'
                  : 'text-muted-foreground hover:text-black font-semibold hover:bg-secondary-background'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[11px] leading-none tracking-tight">{link.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
