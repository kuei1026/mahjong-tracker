'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Room } from '@/types/game';

interface UndoLastRecordButtonProps {
  room: Room;
  onUndone: () => Promise<void> | void;
}

export default function UndoLastRecordButton({
  room,
  onUndone,
}: UndoLastRecordButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUndo = async () => {
    setMessage('');

    if (room.current_hand_no <= 0) {
      setMessage('目前沒有可以撤銷的紀錄。');
      return;
    }

    const confirmed = window.confirm('確定要撤銷最後一手紀錄嗎？');
    if (!confirmed) return;

    setLoading(true);

    try {
      const { data: lastHand, error: lastHandError } = await supabase
        .from('hands')
        .select('id, hand_no')
        .eq('room_id', room.id)
        .order('hand_no', { ascending: false })
        .limit(1)
        .single();

      if (lastHandError || !lastHand) {
        throw lastHandError ?? new Error('找不到最後一手。');
      }

      const { error: deleteHandError } = await supabase
        .from('hands')
        .delete()
        .eq('id', lastHand.id);

      if (deleteHandError) {
        throw deleteHandError;
      }

      const { data: remainingHands, error: remainingHandsError } = await supabase
        .from('hands')
        .select('hand_no')
        .eq('room_id', room.id)
        .order('hand_no', { ascending: false })
        .limit(1);

      if (remainingHandsError) {
        throw remainingHandsError;
      }

      const nextCurrentHandNo =
        remainingHands && remainingHands.length > 0
          ? remainingHands[0].hand_no
          : 0;

      const { error: updateRoomError } = await supabase
        .from('rooms')
        .update({
          current_hand_no: nextCurrentHandNo,
        })
        .eq('id', room.id);

      if (updateRoomError) {
        throw updateRoomError;
      }

      setMessage(`已撤銷第 ${lastHand.hand_no} 手。`);
      await onUndone();
    } catch (error) {
      console.error('Undo last hand failed:', error);
      setMessage('撤銷失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">撤銷最後一手</h3>
          <p className="mt-1 text-sm text-neutral-400">
            修正誤記時可快速回退上一手。
          </p>
        </div>

        <button
          type="button"
          onClick={handleUndo}
          disabled={loading}
          className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '撤銷中...' : '撤銷最後一手'}
        </button>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-neutral-200">
          {message}
        </div>
      ) : null}
    </section>
  );
}