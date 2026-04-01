'use client';

import { useState } from 'react';

interface Props {
  value: string | null;
  onChange: (tile: string) => void;
}

const SUITS = [
  { label: '萬', value: 'm' },
  { label: '筒', value: 'p' },
  { label: '條', value: 's' },
  { label: '字', value: 'z' },
];

export default function TilePicker({ value, onChange }: Props) {
  const [selectedSuit, setSelectedSuit] = useState<'m' | 'p' | 's' | 'z'>('m');

  const renderTiles = () => {
    if (selectedSuit === 'z') {
      const honors = ['東', '南', '西', '北', '白', '發', '中'];

      return honors.map((label, i) => {
        const tile = `z${i + 1}`;
        const isActive = value === tile;

        return (
          <button
            key={tile}
            type="button"
            onClick={() => onChange(tile)}
            className={`rounded-xl px-3 py-4 text-lg font-semibold transition ${
              isActive
                ? 'bg-[#B6FF00] text-black'
                : 'bg-black/20 text-white border border-white/10'
            }`}
          >
            {label}
          </button>
        );
      });
    }

    return Array.from({ length: 9 }).map((_, i) => {
      const tile = `${selectedSuit}${i + 1}`;
      const isActive = value === tile;

      return (
        <button
          key={tile}
          type="button"
          onClick={() => onChange(tile)}
          className={`rounded-xl px-3 py-4 text-lg font-semibold transition ${
            isActive
              ? 'bg-[#B6FF00] text-black'
              : 'bg-black/20 text-white border border-white/10'
          }`}
        >
          {i + 1}
        </button>
      );
    });
  };

  return (
    <div className="space-y-3">
      <label className="text-sm text-neutral-300">Winning Tile</label>

      {/* Suit selector */}
      <div className="grid grid-cols-4 gap-2">
        {SUITS.map((suit) => (
          <button
            key={suit.value}
            type="button"
            onClick={() => setSelectedSuit(suit.value as any)}
            className={`rounded-xl py-2 text-sm font-semibold ${
              selectedSuit === suit.value
                ? 'bg-[#B6FF00] text-black'
                : 'bg-black/20 text-white border border-white/10'
            }`}
          >
            {suit.label}
          </button>
        ))}
      </div>

      {/* Tile grid */}
      <div className="grid grid-cols-7 gap-2">{renderTiles()}</div>

      {value && (
        <div className="text-xs text-neutral-400">
          Selected: {value}
        </div>
      )}
    </div>
  );
}