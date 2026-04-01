'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
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
    } catch (error) {
      console.error('[fetchRoomData] failed:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    const savedUserName = localStorage.getItem(LOCAL_STORAGE_USER_NAME_KEY) ?? '';
    setCurrentUserName(savedUserName);
    fetchRoomData();
  }, [fetchRoomData]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room-${roomId}-realtime`);
    const sync = () => fetchRoomData();

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_changes', filter: `room_id=eq.${roomId}` }, sync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `room_id=eq.${roomId}` }, sync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, sync)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchRoomData]);

  const playersWithScores = useMemo(() => {
    const scoreMap = new Map<number, number>();
    for (const change of scoreChanges) {
      const currentScore = scoreMap.get(change.seat_index) ?? 0;
      scoreMap.set(change.seat_index, currentScore + change.delta_score);
    }
    return [...players].map((player) => ({
      ...player,
      totalScore: scoreMap.get(player.seat_index) ?? 0,
    }));
  }, [players, scoreChanges]);

  const isOwner = useMemo(() => {
    if (!room || !currentUserName) return false;
    return room.owner_name.trim().toLowerCase() === currentUserName.trim().toLowerCase();
  }, [room, currentUserName]);

  if (loading || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-white font-mono">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          LOADING ARENA...
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden selection:bg-[#B6FF00] selection:text-black">
      {/* 1. Sticky Header: 整合房號、局數與底台資訊 */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#0A0A0A]/70 px-6 py-5 backdrop-blur-xl">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[#B6FF00] font-black text-sm tracking-tighter italic">ROOM {room.room_code}</span>
            <div className="h-1 w-1 rounded-full bg-white/20" />
            <span className="text-xs text-neutral-400 font-medium">第 {room.current_hand_no} 手</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-neutral-500">
            <span className="text-neutral-300">{room.base_score ?? 0}</span>
            <span className="opacity-40">/</span>
            <span className="text-neutral-300">{room.tai_unit_amount ?? 0}</span>
            <span className="ml-0.5 opacity-60 text-[9px]">TAI</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center shadow-inner">
            <span className="text-xs font-black text-[#B6FF00]">{currentUserName.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      </nav>

      {/* 2. Virtual Table Arena: 座標化排版 (東南西北方位) */}
      <section className="relative h-[65vh] flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
          <h1 className="text-[150px] font-black italic tracking-tighter">ARENA</h1>
        </div>

        <div className="relative w-full h-full max-w-sm mx-auto">
          {playersWithScores.map((p, i) => {
            // 定義桌位：0-南(下), 1-東(右), 2-北(上), 3-西(左)
            const positions = [
              "bottom-10 left-1/2 -translate-x-1/2", 
              "right-6 top-1/2 -translate-y-1/2",   
              "top-10 left-1/2 -translate-x-1/2",    
              "left-6 top-1/2 -translate-y-1/2"     
            ];
            
            return (
              <motion.div 
                key={p.id} 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`absolute flex flex-col items-center gap-3 ${positions[i]}`}
              >
                <div className="relative group">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-full border-[4px] border-[#0A0A0A] shadow-[0_0_40px_rgba(0,0,0,0.6)] transition-transform group-active:scale-95 ${AVATAR_BG_CLASSES[p.seat_index % 4]}`}>
                    <span className="text-2xl font-black">{p.player_name.charAt(0).toUpperCase()}</span>
                  </div>
                  {p.is_owner && (
                    <div className="absolute -right-1 -top-1 bg-white text-[9px] px-1.5 py-0.5 rounded shadow-sm border border-black text-black font-black">
                      OWNER
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">{p.player_name}</p>
                  <p className={`text-2xl font-mono font-black tracking-tighter ${p.totalScore >= 0 ? 'text-[#B6FF00]' : 'text-[#FF5F5F]'}`}>
                    {p.totalScore > 0 ? `+${p.totalScore}` : p.totalScore}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
        
        {/* 滾動提示 */}
        <div className="absolute bottom-6 flex flex-col items-center gap-1 opacity-20">
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white to-transparent" />
        </div>
      </section>

      {/* 3. 浮動紀錄按鈕: 質感 Glow 效果 */}
      {isOwner && (
        <div className="fixed bottom-12 left-0 right-0 z-40 flex justify-center px-10">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsRecordModalOpen(true)}
            className="w-full max-w-xs bg-[#B6FF00] text-black py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(182,255,0,0.25)]"
          >
            + Record Hand
          </motion.button>
        </div>
      )}

      {/* 4. 戰報與分析區: 下滑顯示 */}
      <section className="px-6 space-y-20 pb-40">
        <div className="flex items-center gap-4 opacity-10">
          <div className="h-px flex-1 bg-white" />
          <span className="text-[10px] font-bold tracking-[0.5em] uppercase">Analytics</span>
          <div className="h-px flex-1 bg-white" />
        </div>
        
        <div className="rounded-[32px] border border-white/5 bg-white/[0.02] p-4 sm:p-6 shadow-xl backdrop-blur-sm">
          <ScoreTrendChart records={records} scoreChanges={scoreChanges} players={players} />
        </div>

        <div className="rounded-[32px] border border-white/5 bg-white/[0.02] p-4 sm:p-6 shadow-xl backdrop-blur-sm">
          <KPIBoard records={records} players={players} />
        </div>

        <div className="rounded-[32px] border border-white/5 bg-white/[0.02] p-4 sm:p-6 shadow-xl backdrop-blur-sm">
          <HandHistory records={records} players={players} />
        </div>
      </section>

      {/* 5. 全螢幕沉浸式紀錄 Modal (Framer Motion) */}
      <AnimatePresence>
        {isRecordModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed inset-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-3xl flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-8 border-b border-white/5">
              <div className="flex flex-col">
                <h2 className="text-4xl font-black italic tracking-tighter text-[#B6FF00]">LOG.</h2>
                <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold mt-1">Add new game record</span>
              </div>
              <button 
                onClick={() => setIsRecordModalOpen(false)}
                className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center text-xl hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8 pb-32">
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