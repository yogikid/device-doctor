import React from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  onReset: () => void;
}

export const ResetButton: React.FC<Props> = ({ onReset }) => {
  return (
    <button
      type="button"
      onClick={onReset}
      className="dd-btn flex items-center justify-center gap-1.5 border-critical bg-critical/15 px-3 py-2 text-xs font-extrabold text-critical hover:bg-critical/25"
    >
      <Trash2 className="w-3.5 h-3.5" />
      <span>Reset Semua Hasil</span>
    </button>
  );
};
