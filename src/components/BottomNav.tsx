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
    <nav 
      aria-label="Navigasi Utama" 
      className="fixed bottom-0 inset-x-0 z-40 bg-card border-t-[3px] border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-200 md:bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[90%] md:max-w-3xl md:rounded-base md:border-[3px] md:shadow-[6px_6px_0_0_var(--border)]"
    >
      <div className="flex justify-around items-center px-2 sm:px-4 py-2 sm:py-2.5 w-full">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = active === link.href || (link.href !== '/' && active.startsWith(link.href));
          
          return (
            <a
              key={link.href}
              href={link.href}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-5 md:px-6 rounded-base border-2 transition-all select-none ${
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
