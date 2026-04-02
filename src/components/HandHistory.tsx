'use client';

import { useMemo, useState } from 'react';
import type { RecordItem, RoomPlayer, WaitType } from '@/types/game';

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
  return matchedPlayer?.player_name ?? `第 ${seatIndex + 1} 位`;
}

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

function getWaitTypeLabel(waitType: WaitType | null): string {
  switch (waitType) {
    case 'single_wait':
      return '單吊';
    case 'double_sided':
      return '雙頭';
    case 'double_pair':
      return '對對';
    case 'edge_wait':
      return '邊章';
    case 'triple_wait':
      return '三個洞';
    case 'multi_wait':
      return '很多洞';
    default:
      return '-';
  }
}

function getSummary(record: RecordItem, players: RoomPlayer[]) {
  const winnerName = getPlayerNameBySeat(players, record.winner_seat);
  const loserName = getPlayerNameBySeat(players, record.loser_seat);

  switch (record.result_type) {
    case 'tsumo':
      return `${winnerName} 自摸 · ${record.tai_count} 台`;
    case 'ron':
      return `${winnerName} 胡牌 · ${loserName} 放槍 · ${record.tai_count} 台`;
    case 'draw':
      return '本手流局';
    default:
      return '';
  }
}

export default function HandHistory({
  records,
  players,
}: HandHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [records]
  );

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">🧾 牌局紀錄</h2>
          <p className="mt-2 text-sm text-neutral-400">
            預設收合顯示，需要時再展開查看每一手內容。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-neutral-300">
            {records.length} 筆紀錄
          </div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-full border border-white/10 bg-black/20 px-4 py-1.5 text-sm font-medium text-white transition hover:border-white/20"
          >
            {expanded ? '收起' : '展開'}
          </button>
        </div>
      </div>

      {sortedRecords.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-neutral-400">
          目前尚無牌局紀錄。
        </div>
      ) : expanded ? (
        <div className="mt-5 space-y-3">
          {sortedRecords.map((record, index) => {
            const misdealPlayerName = getPlayerNameBySeat(
              players,
              record.misdeal_seat ?? null
            );

            const showWinMeta =
              record.result_type === 'tsumo' || record.result_type === 'ron';

            return (
              <div
                key={record.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-neutral-300">
                        第 {records.length - index} 手
                      </span>
                      <span className="text-sm font-semibold text-[#B6FF00]">
                        {getResultLabel(record.result_type)}
                      </span>
                    </div>

                    <p className="text-sm text-neutral-200">
                      {getSummary(record, players)}
                    </p>

                    {showWinMeta && record.wait_type ? (
                      <p className="text-sm text-neutral-400">
                        聽型：{getWaitTypeLabel(record.wait_type)}
                      </p>
                    ) : null}

                    {showWinMeta && record.winning_tile ? (
                      <p className="text-sm text-neutral-400">
                        胡牌張：{record.winning_tile}
                      </p>
                    ) : null}

                    {record.misdeal_seat !== null && record.misdeal_seat !== undefined ? (
                      <p className="text-sm text-amber-300">
                        本手相公：{misdealPlayerName}
                      </p>
                    ) : null}

                    {record.misdeal_note ? (
                      <p className="text-sm text-neutral-400">
                        相公備註：{record.misdeal_note}
                      </p>
                    ) : null}

                    {record.note ? (
                      <p className="text-sm text-neutral-400">
                        備註：{record.note}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-sm text-neutral-500">
                    {new Date(record.created_at).toLocaleString('zh-TW', {
                      hour12: false,
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {sortedRecords.slice(0, 3).map((record, index) => {
            const misdealPlayerName = getPlayerNameBySeat(
              players,
              record.misdeal_seat ?? null
            );

            const showWinMeta =
              record.result_type === 'tsumo' || record.result_type === 'ron';

            return (
              <div
                key={record.id}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      第 {records.length - index} 手 · {getResultLabel(record.result_type)}
                    </p>

                    <p className="mt-1 truncate text-sm text-neutral-400">
                      {getSummary(record, players)}
                    </p>

                    {showWinMeta && (record.wait_type || record.winning_tile) ? (
                      <p className="mt-1 truncate text-sm text-neutral-500">
                        {record.wait_type
                          ? `聽型：${getWaitTypeLabel(record.wait_type)}`
                          : ''}
                        {record.wait_type && record.winning_tile ? ' · ' : ''}
                        {record.winning_tile ? `胡牌張：${record.winning_tile}` : ''}
                      </p>
                    ) : null}

                    {record.misdeal_seat !== null && record.misdeal_seat !== undefined ? (
                      <p className="mt-1 truncate text-sm text-amber-300">
                        本手相公：{misdealPlayerName}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-sm text-neutral-500">
                    {new Date(record.created_at).toLocaleTimeString('zh-TW', {
                      hour12: false,
                    })}
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