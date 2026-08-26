import React from 'react';
import { Smartphone, Activity, Stethoscope } from 'lucide-react';

interface Props {
  active: 'info' | 'tests' | 'summary';
  onChange: (tab: 'info' | 'tests' | 'summary') => void;
}

export const InfoTabs: React.FC<Props> = ({ active, onChange }) => {
  return (
    <div className="flex w-full gap-2 border-b-[3px] border-border bg-card p-2">
      <button
        type="button"
        onClick={() => onChange('info')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-base border-2 border-border py-2 text-xs font-extrabold shadow-xs transition-all ${
          active === 'info'
            ? 'bg-main text-black translate-x-0.5 translate-y-0.5 shadow-none'
            : 'bg-secondary-background text-muted-foreground hover:bg-card'
        }`}
      >
        <Smartphone className="w-4 h-4 text-primary" />
        <span>Spesifikasi</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('tests')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-base border-2 border-border py-2 text-xs font-extrabold shadow-xs transition-all ${
          active === 'tests'
            ? 'bg-main text-black translate-x-0.5 translate-y-0.5 shadow-none'
            : 'bg-secondary-background text-muted-foreground hover:bg-card'
        }`}
      >
        <Activity className="w-4 h-4 text-primary" />
        <span>Periksa</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('summary')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-base border-2 border-border py-2 text-xs font-extrabold shadow-xs transition-all ${
          active === 'summary'
            ? 'bg-main text-black translate-x-0.5 translate-y-0.5 shadow-none'
            : 'bg-secondary-background text-muted-foreground hover:bg-card'
        }`}
      >
        <Stethoscope className="w-4 h-4 text-primary" />
        <span>Ringkasan</span>
      </button>
    </div>
  );
};
