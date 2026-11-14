import React from 'react';
import SquishSwitch from './SquishSwitch';

interface SleekCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  width?: number;
  height?: number;
  radius?: number;
}

interface SleekSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  width?: number;
  height?: number;
  radius?: number;
}

const renderToggleRow = ({
  checked,
  onChange,
  label,
  description,
  className = '',
  disabled = false,
  width = 48,
  height = 24,
  radius = 12,
}: SleekSwitchProps) => {
  return (
    <div
      className={`group flex items-center justify-between select-none py-1 transition-colors ${className}`}
    >
      {(label || description) && (
        <div
          onClick={(e) => {
            if (disabled) return;
            e.stopPropagation();
            onChange(!checked);
          }}
          className={`flex flex-col pr-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
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
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <SquishSwitch
          checked={checked}
          onChange={onChange}
          trackColor="#27272a"
          trackOnColor="#f5f5f5"
          thumbColor="#4e4e51"
          thumbOnColor="#27272a"
          width={width}
          height={height}
          radius={radius}
          speed={50}
          stretch={36}
          hoverScale={1.035}
          colorDuration={320}
          disabled={disabled}
          ariaLabel={typeof label === 'string' ? label : 'Toggle'}
        />
      </div>
    </div>
  );
};

export const SleekCheckbox: React.FC<SleekCheckboxProps> = ({
  size = 'md',
  width,
  height,
  radius,
  ...rest
}) => {
  const w = width ?? (size === 'sm' ? 42 : 48);
  const h = height ?? (size === 'sm' ? 22 : 24);
  const r = radius ?? Math.round(h / 2);
  return renderToggleRow({ ...rest, width: w, height: h, radius: r });
};

export const SleekSwitch: React.FC<SleekSwitchProps> = (props) => {
  return renderToggleRow(props);
};
