'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateScoreChanges, type RecordType } from '@/lib/gameLogic';
import type { Room, RoomPlayer } from '@/types/game';
import TilePicker from '@/components/TilePicker';

interface ActionPanelProps {
  room: Room;
  players: RoomPlayer[];
  onRecorded: () => Promise<void> | void;
}

const RESULT_OPTIONS: { label: string; value: RecordType }[] = [
  { label: '自摸', value: 'tsumo' },
  { label: '胡牌', value: 'ron' },
  { label: '流局', value: 'draw' },
  { label: '相公', value: 'misdeal' },
];

const QUICK_TAI_OPTIONS = [1, 2, 3, 4, 5];

export default function ActionPanel({ room, players, onRecorded }: ActionPanelProps) {
  // 分段步驟狀態：1: 結果類型, 2: 選擇玩家, 3: 台數與牌型
  const [step, setStep] = useState(1);
  const [resultType, setResultType] = useState<RecordType>('tsumo');
  const [winnerSeat, setWinnerSeat] = useState<number | null>(null);
  const [loserSeat, setLoserSeat] = useState<number | null>(null);
  const [taiCount, setTaiCount] = useState(1);
  const [winningTile, setWinningTile] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [recentlySaved, setRecentlySaved] = useState(false);

  const panelRef = useRef<HTMLElement | null>(null);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.seat_index - b.seat_index),
    [players]
  );

  const requiresWinner = resultType === 'tsumo' || resultType === 'ron';
  const requiresLoser = resultType === 'ron' || resultType === 'misdeal';
  const requiresTaiCount = resultType === 'tsumo' || resultType === 'ron';
  const supportsWinningTile = resultType === 'tsumo' || resultType === 'ron';

  // 自動震動回饋
  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (resultType === 'draw') {
        setStep(3); // 流局直接跳最後一步
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      if (requiresWinner && winnerSeat === null) return;
      if (requiresLoser && loserSeat === null) return;
      setStep(3);
    }
    triggerHaptic(10);
  };

  const resetForm = () => {
    setStep(1);
    setResultType('tsumo');
    setWinnerSeat(null);
    setLoserSeat(null);
    setTaiCount(1);
    setWinningTile(null);
    setNote('');
  };

  const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setFeedbackMessage('');
  setFeedbackType('');

  try {
    const nextHandNo = room.current_hand_no + 1;

    const { data: handData, error: handError } = await supabase
      .from('hands')
      .insert({
        room_id: room.id,
        hand_no: nextHandNo,
        status: 'locked',
      })
      .select()
      .single();

    if (handError || !handData) {
      throw handError ?? new Error('建立 hand 失敗');
    }

    const calculatedChanges = calculateScoreChanges({
      resultType,
      winnerSeat,
      loserSeat,
      taiCount: requiresTaiCount ? taiCount : 0,
      baseScore: room.base_score ?? 0, // 新增
      taiUnitAmount: room.tai_unit_amount,
      misdealPenalty: room.misdeal_penalty,
    });

    const { error: recordError } = await supabase
      .from('records')
      .insert({
        hand_id: handData.id,
        room_id: room.id,
        result_type: resultType,
        winner_seat: winnerSeat,
        loser_seat: loserSeat,
        tai_count: requiresTaiCount ? taiCount : 0,
        note: note.trim() || null,
        winning_tile: supportsWinningTile ? winningTile : null,
        created_by_name: room.owner_name, // 很重要
      });

    if (recordError) {
      throw recordError;
    }

    const { error: scoreChangeError } = await supabase
      .from('score_changes')
      .insert(
        calculatedChanges.map((item) => ({
          hand_id: handData.id,
          room_id: room.id,
          seat_index: item.seat_index,
          delta_score: item.delta_score,
        }))
      );

    if (scoreChangeError) {
      throw scoreChangeError;
    }

    const { error: roomUpdateError } = await supabase
      .from('rooms')
      .update({ current_hand_no: nextHandNo })
      .eq('id', room.id);

    if (roomUpdateError) {
      throw roomUpdateError;
    }

    resetForm();
    setRecentlySaved(true);
    setFeedbackType('success');
    setFeedbackMessage('紀錄成功');
    triggerHaptic(60);
    await onRecorded();
  } catch (err) {
    console.error('Record submit failed:', err);
    setFeedbackType('error');
    setFeedbackMessage('紀錄失敗');
    triggerHaptic([50, 50]);
  } finally {
    setLoading(false);
  }
  };

  return (
    <section ref={panelRef} className={`rounded-[32px] border p-6 transition-all duration-500 ${recentlySaved ? 'border-[#B6FF00] bg-[#B6FF00]/10' : 'border-white/10 bg-white/5 shadow-2xl'}`}>
      
      {/* 步驟指示器 */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${step >= s ? 'bg-[#B6FF00]' : 'bg-white/10'}`} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: 結果類型 */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-bold text-white">這把結果是？</h3>
            <div className="grid grid-cols-2 gap-3">
              {RESULT_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => { setResultType(opt.value); handleNextStep(); }}
                  className={`h-20 rounded-2xl border text-lg font-bold transition active:scale-95 ${resultType === opt.value ? 'border-transparent bg-[#B6FF00] text-black' : 'border-white/10 bg-black/40 text-white'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: 選擇對象 */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            {requiresWinner && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-400">是誰胡了？</p>
                <div className="grid grid-cols-2 gap-3">
                  {sortedPlayers.map((p) => (
                    <button key={p.id} type="button" onClick={() => setWinnerSeat(p.seat_index)}
                      className={`h-16 rounded-xl border font-bold transition ${winnerSeat === p.seat_index ? 'bg-[#B6FF00] text-black border-transparent' : 'bg-white/5 border-white/10'}`}>
                      {p.player_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {requiresLoser && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-400">{resultType === 'misdeal' ? '誰相公了？' : '誰放槍？'}</p>
                <div className="grid grid-cols-2 gap-3">
                  {sortedPlayers.map((p) => (
                    <button key={p.id} type="button" onClick={() => setLoserSeat(p.seat_index)} disabled={winnerSeat === p.seat_index}
                      className={`h-16 rounded-xl border font-bold transition ${loserSeat === p.seat_index ? 'bg-[#FF5F5F] text-white border-transparent' : 'bg-white/5 border-white/10 opacity-50'}`}>
                      {p.player_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={handleNextStep} disabled={requiresWinner && winnerSeat === null}
              className="w-full py-4 bg-white/10 rounded-2xl font-bold hover:bg-white/20 transition disabled:opacity-30">下一步</button>
          </div>
        )}

        {/* Step 3: 台數與牌型 */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            {requiresTaiCount && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-400">幾台？</p>
                <div className="flex gap-2">
                  {QUICK_TAI_OPTIONS.map(v => (
                    <button key={v} type="button" onClick={() => setTaiCount(v)} 
                      className={`flex-1 h-12 rounded-lg font-bold ${taiCount === v ? 'bg-[#B6FF00] text-black' : 'bg-white/5'}`}>{v}</button>
                  ))}
                </div>
                <div className="flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/5">
                  <button type="button" onClick={() => setTaiCount(Math.max(1, taiCount-1))} className="w-12 h-12 text-2xl">-</button>
                  <span className="flex-1 text-center text-2xl font-mono font-bold text-[#B6FF00]">{taiCount} 台</span>
                  <button type="button" onClick={() => setTaiCount(taiCount+1)} className="w-12 h-12 text-2xl">+</button>
                </div>
              </div>
            )}

            {supportsWinningTile && <TilePicker value={winningTile} onChange={setWinningTile} />}

            <div className="pt-4 flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 bg-white/5 rounded-2xl font-bold">重選</button>
              <button type="submit" disabled={loading} className="flex-[2] py-4 bg-[#B6FF00] text-black rounded-2xl font-bold shadow-xl shadow-[#B6FF00]/20">
                {loading ? '紀錄中...' : '確認送出'}
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}