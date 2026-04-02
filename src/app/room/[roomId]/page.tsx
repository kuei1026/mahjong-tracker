'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getRoundLabel, getSeatWind } from '@/lib/gameLogic';
import type { RecordItem, Room, RoomPlayer, ScoreChange } from '@/types/game';
import ActionPanel from '@/components/ActionPanel';
import HandHistory from '@/components/HandHistory';
import KPIBoard from '@/components/KPIBoard';
import ScoreTrendChart from '@/components/ScoreTrendChart';

const LOCAL_STORAGE_USER_NAME_KEY = 'mahjong_tracker_user_name';

const AVATAR_BG_CLASSES = [
  'bg-lime-400 text-black',
  'bg-cyan-400 text-black',
  'bg-orange-400 text-black',
  'bg-pink-400 text-black',
];

function getErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;

  if (typeof error === 'string') return error;

  if (error instanceof Error) return error.message || fallback;

  if (typeof error === 'object') {
    const err = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      error_description?: string;
    };

    return (
      err.message ||
      err.details ||
      err.hint ||
      err.error_description ||
      err.code ||
      fallback
    );
  }

  return fallback;
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
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  const [undoLoading, setUndoLoading] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');
  const [undoError, setUndoError] = useState('');

  const [finishLoading, setFinishLoading] = useState(false);
  const [finishMessage, setFinishMessage] = useState('');
  const [finishError, setFinishError] = useState('');

  const [saveMatchLoading, setSaveMatchLoading] = useState(false);
  const [saveMatchMessage, setSaveMatchMessage] = useState('');
  const [saveMatchError, setSaveMatchError] = useState('');

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

      if (roomRes.data) setRoom(roomRes.data);
      if (playersRes.data) setPlayers(playersRes.data);
      if (recordsRes.data) setRecords(recordsRes.data);
      if (scoreChangesRes.data) setScoreChanges(scoreChangesRes.data);
    } catch (e) {
      console.error('fetchRoomData failed:', e);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    setCurrentUserName(localStorage.getItem(LOCAL_STORAGE_USER_NAME_KEY) ?? '');
    fetchRoomData();
  }, [fetchRoomData]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room-${roomId}`);

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'records', filter: `room_id=eq.${roomId}` },
        fetchRoomData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_changes', filter: `room_id=eq.${roomId}` },
        fetchRoomData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        fetchRoomData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        fetchRoomData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchRoomData]);

  const playersWithScores = useMemo(() => {
    const scoreMap = new Map<number, number>();

    scoreChanges.forEach((c) => {
      scoreMap.set(c.seat_index, (scoreMap.get(c.seat_index) ?? 0) + c.delta_score);
    });

    return [...players]
      .sort((a, b) => a.seat_index - b.seat_index)
      .map((p) => ({
        ...p,
        totalScore: scoreMap.get(p.seat_index) ?? 0,
        seatWind: getSeatWind(p.seat_index),
      }));
  }, [players, scoreChanges]);

  const isOwner = useMemo(
    () => room?.owner_name === currentUserName,
    [room, currentUserName]
  );

  const currentRoundWind = room?.round_wind ?? 0;
  const currentDealerSeatIndex = room?.dealer_seat_index ?? 0;
  const currentDealerStreak = room?.dealer_streak ?? 0;

  const roundLabel = getRoundLabel(currentRoundWind, currentDealerSeatIndex);

  const dealerPlayer = useMemo(() => {
    return playersWithScores.find((player) => player.seat_index === currentDealerSeatIndex) ?? null;
  }, [playersWithScores, currentDealerSeatIndex]);

  const lastRecord = useMemo(() => {
    if (records.length === 0) return null;

    return [...records].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [records]);

  const handleUndoLastHand = useCallback(async () => {
    if (!room || !lastRecord || undoLoading) return;

    const confirmed = window.confirm('確定要撤銷最後一手紀錄嗎？');
    if (!confirmed) return;

    setUndoLoading(true);
    setUndoError('');
    setUndoMessage('');
    setFinishError('');
    setFinishMessage('');
    setSaveMatchError('');
    setSaveMatchMessage('');

    try {
      const restoredHandNo = Math.max(0, room.current_hand_no - 1);

      const { error: scoreChangesDeleteError } = await supabase
        .from('score_changes')
        .delete()
        .eq('hand_id', lastRecord.hand_id);

      if (scoreChangesDeleteError) throw scoreChangesDeleteError;

      const { error: recordDeleteError } = await supabase
        .from('records')
        .delete()
        .eq('id', lastRecord.id);

      if (recordDeleteError) throw recordDeleteError;

      const { error: handDeleteError } = await supabase
        .from('hands')
        .delete()
        .eq('id', lastRecord.hand_id);

      if (handDeleteError) throw handDeleteError;

      const { error: roomRollbackError } = await supabase
        .from('rooms')
        .update({
          current_hand_no: restoredHandNo,
          round_wind: lastRecord.round_wind_before ?? 0,
          dealer_seat_index: lastRecord.dealer_seat_index_before ?? 0,
          dealer_streak: lastRecord.dealer_streak_before ?? 0,
          status: 'active',
        })
        .eq('id', room.id);

      if (roomRollbackError) throw roomRollbackError;

      setUndoMessage('已撤銷最後一手');
      await fetchRoomData();
    } catch (error) {
      console.error('Undo last hand failed:', error);
      setUndoError(getErrorMessage(error, '撤銷失敗，請稍後再試'));
    } finally {
      setUndoLoading(false);
    }
  }, [room, lastRecord, undoLoading, fetchRoomData]);

  const handleFinishRoom = useCallback(async () => {
    if (!room || !isOwner || finishLoading) return;

    if (room.status === 'finished') {
      setFinishError('');
      setFinishMessage('此對局已經結束');
      return;
    }

    if (records.length === 0) {
      setFinishError('至少要有一筆紀錄後，才能結束對局');
      return;
    }

    const confirmed = window.confirm('確定要結束本場對局嗎？結束後將無法再新增手牌紀錄。');
    if (!confirmed) return;

    setFinishLoading(true);
    setFinishError('');
    setFinishMessage('');
    setUndoError('');
    setUndoMessage('');
    setSaveMatchError('');
    setSaveMatchMessage('');

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', room.id);

      if (error) throw error;

      setFinishMessage('本場對局已結束');
      await fetchRoomData();
    } catch (error) {
      console.error('Finish room failed:', error);
      setFinishError(getErrorMessage(error, '結束對局失敗，請稍後再試'));
    } finally {
      setFinishLoading(false);
    }
  }, [room, isOwner, finishLoading, records.length, fetchRoomData]);

  const handleSaveMatch = useCallback(async () => {
    if (!room || !isOwner || saveMatchLoading) return;

    if (room.status !== 'finished') {
      setSaveMatchError('請先完成整場對局，結束後才能保存');
      return;
    }

    if (records.length === 0 || players.length === 0) {
      setSaveMatchError('目前沒有可保存的完整對局資料');
      return;
    }

    setSaveMatchLoading(true);
    setSaveMatchError('');
    setSaveMatchMessage('');
    setUndoError('');
    setUndoMessage('');
    setFinishError('');
    setFinishMessage('');

    try {
      const scoreMap = new Map<number, number>();
      scoreChanges.forEach((change) => {
        scoreMap.set(
          change.seat_index,
          (scoreMap.get(change.seat_index) ?? 0) + change.delta_score
        );
      });

      const finalPlayers = [...players]
        .sort((a, b) => a.seat_index - b.seat_index)
        .map((player) => ({
          ...player,
          final_score: scoreMap.get(player.seat_index) ?? 0,
        }));

      const rankedPlayers = [...finalPlayers]
        .sort((a, b) => {
          if (b.final_score !== a.final_score) return b.final_score - a.final_score;
          return a.seat_index - b.seat_index;
        })
        .map((player, index) => ({
          ...player,
          final_rank: index + 1,
        }));

      const rankBySeat = new Map<number, number>();
      rankedPlayers.forEach((player) => {
        rankBySeat.set(player.seat_index, player.final_rank);
      });

      const matchTitle = `${new Date().toLocaleDateString('zh-TW')} 對局紀錄`;

      const { data: insertedMatch, error: matchError } = await supabase
        .from('matches')
        .insert({
          owner_user_id: null,
          source_room_id: room.id,
          title: matchTitle,
          status: 'finished',
          is_public: false,
          base_score: room.base_score,
          tai_unit_amount: room.tai_unit_amount,
          started_at: room.created_at,
          finished_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (matchError || !insertedMatch) {
        throw matchError ?? new Error('建立 match 失敗');
      }

      const matchId = insertedMatch.id;

      const { error: matchPlayersError } = await supabase
        .from('match_players')
        .insert(
          finalPlayers.map((player) => ({
            match_id: matchId,
            user_id: null,
            player_name: player.player_name,
            seat_index: player.seat_index,
            final_score: player.final_score,
            final_rank: rankBySeat.get(player.seat_index) ?? null,
            is_owner: player.is_owner,
          }))
        );

      if (matchPlayersError) {
        throw matchPlayersError;
      }

      const sortedRecords = [...records].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // 改成 hand_id 為核心做 mapping，避免 record.id / hand_id 來回找造成錯配
      const handIdToSavedMatchRecordId = new Map<string, string>();
      const handIdToHandNo = new Map<string, number>();

      for (let index = 0; index < sortedRecords.length; index += 1) {
        const record = sortedRecords[index];
        const handNo = index + 1;

        const { data: insertedRecord, error: matchRecordError } = await supabase
          .from('match_records')
          .insert({
            match_id: matchId,
            hand_no: handNo,
            result_type: record.result_type,
            winner_seat: record.winner_seat,
            loser_seat: record.loser_seat,
            tai_count: record.tai_count,
            wait_type: record.wait_type,
            winning_tile: record.winning_tile,
            note: record.note,
            misdeal_seat: record.misdeal_seat,
            misdeal_note: record.misdeal_note,
            created_by_name: record.created_by_name,
            round_wind_before: record.round_wind_before,
            dealer_seat_index_before: record.dealer_seat_index_before,
            dealer_streak_before: record.dealer_streak_before,
            round_wind_after: record.round_wind_after,
            dealer_seat_index_after: record.dealer_seat_index_after,
            dealer_streak_after: record.dealer_streak_after,
            created_at: record.created_at,
          })
          .select()
          .single();

        if (matchRecordError || !insertedRecord) {
          throw matchRecordError ?? new Error('建立 match_record 失敗');
        }

        handIdToSavedMatchRecordId.set(record.hand_id, insertedRecord.id);
        handIdToHandNo.set(record.hand_id, handNo);
      }

      const scoreChangeRows = scoreChanges
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((change) => {
          const savedMatchRecordId = handIdToSavedMatchRecordId.get(change.hand_id);
          const handNo = handIdToHandNo.get(change.hand_id);

          if (!savedMatchRecordId || !handNo) {
            throw new Error(`找不到 hand_id=${change.hand_id} 對應的 saved match_record`);
          }

          return {
            match_id: matchId,
            match_record_id: savedMatchRecordId,
            hand_no: handNo,
            seat_index: change.seat_index,
            delta_score: change.delta_score,
            created_at: change.created_at,
          };
        });

      if (scoreChangeRows.length > 0) {
        const { error: matchScoreChangesError } = await supabase
          .from('match_score_changes')
          .insert(scoreChangeRows);

        if (matchScoreChangesError) {
          throw matchScoreChangesError;
        }
      }

      setSaveMatchMessage('本場對局已成功保存');
    } catch (error) {
      console.error('Save match failed:', error);
      setSaveMatchError(getErrorMessage(error, '保存本場對局失敗，請稍後再試'));
    } finally {
      setSaveMatchLoading(false);
    }
  }, [room, isOwner, records, players, scoreChanges, saveMatchLoading]);

  if (loading || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] font-mono text-xs tracking-widest text-neutral-500">
        載入對局中...
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0A0A0A] text-white selection:bg-[#B6FF00] selection:text-black">
      <nav className="sticky top-0 z-30 border-b border-white/5 bg-[#0A0A0A]/80 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black italic tracking-tight text-[#B6FF00]">
                房號 {room.room_code}
              </span>
              <div className="h-1 w-1 rounded-full bg-white/20" />
              <span className="text-xs font-medium text-neutral-400">
                第 {room.current_hand_no} 手
              </span>
              {room.status === 'finished' ? (
                <>
                  <div className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                    已結束
                  </span>
                </>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#B6FF00]/20 bg-[#B6FF00]/10 px-3 py-1 text-xs font-black text-[#B6FF00]">
                {roundLabel}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white">
                莊家：{dealerPlayer?.player_name ?? getSeatWind(currentDealerSeatIndex)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-neutral-300">
                {currentDealerStreak > 0 ? `莊家連 ${currentDealerStreak}` : '目前無連莊'}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
              <span className="opacity-30">1 底</span>
              <span className="text-neutral-300">{room.base_score ?? 0}</span>
              <span className="mx-0.5 opacity-10">/</span>
              <span className="opacity-30">1 台</span>
              <span className="text-neutral-300">{room.tai_unit_amount ?? 0}</span>
            </div>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-inner">
            <span className="text-xs font-black text-[#B6FF00]">
              {currentUserName.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        </div>
      </nav>

      <section className="relative flex h-[62vh] min-h-[520px] flex-col items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center opacity-[0.02]">
          <h1 className="text-[120px] font-black italic tracking-tighter text-white">ARENA</h1>
        </div>

        <div className="relative z-10 mx-auto h-full w-full max-w-sm">
          {playersWithScores.map((p, i) => {
            const positions = [
              'bottom-8 left-1/2 -translate-x-1/2',
              'right-6 top-1/2 -translate-y-1/2',
              'top-8 left-1/2 -translate-x-1/2',
              'left-6 top-1/2 -translate-y-1/2',
            ];

            const isDealer = p.seat_index === currentDealerSeatIndex;

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`absolute flex flex-col items-center gap-2 ${positions[i]}`}
              >
                <div className="relative group">
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-full border-[3px] shadow-2xl transition-transform active:scale-90 ${
                      isDealer
                        ? 'border-[#B6FF00] ring-4 ring-[#B6FF00]/20'
                        : 'border-[#0A0A0A]'
                    } ${AVATAR_BG_CLASSES[p.seat_index % 4]}`}
                  >
                    <span className="text-2xl font-black">{p.player_name.charAt(0)}</span>
                  </div>

                  <div className="absolute -left-1 -top-1 rounded-full border border-white/10 bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-white">
                    {p.seatWind}
                  </div>

                  {room.owner_name === p.player_name && (
                    <div className="absolute -right-1 -top-1 rounded border border-black bg-white px-1.5 py-0.5 text-[9px] font-black text-black shadow-sm">
                      房主
                    </div>
                  )}

                  {isDealer && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#B6FF00] px-2 py-0.5 text-[9px] font-black text-black shadow-md">
                      莊
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {p.player_name}
                  </p>
                  <p
                    className={`font-mono text-2xl font-black tracking-tighter ${
                      p.totalScore >= 0 ? 'text-[#B6FF00]' : 'text-[#FF5F5F]'
                    }`}
                  >
                    {p.totalScore > 0 ? `+${p.totalScore}` : p.totalScore}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="absolute bottom-6 flex flex-col items-center gap-1 opacity-20">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-500">
            往下滑動查看戰報
          </span>
          <div className="h-6 w-px bg-gradient-to-b from-neutral-500 to-transparent" />
        </div>
      </section>

      {isOwner ? (
        <div className="fixed bottom-10 left-0 right-0 z-40 flex justify-center px-6 sm:px-8">
          <div className="flex w-full max-w-md flex-col gap-3">
            {undoMessage ? (
              <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm font-medium text-lime-300">
                {undoMessage}
              </div>
            ) : null}

            {undoError ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-300">
                {undoError}
              </div>
            ) : null}

            {finishMessage ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200">
                {finishMessage}
              </div>
            ) : null}

            {finishError ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-300">
                {finishError}
              </div>
            ) : null}

            {saveMatchMessage ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-300">
                {saveMatchMessage}
              </div>
            ) : null}

            {saveMatchError ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-300">
                {saveMatchError}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSaveMatch}
              disabled={room.status !== 'finished' || saveMatchLoading}
              className="w-full rounded-full border border-cyan-400/20 bg-cyan-400/10 py-4 text-sm font-black tracking-[0.15em] text-cyan-200 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveMatchLoading
                ? '保存中...'
                : room.status === 'finished'
                  ? '保存本場對局'
                  : '結束後可保存'}
            </button>

            <div className="grid grid-cols-4 gap-3">
              <button
                type="button"
                onClick={handleUndoLastHand}
                disabled={!lastRecord || undoLoading}
                className="rounded-full border border-white/10 bg-white/5 py-4 text-sm font-black tracking-[0.12em] text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {undoLoading ? '撤銷中...' : '↶ 撤銷'}
              </button>

              <button
                type="button"
                onClick={handleFinishRoom}
                disabled={room.status === 'finished' || finishLoading}
                className="rounded-full border border-amber-400/20 bg-amber-400/10 py-4 text-sm font-black tracking-[0.12em] text-amber-200 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {finishLoading ? '結束中...' : room.status === 'finished' ? '已結束' : '結束對局'}
              </button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsRecordModalOpen(true)}
                disabled={room.status === 'finished'}
                className="col-span-2 rounded-full bg-[#B6FF00] py-5 text-base font-black tracking-[0.2em] text-black shadow-[0_15px_40px_rgba(182,255,0,0.3)] transition-all active:bg-[#D9FF7A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ＋ 紀錄此手結果
              </motion.button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="mx-auto max-w-4xl space-y-12 px-4 pb-52 pt-10 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-600">
            戰況分析
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
        </div>

        <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-2 shadow-2xl backdrop-blur-md transition-all hover:bg-white/[0.04]">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h3 className="text-xs font-bold tracking-wider text-neutral-400">分數走勢</h3>
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#B6FF00]" />
          </div>
          <ScoreTrendChart records={records} scoreChanges={scoreChanges} players={players} />
        </div>

        <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-4 shadow-2xl backdrop-blur-md transition-all hover:bg-white/[0.04]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wider text-neutral-400">對局指標 (KPI)</h3>
          </div>
          <KPIBoard records={records} players={players} />
        </div>

        <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-4 shadow-2xl backdrop-blur-md transition-all hover:bg-white/[0.04]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wider text-neutral-400">歷史對局紀錄</h3>
          </div>
          <HandHistory records={records} players={players} />
        </div>
      </section>

      <AnimatePresence>
        {isRecordModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0A]/95 backdrop-blur-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex flex-col">
                <h2 className="text-3xl font-black italic tracking-tighter text-[#B6FF00]">
                  紀錄此手.
                </h2>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                  選結果與必要資訊即可快速送出
                </span>
              </div>

              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-lg transition-colors hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
              <div className="mx-auto max-w-md">
                <ActionPanel
                  room={room}
                  players={players}
                  onRecorded={() => {
                    fetchRoomData();
                    setIsRecordModalOpen(false);
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}