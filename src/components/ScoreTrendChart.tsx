'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ScoreChange, RoomPlayer } from '@/types/game';

interface Props {
  scoreChanges: ScoreChange[];
  players: RoomPlayer[];
}

const COLORS = ['#B6FF00', '#4FD1C5', '#F6AD55', '#FC8181'];

export default function ScoreTrendChart({ scoreChanges, players }: Props) {
  // Step 1: 初始化玩家分數
  const scoreMap: Record<number, number> = {};
  players.forEach((p) => {
    scoreMap[p.seat_index] = 0;
  });

  // Step 2: 依時間排序
  const sorted = [...scoreChanges].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  );

  // Step 3: 建立 chart data
  const chartData: any[] = [];

  sorted.forEach((change, index) => {
    scoreMap[change.seat_index] += change.delta_score;

    const snapshot: any = {
      hand: index + 1,
    };

    players.forEach((p) => {
      snapshot[p.player_name] = scoreMap[p.seat_index];
    });

    chartData.push(snapshot);
  });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
      <h2 className="mb-4 text-2xl font-semibold">Score Trend</h2>

      {chartData.length === 0 ? (
        <p className="text-sm text-neutral-400">No data yet.</p>
      ) : (
        <div className="h-[300px] w-full">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <XAxis
                dataKey="hand"
                stroke="#aaa"
                tick={{ fill: '#aaa' }}
              />
              <YAxis stroke="#aaa" tick={{ fill: '#aaa' }} />
              <Tooltip />
              <Legend />

              {players.map((p, index) => (
                <Line
                  key={p.id}
                  type="monotone"
                  dataKey={p.player_name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}