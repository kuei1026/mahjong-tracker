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

const SWIPE_THRESHOLD = 16;

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
    event.stopPropagation();

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

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
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
      className={`rounded-[20px] border border-white/10 bg-white/[0.04] px-2.5 py-2.5 ${className}`}
    >
      <div className="mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </p>
      </div>

      <div
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
        className="relative h-[122px] overflow-hidden rounded-[18px] border border-white/5 bg-black/35"
      >
        <div className="pointer-events-none absolute inset-x-2.5 top-1/2 h-[40px] -translate-y-1/2 rounded-[16px] border border-[#B6FF00]/15 bg-[#B6FF00]/8 shadow-[inset_0_0_16px_rgba(182,255,0,0.08)]" />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-[28px] w-full items-center justify-center text-center"
            aria-label={`${label}上一個`}
          >
            <span className="truncate px-3 text-[15px] font-bold text-white/18">
              {prevOption?.label ?? ''}
            </span>
          </button>

          <button
            type="button"
            className="flex h-[44px] w-full items-center justify-center text-center"
            aria-label={`${label}目前值`}
          >
            <span className="truncate px-3 text-[22px] font-black tracking-tight text-[#B6FF00]">
              {currentOption?.label ?? ''}
            </span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="flex h-[28px] w-full items-center justify-center text-center"
            aria-label={`${label}下一個`}
          >
            <span className="truncate px-3 text-[15px] font-bold text-white/18">
              {nextOption?.label ?? ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}