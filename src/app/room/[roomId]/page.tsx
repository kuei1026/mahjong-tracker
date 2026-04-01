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
        supabase.from('room_players').select('*').eq('room_id', roomId).order('seat_index', { ascending: true }),
        supabase.from('records').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
        supabase.from('score_changes').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
      ]);
      if (roomRes.data) setRoom(roomRes.data);
      if (playersRes.data) setPlayers(playersRes.data);
      if (recordsRes.data) setRecords(recordsRes.data);
      if (scoreChangesRes.data) setScoreChanges(scoreChangesRes.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => {
    setCurrentUserName(localStorage.getItem(LOCAL_STORAGE_USER_NAME_KEY) ?? '');
    fetchRoomData();
  }, [fetchRoomData]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`room-${roomId}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `room_id=eq.${roomId}` }, fetchRoomData)
           .on('postgres_changes', { event: '*', schema: 'public', table: 'score_changes', filter: `room_id=eq.${roomId}` }, fetchRoomData)
           .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, fetchRoomData)
           .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchRoomData]);

  const playersWithScores = useMemo(() => {
    const scoreMap = new Map<number, number>();
    scoreChanges.forEach(c => scoreMap.set(c.seat_index, (scoreMap.get(c.seat_index) ?? 0) + c.delta_score));
    return players.map(p => ({ ...p, totalScore: scoreMap.get(p.seat_index) ?? 0 }));
  }, [players, scoreChanges]);

  // 判斷當前使用者是否為房主
  const isOwner = useMemo(() => room?.owner_name === currentUserName, [room, currentUserName]);

  if (loading || !room) return <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-neutral-500 font-mono tracking-widest text-xs">載入對局中...</div>;

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden selection:bg-[#B6FF00] selection:text-black">
      {/* 1. 頂部導覽：資訊補全與中文在地化 */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#0A0A0A]/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[#B6FF00] font-black text-sm tracking-tight italic">房號 {room.room_code}</span>
            <div className="h-1 w-1 rounded-full bg-white/20" />
            <span className="text-xs text-neutral-400 font-medium">第 {room.current_hand_no} 手</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
            <span className="text-neutral-300">{room.base_score ?? 0}</span>
            <span className="opacity-30">底</span>
            <span className="mx-0.5 opacity-10">/</span>
            <span className="text-neutral-300">{room.tai_unit_amount ?? 0}</span>
            <span className="opacity-30">台</span>
          </div>
        </div>
        <div className="h-9 w-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center shadow-inner">
          <span className="text-xs font-black text-[#B6FF00]">{currentUserName.charAt(0).toUpperCase()}</span>
        </div>
      </nav>

      {/* 2. 牌桌區域 */}
      <section className="relative flex h-[60vh] flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
          <h1 className="text-[120px] font-black italic tracking-tighter text-white">ARENA</h1>
        </div>

        <div className="relative z-10 w-full h-full max-w-sm mx-auto">
          {playersWithScores.map((p, i) => {
            const positions = [
              "bottom-8 left-1/2 -translate-x-1/2", 
              "right-6 top-1/2 -translate-y-1/2",   
              "top-8 left-1/2 -translate-x-1/2",    
              "left-6 top-1/2 -translate-y-1/2"     
            ];
            
            return (
              <motion.div 
                key={p.id} 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`absolute flex flex-col items-center gap-2 ${positions[i]}`}
              >
                <div className="relative group">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-[#0A0A0A] shadow-2xl transition-transform active:scale-90 ${AVATAR_BG_CLASSES[p.seat_index % 4]}`}>
                    <span className="text-2xl font-black">{p.player_name.charAt(0)}</span>
                  </div>
                  {/* 修正錯誤：使用 room.owner_name 來判斷 */}
                  {room.owner_name === p.player_name && (
                    <div className="absolute -right-1 -top-1 bg-white text-[9px] px-1.5 py-0.5 rounded shadow-sm border border-black text-black font-black">
                      房主
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{p.player_name}</p>
                  <p className={`text-2xl font-mono font-black tracking-tighter ${p.totalScore >= 0 ? 'text-[#B6FF00]' : 'text-[#FF5F5F]'}`}>
                    {p.totalScore > 0 ? `+${p.totalScore}` : p.totalScore}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
        
        <div className="absolute bottom-6 flex flex-col items-center gap-1 opacity-20">
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-neutral-500">往下滑動查看戰報</span>
          <div className="w-px h-6 bg-gradient-to-b from-neutral-500 to-transparent" />
        </div>
      </section>

      {/* 3. 底部動作：中文在地化 */}
      {isOwner && (
        <div className="fixed bottom-10 left-0 right-0 z-40 flex justify-center px-8">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsRecordModalOpen(true)}
            className="w-full max-w-md rounded-full bg-[#B6FF00] py-5 text-base font-black tracking-[0.2em] text-black shadow-[0_15px_40px_rgba(182,255,0,0.3)] active:bg-[#D9FF7A] transition-all"
          >
            ＋ 紀錄此手結果
          </motion.button>
        </div>
      )}

      {/* 4. 數據報表區域：優化質感與卡片間距 */}
      <section className="mx-auto max-w-4xl space-y-12 px-6 pb-40 pt-10">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
          <span className="text-[10px] font-bold tracking-[0.5em] uppercase text-neutral-600">戰況分析</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
        </div>
        
        {/* 趨勢圖卡片 */}
        <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-2 shadow-2xl backdrop-blur-md transition-all hover:bg-white/[0.04]">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-400 tracking-wider">分數走勢</h3>
            <div className="h-1.5 w-1.5 rounded-full bg-[#B6FF00] animate-pulse" />
          </div>
          <ScoreTrendChart records={records} scoreChanges={scoreChanges} players={players} />
        </div>

        {/* 數據看板卡片 */}
        <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-4 shadow-2xl backdrop-blur-md transition-all hover:bg-white/[0.04]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-400 tracking-wider">對局指標 (KPI)</h3>
          </div>
          <KPIBoard records={records} players={players} />
        </div>

        {/* 歷史紀錄卡片 */}
        <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-4 shadow-2xl backdrop-blur-md transition-all hover:bg-white/[0.04]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-400 tracking-wider">歷史對局紀錄</h3>
          </div>
          <HandHistory records={records} players={players} />
        </div>
      </section>

      {/* 5. 紀錄彈窗：沉浸式設計 */}
      <AnimatePresence>
        {isRecordModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0A]/95 backdrop-blur-3xl"
          >
            <div className="flex items-center justify-between p-8 border-b border-white/5">
              <div className="flex flex-col">
                <h2 className="text-4xl font-black italic tracking-tighter text-[#B6FF00]">紀錄此手.</h2>
                <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold mt-1">請選擇該局結果與台數</span>
              </div>
              <button 
                onClick={() => setIsRecordModalOpen(false)} 
                className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center text-xl hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            </div>
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