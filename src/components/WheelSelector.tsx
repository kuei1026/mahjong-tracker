'use client';

import { useMemo } from 'react';

export interface WheelOption<T extends string | number> {
  label: string;
  value: T;
}

interface WheelSelectorProps<T extends string | number> {
  label: string;
  value: T;
  options: WheelOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export default function WheelSelector<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className = '',
}: WheelSelectorProps<T>) {
  const currentIndex = useMemo(
    () => options.findIndex((opt) => opt.value === value),
    [options, value]
  );

  const prevOption =
    currentIndex > 0 ? options[currentIndex - 1] : options[options.length - 1];
  const currentOption =
    currentIndex >= 0 ? options[currentIndex] : options[0];
  const nextOption =
    currentIndex < options.length - 1 && currentIndex >= 0
      ? options[currentIndex + 1]
      : options[0];

  const handlePrev = () => {
    if (options.length === 0) return;
    const nextIndex =
      currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
    onChange(options[nextIndex].value);
  };

  const handleNext = () => {
    if (options.length === 0) return;
    const nextIndex =
      currentIndex >= options.length - 1 ? 0 : currentIndex + 1;
    onChange(options[nextIndex].value);
  };

  return (
    <div
      className={`rounded-[24px] border border-white/10 bg-white/5 p-3 ${className}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold tracking-[0.2em] text-neutral-500 uppercase">
          {label}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[20px] border border-white/5 bg-black/30 px-2 py-3">
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-14 -translate-y-1/2 rounded-2xl border border-[#B6FF00]/20 bg-[#B6FF00]/8 shadow-[inset_0_0_20px_rgba(182,255,0,0.05)]" />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-white transition active:scale-95"
            aria-label={`${label}上一個`}
          >
            ˄
          </button>

          <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
            <div className="h-5 text-xs text-neutral-600">
              {prevOption?.label ?? ''}
            </div>

            <div className="my-1 min-h-[56px] flex items-center justify-center px-2">
              <span className="truncate text-2xl font-black tracking-tight text-[#B6FF00]">
                {currentOption?.label ?? ''}
              </span>
            </div>

            <div className="h-5 text-xs text-neutral-600">
              {nextOption?.label ?? ''}
            </div>
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-white transition active:scale-95"
            aria-label={`${label}下一個`}
          >
            ˅
          </button>
        </div>
      </div>
    </div>
  );
}