'use client';

import { FormEvent, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateScoreChanges, type RecordType } from '@/lib/gameLogic';
import type { Room, RoomPlayer } from '@/types/game';

interface ActionPanelProps {
  room: Room;
  players: RoomPlayer[];
  onRecorded: () => Promise<void> | void;
}

export default function ActionPanel({
  room,
  players,
  onRecorded,
}: ActionPanelProps) {
  const [resultType, setResultType] = useState<RecordType>('tsumo');
  const [winnerSeat, setWinnerSeat] = useState<number | ''>('');
  const [loserSeat, setLoserSeat] = useState<number | ''>('');
  const [taiCount, setTaiCount] = useState(1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.seat_index - b.seat_index),
    [players]
  );

  const requiresWinner = resultType === 'tsumo' || resultType === 'ron';
  const requiresLoser = resultType === 'ron' || resultType === 'misdeal';
  const requiresTaiCount = resultType === 'tsumo' || resultType === 'ron';

  const resetForm = () => {
    setResultType('tsumo');
    setWinnerSeat('');
    setLoserSeat('');
    setTaiCount(1);
    setNote('');
  };

  const validateForm = () => {
    if (requiresWinner && winnerSeat === '') {
      return 'Please select a winner.';
    }

    if (requiresLoser && loserSeat === '') {
      return resultType === 'misdeal'
        ? 'Please select the misdeal player.'
        : 'Please select a loser.';
    }

    if (resultType === 'ron' && winnerSeat === loserSeat) {
      return 'Winner and loser cannot be the same player.';
    }

    if (requiresTaiCount && taiCount <= 0) {
      return 'Tai count must be greater than 0.';
    }

    return '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    const validationMessage = validateForm();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setLoading(true);

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
        throw handError ?? new Error('Failed to create hand.');
      }

      const calculatedScoreChanges = calculateScoreChanges({
        resultType,
        winnerSeat: winnerSeat === '' ? null : winnerSeat,
        loserSeat: loserSeat === '' ? null : loserSeat,
        taiCount: requiresTaiCount ? taiCount : 0,
        taiUnitAmount: room.tai_unit_amount,
        misdealPenalty: room.misdeal_penalty,
      });

      const { error: recordError } = await supabase.from('records').insert({
        hand_id: handData.id,
        room_id: room.id,
        result_type: resultType,
        winner_seat: winnerSeat === '' ? null : winnerSeat,
        loser_seat: loserSeat === '' ? null : loserSeat,
        tai_count: requiresTaiCount ? taiCount : 0,
        note: note.trim() || null,
        created_by_name: room.owner_name,
      });

      if (recordError) {
        throw recordError;
      }

      const { error: scoreChangesError } = await supabase
        .from('score_changes')
        .insert(
          calculatedScoreChanges.map((item) => ({
            hand_id: handData.id,
            room_id: room.id,
            seat_index: item.seat_index,
            delta_score: item.delta_score,
          }))
        );

      if (scoreChangesError) {
        throw scoreChangesError;
      }

      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({
          current_hand_no: nextHandNo,
        })
        .eq('id', room.id);

      if (roomUpdateError) {
        throw roomUpdateError;
      }

      resetForm();
      setMessage('Record saved successfully.');
      await onRecorded();
    } catch (error) {
      console.error('Record hand failed:', error);
      setMessage('Failed to save record. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Owner Action Panel</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Record one hand result and automatically update room scores.
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-200">
          {message}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm text-neutral-300">Result Type</label>
          <select
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
            value={resultType}
            onChange={(e) => {
              const value = e.target.value as RecordType;
              setResultType(value);
              setMessage('');
            }}
          >
            <option value="tsumo">Tsumo</option>
            <option value="ron">Ron</option>
            <option value="draw">Draw</option>
            <option value="misdeal">Misdeal</option>
          </select>
        </div>

        {requiresWinner ? (
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Winner</label>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
              value={winnerSeat}
              onChange={(e) =>
                setWinnerSeat(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
            >
              <option value="">Select winner</option>
              {sortedPlayers.map((player) => (
                <option key={player.id} value={player.seat_index}>
                  Seat {player.seat_index + 1} - {player.player_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {requiresLoser ? (
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">
              {resultType === 'misdeal' ? 'Misdeal Player' : 'Loser'}
            </label>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
              value={loserSeat}
              onChange={(e) =>
                setLoserSeat(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
            >
              <option value="">
                {resultType === 'misdeal'
                  ? 'Select misdeal player'
                  : 'Select loser'}
              </option>
              {sortedPlayers.map((player) => (
                <option key={player.id} value={player.seat_index}>
                  Seat {player.seat_index + 1} - {player.player_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {requiresTaiCount ? (
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Tai Count</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
              value={taiCount}
              onChange={(e) => setTaiCount(Number(e.target.value))}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm text-neutral-300">Note (Optional)</label>
          <textarea
            className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a short note for this hand"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-[#B6FF00] px-4 py-3 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Saving Record...' : 'Save Record'}
        </button>
      </form>
    </section>
  );
}