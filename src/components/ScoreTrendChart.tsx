'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RecordItem, RoomPlayer, ScoreChange } from '@/types/game';

interface Props {
  records: RecordItem[];
  scoreChanges: ScoreChange[];
  players: RoomPlayer[];
}

const COLORS = ['#B6FF00', '#67E8F9', '#FDBA74', '#FB7185'];

export default function ScoreTrendChart({
  records,
  scoreChanges,
  players,
}: Props) {
  const sortedPlayers = [...players].sort((a, b) => a.seat_index - b.seat_index);

  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const scoreMap: Record<number, number> = {};
  sortedPlayers.forEach((player) => {
    scoreMap[player.seat_index] = 0;
  });

  const chartData = sortedRecords.map((record, index) => {
    const currentHandScoreChanges = scoreChanges.filter(
      (change) => change.hand_id === record.hand_id
    );

    currentHandScoreChanges.forEach((change) => {
      scoreMap[change.seat_index] =
        (scoreMap[change.seat_index] ?? 0) + change.delta_score;
    });

    const snapshot: Record<string, string | number> = {
      hand: index + 1,
    };

    sortedPlayers.forEach((player) => {
      snapshot[player.player_name] = scoreMap[player.seat_index] ?? 0;
    });

    return snapshot;
  });

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">📈 分數走勢</h2>
        <p className="mt-2 text-sm text-neutral-400">
          依每一手紀錄重建累積分數變化。
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-sm text-neutral-400">
          目前還沒有足夠的對局資料可顯示走勢圖。
        </div>
      ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="hand"
                stroke="#A3A3A3"
                tick={{ fill: '#A3A3A3', fontSize: 12 }}
                label={{ value: '局數', position: 'insideBottom', offset: -4, fill: '#A3A3A3' }}
              />
              <YAxis
                stroke="#A3A3A3"
                tick={{ fill: '#A3A3A3', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F1F1F',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={(label) => `第 ${label} 手`}
              />
              <Legend />
              {sortedPlayers.map((player, index) => (
                <Line
                  key={player.id}
                  type="monotone"
                  dataKey={player.player_name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}