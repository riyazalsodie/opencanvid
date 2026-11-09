import React from 'react';
import { Check } from 'lucide-react';

interface SleekCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export const SleekCheckbox: React.FC<SleekCheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
  className = '',
  size = 'md',
}) => {
  const boxSize = size === 'sm' ? 'w-4 h-4 rounded-[5px]' : 'w-[18px] h-[18px] rounded-[6px]';
  const iconSize = size === 'sm' ? 'w-3 h-3 stroke-[2.8]' : 'w-3.5 h-3.5 stroke-[2.6]';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`group flex items-center justify-between cursor-pointer select-none py-1.5 transition-colors ${className}`}
    >
      {(label || description) && (
        <div className="flex flex-col pr-3">
          {label && (
            <span className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors tracking-tight">
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 leading-tight transition-colors">
              {description}
            </span>
          )}
        </div>
      )}
      <div
        className={`${boxSize} flex items-center justify-center shrink-0 border transition-all duration-150 ${
          checked
            ? 'bg-[#8b5cf6] border-[#a78bfa] text-white shadow-[0_0_10px_rgba(139,92,246,0.4)]'
            : 'bg-[#18181c] border-zinc-700/80 group-hover:border-zinc-500 text-transparent'
        }`}
      >
        <Check
          className={`${iconSize} transition-transform duration-150 ${
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
        />
      </div>
    </div>
  );
};

interface SleekSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

export const SleekSwitch: React.FC<SleekSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  className = '',
}) => {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`group flex items-center justify-between cursor-pointer select-none py-1 transition-colors ${className}`}
    >
      {(label || description) && (
        <div className="flex flex-col pr-3">
          {label && (
            <span className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors tracking-tight">
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 leading-tight transition-colors">
              {description}
            </span>
          )}
        </div>
      )}
      <div
        className={`w-9 h-5 rounded-full p-[2px] transition-colors duration-200 ease-in-out shrink-0 border ${
          checked
            ? 'bg-[#8b5cf6] border-[#9333ea] shadow-[0_0_8px_rgba(139,92,246,0.35)]'
            : 'bg-[#222226] border-zinc-700/70 group-hover:border-zinc-600'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
};
