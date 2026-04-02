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
import { getRoundLabel, getSeatWind } from '@/lib/gameLogic';
import type { RecordItem, RoomPlayer, ScoreChange } from '@/types/game';

interface Props {
  records: RecordItem[];
  scoreChanges: ScoreChange[];
  players: RoomPlayer[];
}

const COLORS = ['#B6FF00', '#67E8F9', '#FDBA74', '#FB7185'];

type ChartRow = {
  hand: number;
  roundLabel: string;
  dealerName: string;
  dealerStreak: number;
  resultLabel: string;
  createdAt: string;
  [playerName: string]: string | number;
};

function getResultLabel(resultType: RecordItem['result_type']) {
  switch (resultType) {
    case 'tsumo':
      return '自摸';
    case 'ron':
      return '胡牌';
    case 'draw':
      return '流局';
    default:
      return resultType;
  }
}

function getPlayerNameBySeat(players: RoomPlayer[], seatIndex: number | null | undefined): string {
  if (seatIndex === null || seatIndex === undefined) return '-';
  const matchedPlayer = players.find((player) => player.seat_index === seatIndex);
  return matchedPlayer?.player_name ?? getSeatWind(seatIndex);
}

export default function ScoreTrendChart({
  records,
  scoreChanges,
  players,
}: Props) {
  const sortedPlayers = [...players].sort((a, b) => a.seat_index - b.seat_index);

  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const scoreChangesByHandId = new Map<string, ScoreChange[]>();
  scoreChanges.forEach((change) => {
    const current = scoreChangesByHandId.get(change.hand_id) ?? [];
    current.push(change);
    scoreChangesByHandId.set(change.hand_id, current);
  });

  const scoreMap: Record<number, number> = {};
  sortedPlayers.forEach((player) => {
    scoreMap[player.seat_index] = 0;
  });

  const chartData: ChartRow[] = sortedRecords.map((record, index) => {
    const currentHandScoreChanges = scoreChangesByHandId.get(record.hand_id) ?? [];

    currentHandScoreChanges.forEach((change) => {
      scoreMap[change.seat_index] =
        (scoreMap[change.seat_index] ?? 0) + change.delta_score;
    });

    const dealerSeatIndex = record.dealer_seat_index_before ?? 0;
    const roundWind = record.round_wind_before ?? 0;

    const snapshot: ChartRow = {
      hand: index + 1,
      roundLabel: getRoundLabel(roundWind, dealerSeatIndex),
      dealerName: getPlayerNameBySeat(sortedPlayers, dealerSeatIndex),
      dealerStreak: record.dealer_streak_before ?? 0,
      resultLabel: getResultLabel(record.result_type),
      createdAt: record.created_at,
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
          依每一手紀錄重建累積分數變化，並顯示當時局面資訊。
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
                label={{ value: '手數', position: 'insideBottom', offset: -4, fill: '#A3A3A3' }}
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
                formatter={(value, name) => [Number(value ?? 0), String(name ?? '')]}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as ChartRow | undefined;
                  if (!row) return `第 ${label} 手`;

                  const streakText =
                    row.dealerStreak > 0 ? `｜莊家連 ${row.dealerStreak}` : '';

                  return `第 ${label} 手｜${row.roundLabel}｜莊家：${row.dealerName}${streakText}｜${row.resultLabel}`;
                }}
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