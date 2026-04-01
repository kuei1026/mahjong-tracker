'use client';

import type { RecordItem, RoomPlayer } from '@/types/game';

interface HandHistoryProps {
  records: RecordItem[];
  players: RoomPlayer[];
}

function getPlayerNameBySeat(
  players: RoomPlayer[],
  seatIndex: number | null
): string {
  if (seatIndex === null) return '-';

  const matchedPlayer = players.find((player) => player.seat_index === seatIndex);
  return matchedPlayer?.player_name ?? `Seat ${seatIndex + 1}`;
}

function getResultLabel(resultType: RecordItem['result_type']) {
  switch (resultType) {
    case 'tsumo':
      return 'Tsumo';
    case 'ron':
      return 'Ron';
    case 'draw':
      return 'Draw';
    case 'misdeal':
      return 'Misdeal';
    default:
      return resultType;
  }
}

export default function HandHistory({
  records,
  players,
}: HandHistoryProps) {
  const sortedRecords = [...records].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Hand History</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Review the result of each recorded hand.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-neutral-300">
          {records.length} Records
        </div>
      </div>

      {sortedRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-neutral-400">
          No hand records yet.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedRecords.map((record, index) => {
            const winnerName = getPlayerNameBySeat(players, record.winner_seat);
            const loserName = getPlayerNameBySeat(players, record.loser_seat);

            return (
              <div
                key={record.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-neutral-300">
                        Hand #{records.length - index}
                      </span>
                      <span className="text-sm font-medium text-[#B6FF00]">
                        {getResultLabel(record.result_type)}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-neutral-300">
                      {record.result_type === 'tsumo' ? (
                        <p>
                          Winner: <span className="text-white">{winnerName}</span> ·{' '}
                          {record.tai_count} tai
                        </p>
                      ) : null}

                      {record.result_type === 'ron' ? (
                        <p>
                          Winner: <span className="text-white">{winnerName}</span> ·
                          Loser: <span className="text-white"> {loserName}</span> ·{' '}
                          {record.tai_count} tai
                        </p>
                      ) : null}

                      {record.result_type === 'draw' ? <p>Draw hand.</p> : null}

                      {record.result_type === 'misdeal' ? (
                        <p>
                          Misdeal Player:{' '}
                          <span className="text-white">{loserName}</span>
                        </p>
                      ) : null}

                      {record.note ? (
                        <p className="text-neutral-400">Note: {record.note}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-sm text-neutral-500">
                    {new Date(record.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}