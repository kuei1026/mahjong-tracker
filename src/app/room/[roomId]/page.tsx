'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { RecordItem, Room, RoomPlayer, ScoreChange } from '@/types/game';
import ActionPanel from '@/components/ActionPanel';
import HandHistory from '@/components/HandHistory';
import UndoLastRecordButton from '@/components/UndoLastRecordButton';
import ScoreTrendChart from '@/components/ScoreTrendChart';
import KPIBoard from '@/components/KPIBoard';

const LOCAL_STORAGE_USER_NAME_KEY = 'mahjong_tracker_user_name';

type PlayerWithScore = RoomPlayer & {
  totalScore: number;
};

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

    console.log('[fetchRoomData] start:', roomId);

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

      if (playersRes.error) {
        throw playersRes.error;
      }

      if (recordsRes.error) {
        throw recordsRes.error;
      }

      if (scoreChangesRes.error) {
        throw scoreChangesRes.error;
      }

      console.log('[fetchRoomData] success:', {
        room: roomRes.data,
        playersCount: playersRes.data?.length ?? 0,
        recordsCount: recordsRes.data?.length ?? 0,
        scoreChangesCount: scoreChangesRes.data?.length ?? 0,
      });

      setRoom(roomRes.data);
      setPlayers(playersRes.data ?? []);
      setRecords(recordsRes.data ?? []);
      setScoreChanges(scoreChangesRes.data ?? []);
      setErrorMessage('');
    } catch (error) {
      console.error('[fetchRoomData] failed:', error);
      setErrorMessage('Failed to load room data.');
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

    console.log('[Realtime] creating channel for room:', roomId);

    const channel = supabase.channel(`room-${roomId}-realtime`);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'score_changes',
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        console.log('[Realtime] score_changes INSERT:', payload);
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
      async (payload) => {
        console.log('[Realtime] records INSERT:', payload);
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
      async (payload) => {
        console.log('[Realtime] rooms UPDATE:', payload);
        await fetchRoomData();
      }
    );

    channel.subscribe((status) => {
      console.log('[Realtime] channel status:', status);
    });

    return () => {
      console.log('[Realtime] removing channel for room:', roomId);
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

    return room.owner_name.trim().toLowerCase() === currentUserName.trim().toLowerCase();
  }, [room, currentUserName]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#1B1B1B] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            Loading room...
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage || !room) {
    return (
      <main className="min-h-screen bg-[#1B1B1B] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-6 text-red-200">
            {errorMessage || 'Room not found.'}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#1B1B1B] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">
                Room Overview
              </p>
              <h1 className="text-4xl font-bold">Room {room.room_code}</h1>
              <p className="text-neutral-400">
                Owner: <span className="text-white">{room.owner_name}</span>
              </p>
              <p className="text-sm text-neutral-500">
                Current User:{' '}
                <span className="text-white">
                  {currentUserName || 'Unknown User'}
                </span>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Status
                </p>
                <p className="mt-2 text-lg font-semibold capitalize">
                  {room.status}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Tai Unit
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {room.tai_unit_amount}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Misdeal Penalty
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {room.misdeal_penalty}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Players & Scores</h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    Current total score ranking for this room.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-neutral-300">
                  {players.length} Players
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {playersWithScores.map((player, index) => {
                  const isPositive = player.totalScore >= 0;

                  return (
                    <div
                      key={player.id}
                      className="rounded-3xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-neutral-500">
                            Rank #{index + 1}
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold">
                            {player.player_name}
                          </h3>
                          <p className="mt-2 text-sm text-neutral-400">
                            Seat {player.seat_index + 1}
                            {player.is_owner ? ' · Owner' : ''}
                          </p>
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
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
                <h2 className="text-2xl font-semibold">View Only</h2>
                <p className="mt-3 text-sm leading-7 text-neutral-400">
                Only the room owner can record hand results in this version.
                </p>
            </section>
            )}

            <ScoreTrendChart
            scoreChanges={scoreChanges}
            players={players}
            />

            <KPIBoard
              records={records}
              players={players}
            />

            <HandHistory records={records} players={players} />
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
              <h2 className="text-2xl font-semibold">Room Info</h2>
              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">Room Code</span>
                  <span className="font-medium text-white">{room.room_code}</span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">Current Hand</span>
                  <span className="font-medium text-white">{room.current_hand_no}</span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">Total Score Events</span>
                  <span className="font-medium text-white">{scoreChanges.length}</span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">Total Records</span>
                  <span className="font-medium text-white">{records.length}</span>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-neutral-400">Permission</span>
                  <span className="font-medium text-white">
                    {isOwner ? 'Owner' : 'Viewer'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Created At</span>
                  <span className="font-medium text-white">
                    {new Date(room.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
              <h2 className="text-2xl font-semibold">Scoring Rule</h2>
              <div className="mt-4 space-y-3 text-sm text-neutral-400">
                <p>Tsumo: winner gets 3x, others each pay 1x.</p>
                <p>Ron: loser pays full amount to winner.</p>
                <p>Draw: no score change.</p>
                <p>Misdeal: selected player loses fixed penalty.</p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}