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

const RESULT_OPTIONS: { label: string; value: RecordType }[] = [
  { label: 'Tsumo', value: 'tsumo' },
  { label: 'Ron', value: 'ron' },
  { label: 'Draw', value: 'draw' },
  { label: 'Misdeal', value: 'misdeal' },
];

const QUICK_TAI_OPTIONS = [1, 2, 3, 4, 5];

export default function ActionPanel({
  room,
  players,
  onRecorded,
}: ActionPanelProps) {
  const [resultType, setResultType] = useState<RecordType>('tsumo');
  const [winnerSeat, setWinnerSeat] = useState<number | null>(null);
  const [loserSeat, setLoserSeat] = useState<number | null>(null);
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
    setWinnerSeat(null);
    setLoserSeat(null);
    setTaiCount(1);
    setNote('');
  };

  const handleResultTypeChange = (nextType: RecordType) => {
    setResultType(nextType);
    setMessage('');

    if (nextType === 'draw') {
      setWinnerSeat(null);
      setLoserSeat(null);
      setTaiCount(1);
      return;
    }

    if (nextType === 'tsumo') {
      setLoserSeat(null);
      return;
    }

    if (nextType === 'misdeal') {
      setWinnerSeat(null);
      return;
    }
  };

  const validateForm = () => {
    if (requiresWinner && winnerSeat === null) {
      return 'Please select a winner.';
    }

    if (requiresLoser && loserSeat === null) {
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
        winnerSeat,
        loserSeat,
        taiCount: requiresTaiCount ? taiCount : 0,
        taiUnitAmount: room.tai_unit_amount,
        misdealPenalty: room.misdeal_penalty,
      });

      const { error: recordError } = await supabase.from('records').insert({
        hand_id: handData.id,
        room_id: room.id,
        result_type: resultType,
        winner_seat: winnerSeat,
        loser_seat: loserSeat,
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

  const renderPlayerButtons = ({
    selectedSeat,
    onSelect,
    disabledSeat,
    title,
    accentClass,
  }: {
    selectedSeat: number | null;
    onSelect: (seatIndex: number) => void;
    disabledSeat?: number | null;
    title: string;
    accentClass: string;
  }) => {
    return (
      <div className="space-y-2">
        <label className="text-sm text-neutral-300">{title}</label>
        <div className="grid gap-3 sm:grid-cols-2">
          {sortedPlayers.map((player) => {
            const isSelected = selectedSeat === player.seat_index;
            const isDisabled = disabledSeat === player.seat_index;

            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onSelect(player.seat_index)}
                disabled={isDisabled}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? `${accentClass} border-transparent`
                    : 'border-white/10 bg-black/20 text-white hover:border-white/20'
                } ${isDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <div className="text-xs uppercase tracking-wide text-neutral-400">
                  Seat {player.seat_index + 1}
                </div>
                <div className="mt-1 text-base font-semibold">
                  {player.player_name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Owner Action Panel</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Record one hand result quickly and update room scores instantly.
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-200">
          {message}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm text-neutral-300">Result Type</label>
          <div className="grid gap-3 sm:grid-cols-4">
            {RESULT_OPTIONS.map((option) => {
              const isActive = resultType === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleResultTypeChange(option.value)}
                  className={`rounded-2xl border px-4 py-3 font-semibold transition ${
                    isActive
                      ? 'border-transparent bg-[#B6FF00] text-black'
                      : 'border-white/10 bg-black/20 text-white hover:border-white/20'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {requiresWinner &&
          renderPlayerButtons({
            selectedSeat: winnerSeat,
            onSelect: setWinnerSeat,
            disabledSeat: resultType === 'ron' ? loserSeat : null,
            title: 'Winner',
            accentClass: 'bg-[#B6FF00] text-black',
          })}

        {requiresLoser &&
          renderPlayerButtons({
            selectedSeat: loserSeat,
            onSelect: setLoserSeat,
            disabledSeat: resultType === 'ron' ? winnerSeat : null,
            title: resultType === 'misdeal' ? 'Misdeal Player' : 'Loser',
            accentClass: 'bg-[#FF5F5F] text-white',
          })}

        {requiresTaiCount ? (
          <div className="space-y-3">
            <label className="text-sm text-neutral-300">Tai Count</label>

            <div className="grid grid-cols-5 gap-2">
              {QUICK_TAI_OPTIONS.map((value) => {
                const isActive = taiCount === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTaiCount(value)}
                    className={`rounded-2xl px-4 py-3 font-semibold transition ${
                      isActive
                        ? 'bg-[#B6FF00] text-black'
                        : 'border border-white/10 bg-black/20 text-white hover:border-white/20'
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTaiCount((prev) => Math.max(1, prev - 1))}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-lg font-semibold text-white transition hover:border-white/20"
              >
                −
              </button>

              <input
                type="number"
                min={1}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center outline-none transition focus:border-lime-400"
                value={taiCount}
                onChange={(e) => setTaiCount(Math.max(1, Number(e.target.value) || 1))}
              />

              <button
                type="button"
                onClick={() => setTaiCount((prev) => prev + 1)}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-lg font-semibold text-white transition hover:border-white/20"
              >
                +
              </button>
            </div>
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
          className="w-full rounded-2xl bg-[#B6FF00] px-4 py-4 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Saving Record...' : 'Save Record'}
        </button>
      </form>
    </section>
  );
}