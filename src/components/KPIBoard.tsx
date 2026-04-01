'use client';

import { calculateStats } from '@/lib/analytics';
import { generateTitles } from '@/lib/titles';
import type { RecordItem, RoomPlayer } from '@/types/game';

interface Props {
  records: RecordItem[];
  players: RoomPlayer[];
}

export default function KPIBoard({ records, players }: Props) {
  const stats = calculateStats(records, players);
  const titles = generateTitles(stats);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-2xl font-semibold mb-4">Game Insights</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map((s) => (
          <div
            key={s.playerName}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <h3 className="text-lg font-semibold">
              {s.playerName}
            </h3>

            {titles[s.playerName] && (
              <p className="text-sm text-[#B6FF00] mt-1">
                {titles[s.playerName]}
              </p>
            )}

            <div className="mt-3 text-sm text-neutral-300 space-y-1">
              <p>Win: {s.winCount}</p>
              <p>Tsumo: {s.tsumoCount}</p>
              <p>Deal-in: {s.dealInCount}</p>
              <p>Avg Tai: {s.avgTai.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}