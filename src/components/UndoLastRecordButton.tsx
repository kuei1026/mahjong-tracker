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
      setMessage('There is no hand to undo.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to undo the last recorded hand?'
    );

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
        throw lastHandError ?? new Error('Last hand not found.');
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

      setMessage(`Hand #${lastHand.hand_no} was undone successfully.`);
      await onUndone();
    } catch (error) {
      console.error('Undo last hand failed:', error);
      setMessage('Failed to undo the last hand.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">Undo Last Record</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Remove the most recent hand and recalculate the room state.
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-200">
          {message}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleUndo}
        disabled={loading}
        className="w-full rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 font-semibold text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Undoing Last Record...' : 'Undo Last Record'}
      </button>
    </section>
  );
}