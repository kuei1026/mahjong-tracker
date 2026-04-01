'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { RecordItem, Room, RoomPlayer, ScoreChange } from '@/types/game';
import ActionPanel from '@/components/ActionPanel';
import HandHistory from '@/components/HandHistory';
import UndoLastRecordButton from '@/components/UndoLastRecordButton';
import KPIBoard from '@/components/KPIBoard';
import ScoreTrendChart from '@/components/ScoreTrendChart';

const LOCAL_STORAGE_USER_NAME_KEY = 'mahjong_tracker_user_name';

type PlayerWithScore = RoomPlayer & {
  totalScore: number;
};

const AVATAR_BG_CLASSES = [
  'bg-lime-300 text-black',
  'bg-cyan-300 text-black',
  'bg-orange-300 text-black',
  'bg-pink-300 text-black',
];

function getAvatarText(name: string) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function formatLocalDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('zh-TW', {
    hour12: false,
  });
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [scoreChanges, setScoreChanges] = useState<ScoreChange[]>([]);
  const [currentUserName, setCurrentUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchRoomData = useCallback(async () => {
    if (!roomId) return;

    try {
      const [roomRes, playersRes, recordsRes, scoreChangesRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).single(),
        supabase
          .from('room_players')
          .select('*')
          .eq('room_id', roomId)
          .order('seat_index', { ascending: true }),
        supabase
          .from('records')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true }),
        supabase
          .from('score_changes')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true }),
      ]);

      if (roomRes.error || !roomRes.data) {
        throw roomRes.error ?? new Error('Room not found.');
      }

      if (playersRes.error) throw playersRes.error;
      if (recordsRes.error) throw recordsRes.error;
      if (scoreChangesRes.error) throw scoreChangesRes.error;

      setRoom(roomRes.data);
      setPlayers(playersRes.data ?? []);
      setRecords(recordsRes.data ?? []);
      setScoreChanges(scoreChangesRes.data ?? []);
      setErrorMessage('');
    } catch (error) {
      console.error('[fetchRoomData] failed:', error);
      setErrorMessage('載入房間資料失敗。');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    const savedUserName =
      localStorage.getItem(LOCAL_STORAGE_USER_NAME_KEY) ?? '';
    setCurrentUserName(savedUserName);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRoomData();
  }, [fetchRoomData]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room-${roomId}-realtime`);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'score_changes',
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        await fetchRoomData();
      }
    );

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'records',
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        await fetchRoomData();
      }
    );

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      async () => {
        await fetchRoomData();
      }
    );

    channel.subscribe((status) => {
      console.log('[Realtime] channel status:', status);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchRoomData]);

  const playersWithScores = useMemo<PlayerWithScore[]>(() => {
    const scoreMap = new Map<number, number>();

    for (const change of scoreChanges) {
      const currentScore = scoreMap.get(change.seat_index) ?? 0;
      scoreMap.set(change.seat_index, currentScore + change.delta_score);
    }

    return [...players]
      .map((player) => ({
        ...player,
        totalScore: scoreMap.get(player.seat_index) ?? 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [players, scoreChanges]);

  const isOwner = useMemo(() => {
    if (!room || !currentUserName) return false;

    return (
      room.owner_name.trim().toLowerCase() ===
      currentUserName.trim().toLowerCase()
    );
  }, [room, currentUserName]);

  const topPlayer = playersWithScores[0] ?? null;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#1B1B1B] px-4 py-6 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-neutral-300 shadow-lg backdrop-blur">
            載入對局資料中...
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage || !room) {
    return (
      <main className="min-h-screen bg-[#1B1B1B] px-4 py-6 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-6 text-red-200 shadow-lg">
            {errorMessage || '找不到房間。'}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#1B1B1B] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/8 to-white/4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr] lg:p-8">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
                  Mahjong Tracker
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold sm:text-4xl">
                    🀄 對局總覽
                  </h1>
                  <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-sm font-medium text-lime-200">
                    房號 {room.room_code}
                  </span>
                </div>
                <p className="text-sm leading-7 text-neutral-400 sm:text-base">
                  即時同步比分、紀錄每一手，讓整場牌局的變化一眼看懂。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    房主
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {room.owner_name}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    當前局數
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    第 {room.current_hand_no} 手
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    你的身份
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {isOwner ? '房主' : '觀看者'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    目前領先
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {topPlayer ? topPlayer.player_name : '—'}
                  </h2>
                </div>

                <div className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-sm font-medium text-lime-200">
                  即時排名
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {topPlayer ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
                          AVATAR_BG_CLASSES[topPlayer.seat_index % AVATAR_BG_CLASSES.length]
                        }`}
                      >
                        {getAvatarText(topPlayer.player_name)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-white">
                          {topPlayer.player_name}
                        </p>
                        <p className="text-sm text-neutral-400">
                          第 {topPlayer.seat_index + 1} 位
                          {topPlayer.is_owner ? ' · 房主' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#B6FF00] px-4 py-4 text-black">
                      <p className="text-sm font-medium opacity-70">目前總分</p>
                      <p className="mt-1 text-3xl font-bold">
                        {topPlayer.totalScore > 0
                          ? `+${topPlayer.totalScore}`
                          : topPlayer.totalScore}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">尚無玩家資料</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">🏆 玩家排名</h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    依目前總分即時更新，讓牌局領先狀況一眼看懂。
                  </p>
                </div>

                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-neutral-300">
                  共 {players.length} 位玩家
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {playersWithScores.map((player, index) => {
                  const isPositive = player.totalScore >= 0;
                  const isLeader = index === 0;

                  return (
                    <div
                      key={player.id}
                      className={`rounded-[24px] border p-5 transition ${
                        isLeader
                          ? 'border-lime-300/30 bg-lime-300/10 shadow-[0_10px_30px_rgba(182,255,0,0.08)]'
                          : 'border-white/10 bg-black/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-4">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                              AVATAR_BG_CLASSES[
                                player.seat_index % AVATAR_BG_CLASSES.length
                              ]
                            }`}
                          >
                            {getAvatarText(player.player_name)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-semibold text-white">
                                {player.player_name}
                              </p>
                              {player.is_owner ? (
                                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-xs text-neutral-300">
                                  房主
                                </span>
                              ) : null}
                              {isLeader ? (
                                <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-2 py-0.5 text-xs text-lime-200">
                                  領先中
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-neutral-400">
                              第 {player.seat_index + 1} 位 · 排名 #{index + 1}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`rounded-2xl px-4 py-2 text-lg font-bold ${
                            isPositive
                              ? 'bg-[#B6FF00] text-black'
                              : 'bg-[#FF5F5F] text-white'
                          }`}
                        >
                          {player.totalScore > 0
                            ? `+${player.totalScore}`
                            : player.totalScore}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {isOwner ? (
              <>
                <ActionPanel room={room} players={players} onRecorded={fetchRoomData} />
                <UndoLastRecordButton room={room} onUndone={fetchRoomData} />
              </>
            ) : (
              <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
                <h2 className="text-2xl font-semibold">👀 觀看模式</h2>
                <p className="mt-3 text-sm leading-7 text-neutral-400">
                  目前只有房主可以紀錄牌局。你現在可以即時查看排名、趨勢圖、數據分析與歷史紀錄。
                </p>
              </section>
            )}

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-2 shadow-lg backdrop-blur sm:p-3">
              <ScoreTrendChart scoreChanges={scoreChanges} players={players} />
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-2 shadow-lg backdrop-blur sm:p-3">
              <KPIBoard records={records} players={players} />
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-2 shadow-lg backdrop-blur sm:p-3">
              <HandHistory records={records} players={players} />
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
              <h2 className="text-2xl font-semibold">📌 房間資訊</h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">房號</span>
                  <span className="font-medium text-white">{room.room_code}</span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">房間狀態</span>
                  <span className="font-medium text-white">
                    {room.status === 'active' ? '進行中' : '已結束'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">每台金額</span>
                  <span className="font-medium text-white">
                    {room.tai_unit_amount}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">相公罰分</span>
                  <span className="font-medium text-white">
                    {room.misdeal_penalty}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">目前局數</span>
                  <span className="font-medium text-white">
                    第 {room.current_hand_no} 手
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">總分數事件</span>
                  <span className="font-medium text-white">
                    {scoreChanges.length}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">總紀錄數</span>
                  <span className="font-medium text-white">{records.length}</span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">目前使用者</span>
                  <span className="font-medium text-white">
                    {currentUserName || '未識別'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">建立時間</span>
                  <span className="font-medium text-white">
                    {formatLocalDateTime(room.created_at)}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
              <h2 className="text-2xl font-semibold">🧮 計分規則</h2>

              <div className="mt-4 space-y-3 text-sm leading-7 text-neutral-400">
                <p>自摸：贏家獲得 3 倍，其餘三家各支付 1 倍。</p>
                <p>胡牌：放槍者單獨支付全部台數金額給贏家。</p>
                <p>流局：本版暫不變動分數。</p>
                <p>相公：指定玩家扣除固定罰分。</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
              <h2 className="text-2xl font-semibold">✨ 接下來可升級</h2>

              <div className="mt-4 space-y-3 text-sm leading-7 text-neutral-400">
                <p>• 玩家頭貼上傳與自訂暱稱顯示</p>
                <p>• 聽牌牌型紀錄與 Tile Picker v2</p>
                <p>• 場次結算頁與分享戰報圖片</p>
                <p>• 稱號卡片與更多麻將數據分析</p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}