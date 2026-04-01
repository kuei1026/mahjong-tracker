'use client';

import { useMemo, useState } from 'react';

interface Props {
  value: string | null;
  onChange: (tile: string) => void;
}

const SUITS = [
  { label: '萬子', value: 'm' },
  { label: '筒子', value: 'p' },
  { label: '條子', value: 's' },
  { label: '字牌', value: 'z' },
];

const HONOR_LABELS = ['東', '南', '西', '北', '白', '發', '中'];

function getTileDisplay(tile: string | null) {
  if (!tile) return '尚未選擇';

  const suit = tile.charAt(0);
  const num = Number(tile.slice(1));

  if (suit === 'm') return `${num} 萬`;
  if (suit === 'p') return `${num} 筒`;
  if (suit === 's') return `${num} 條`;
  if (suit === 'z') return HONOR_LABELS[num - 1] ?? tile;

  return tile;
}

export default function TilePicker({ value, onChange }: Props) {
  const [selectedSuit, setSelectedSuit] = useState<'m' | 'p' | 's' | 'z'>('m');

  const tiles = useMemo(() => {
    if (selectedSuit === 'z') {
      return HONOR_LABELS.map((label, index) => ({
        code: `z${index + 1}`,
        label,
      }));
    }

    return Array.from({ length: 9 }).map((_, index) => ({
      code: `${selectedSuit}${index + 1}`,
      label: `${index + 1}`,
    }));
  }, [selectedSuit]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm text-neutral-300">胡牌張</label>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-neutral-300">
          已選：{getTileDisplay(value)}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {SUITS.map((suit) => {
          const isActive = selectedSuit === suit.value;

          return (
            <button
              key={suit.value}
              type="button"
              onClick={() => setSelectedSuit(suit.value as 'm' | 'p' | 's' | 'z')}
              className={`rounded-2xl px-3 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                isActive
                  ? 'bg-[#B6FF00] text-black shadow-lg'
                  : 'border border-white/10 bg-black/20 text-white hover:border-white/20'
              }`}
            >
              {suit.label}
            </button>
          );
        })}
      </div>

      <div
        className={`grid gap-2 ${
          selectedSuit === 'z' ? 'grid-cols-4 sm:grid-cols-7' : 'grid-cols-3 sm:grid-cols-9'
        }`}
      >
        {tiles.map((tile) => {
          const isActive = value === tile.code;

          return (
            <button
              key={tile.code}
              type="button"
              onClick={() => onChange(tile.code)}
              className={`min-h-[54px] rounded-2xl px-3 py-3 text-base font-semibold transition active:scale-[0.98] ${
                isActive
                  ? 'bg-[#B6FF00] text-black shadow-lg'
                  : 'border border-white/10 bg-black/20 text-white hover:border-white/20'
              }`}
            >
              {tile.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}