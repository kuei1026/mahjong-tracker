'use client';

import { useMemo, useRef } from 'react';

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

const SWIPE_THRESHOLD = 18;

export default function WheelSelector<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className = '',
}: WheelSelectorProps<T>) {
  const touchStartYRef = useRef<number | null>(null);

  const currentIndex = useMemo(() => {
    const foundIndex = options.findIndex((opt) => opt.value === value);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [options, value]);

  const prevIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
  const nextIndex = currentIndex >= options.length - 1 ? 0 : currentIndex + 1;

  const prevOption = options[prevIndex];
  const currentOption = options[currentIndex];
  const nextOption = options[nextIndex];

  const handlePrev = () => {
    if (options.length === 0) return;
    onChange(options[prevIndex].value);
  };

  const handleNext = () => {
    if (options.length === 0) return;
    onChange(options[nextIndex].value);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (Math.abs(event.deltaY) < 2) return;

    if (event.deltaY > 0) {
      handleNext();
    } else {
      handlePrev();
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null) return;

    const endY = event.changedTouches[0]?.clientY ?? touchStartYRef.current;
    const diff = endY - touchStartYRef.current;

    if (Math.abs(diff) >= SWIPE_THRESHOLD) {
      if (diff > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }

    touchStartYRef.current = null;
  };

  return (
    <div
      className={`rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-3 ${className}`}
    >
      <div className="mb-2">
        <p className="text-[11px] font-bold tracking-[0.18em] text-neutral-500 uppercase">
          {label}
        </p>
      </div>

      <div
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative h-[148px] overflow-hidden rounded-[20px] border border-white/5 bg-black/35"
      >
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-[44px] -translate-y-1/2 rounded-[18px] border border-[#B6FF00]/15 bg-[#B6FF00]/8 shadow-[inset_0_0_20px_rgba(182,255,0,0.08)]" />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/35 to-transparent" />

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-[36px] w-full items-center justify-center text-center"
            aria-label={`${label}上一個`}
          >
            <span className="truncate px-4 text-[18px] font-bold text-white/20">
              {prevOption?.label ?? ''}
            </span>
          </button>

          <button
            type="button"
            className="flex h-[52px] w-full items-center justify-center text-center"
            aria-label={`${label}目前值`}
          >
            <span className="truncate px-4 text-[24px] font-black tracking-tight text-[#B6FF00]">
              {currentOption?.label ?? ''}
            </span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="flex h-[36px] w-full items-center justify-center text-center"
            aria-label={`${label}下一個`}
          >
            <span className="truncate px-4 text-[18px] font-bold text-white/20">
              {nextOption?.label ?? ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}