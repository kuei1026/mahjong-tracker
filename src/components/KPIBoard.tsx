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
    <section className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-6">
      <h2 className="mb-4 text-2xl font-semibold">📊 數據分析</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map((s) => (
          <div
            key={s.playerName}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <h3 className="text-lg font-semibold text-white">{s.playerName}</h3>

            {titles[s.playerName] ? (
              <p className="mt-1 text-sm text-[#B6FF00]">{titles[s.playerName]}</p>
            ) : null}

            <div className="mt-3 space-y-1 text-sm text-neutral-300">
              <p>胡牌數：{s.winCount}</p>
              <p>自摸次數：{s.tsumoCount}</p>
              <p>放槍次數：{s.dealInCount}</p>
              <p>平均台數：{s.avgTai.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}