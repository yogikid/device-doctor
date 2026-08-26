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

export default function BottomNav({ currentPath }: NavProps) {
  const [active, setActive] = useState(currentPath);

  useEffect(() => {
    setActive(window.location.pathname);
    const onPageLoad = () => setActive(window.location.pathname);
    document.addEventListener('astro:page-load', onPageLoad);
    return () => document.removeEventListener('astro:page-load', onPageLoad);
  }, []);

  const links = [
    { href: '/', label: 'Spesifikasi', icon: Info },
    { href: '/periksa', label: 'Periksa', icon: Activity },
    { href: '/lokasi', label: 'Peta & GPS', icon: MapPin },
    { href: '/ringkasan', label: 'Ringkasan & AI', icon: Sparkles },
  ];

  return (
    <nav aria-label="Navigasi Utama" className="fixed bottom-0 inset-x-0 z-40 bg-card border-t-[3px] border-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-md sm:max-w-xl md:max-w-4xl lg:max-w-7xl justify-around items-center px-3 sm:px-6 py-2.5">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = active === link.href || (link.href !== '/' && active.startsWith(link.href));
          
          return (
            <a
              key={link.href}
              href={link.href}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 py-1.5 sm:py-2 px-3 sm:px-5 md:px-6 rounded-base border-2 transition-all select-none ${
                isActive
                  ? 'bg-main text-foreground border-border font-extrabold shadow-xs translate-y-[-2px]'
                  : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary-background'
              }`}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'text-foreground stroke-[2.5]' : 'text-muted-foreground stroke-[2]'}`} />
              <span className="text-[10px] sm:text-xs md:text-sm font-bold tracking-tight whitespace-nowrap">{link.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
