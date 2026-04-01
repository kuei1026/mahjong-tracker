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

export default function ActionPanel({
  room,
  players,
  onRecorded,
}: ActionPanelProps) {
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
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.seat_index - b.seat_index),
    [players]
  );

  const requiresWinner = resultType === 'tsumo' || resultType === 'ron';
  const requiresLoser = resultType === 'ron' || resultType === 'misdeal';
  const requiresTaiCount = resultType === 'tsumo' || resultType === 'ron';
  const supportsWinningTile = resultType === 'tsumo' || resultType === 'ron';

  useEffect(() => {
    if (!feedbackMessage) return;

    const timer = window.setTimeout(() => {
      setFeedbackMessage('');
      setFeedbackType('');
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [feedbackMessage]);

  useEffect(() => {
    if (!recentlySaved) return;

    const timer = window.setTimeout(() => {
      setRecentlySaved(false);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [recentlySaved]);

  const triggerHapticFeedback = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const resetForm = () => {
    setResultType('tsumo');
    setWinnerSeat(null);
    setLoserSeat(null);
    setTaiCount(1);
    setWinningTile(null);
    setNote('');
  };

  const showError = (message: string) => {
    setFeedbackType('error');
    setFeedbackMessage(message);
    triggerHapticFeedback([80, 40, 80]);
  };

  const showSuccess = (message: string) => {
    setFeedbackType('success');
    setFeedbackMessage(message);
    setRecentlySaved(true);
    triggerHapticFeedback(60);
  };

  const handleResultTypeChange = (nextType: RecordType) => {
    setResultType(nextType);
    setFeedbackMessage('');
    setFeedbackType('');

    if (nextType === 'draw') {
      setWinnerSeat(null);
      setLoserSeat(null);
      setTaiCount(1);
      setWinningTile(null);
      return;
    }

    if (nextType === 'tsumo') {
      setLoserSeat(null);
      return;
    }

    if (nextType === 'misdeal') {
      setWinnerSeat(null);
      setWinningTile(null);
      return;
    }
  };

  const validateForm = () => {
    if (requiresWinner && winnerSeat === null) {
      return '請先選擇贏家。';
    }

    if (requiresLoser && loserSeat === null) {
      return resultType === 'misdeal'
        ? '請先選擇相公玩家。'
        : '請先選擇放槍玩家。';
    }

    if (resultType === 'ron' && winnerSeat === loserSeat) {
      return '贏家與放槍玩家不能是同一位。';
    }

    if (requiresTaiCount && taiCount <= 0) {
      return '台數必須大於 0。';
    }

    return '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedbackMessage('');
    setFeedbackType('');

    const validationMessage = validateForm();
    if (validationMessage) {
      showError(validationMessage);
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
        throw handError ?? new Error('建立手牌紀錄失敗。');
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
        winning_tile: supportsWinningTile ? winningTile : null,
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
      showSuccess('此手紀錄成功。');
      await onRecorded();

      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
        saveButtonRef.current?.focus();
      });
    } catch (error) {
      console.error('Record hand failed:', error);
      showError('紀錄失敗，請稍後再試。');
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
                disabled={isDisabled || loading}
                className={`min-h-[76px] rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] ${
                  isSelected
                    ? `${accentClass} border-transparent shadow-lg`
                    : 'border-white/10 bg-black/20 text-white hover:border-white/20'
                } ${isDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <div className="text-xs uppercase tracking-wide text-neutral-400">
                  第 {player.seat_index + 1} 位
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
    <section
      ref={panelRef}
      className={`rounded-[28px] border p-6 shadow-lg backdrop-blur transition ${
        recentlySaved
          ? 'border-[#B6FF00]/60 bg-[#B6FF00]/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">⚡ 對局紀錄</h2>
            <p className="mt-2 text-sm text-neutral-400">
              用最快的方式記下這一手的結果。
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-neutral-300">
            即將紀錄：第 {room.current_hand_no + 1} 手
          </div>
        </div>
      </div>

      {feedbackMessage ? (
        <div
          className={`mb-4 rounded-2xl px-4 py-3 text-sm font-medium ${
            feedbackType === 'success'
              ? 'border border-[#B6FF00]/30 bg-[#B6FF00]/10 text-[#D9FF7A]'
              : 'border border-red-400/30 bg-red-400/10 text-red-200'
          }`}
        >
          {feedbackMessage}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm text-neutral-300">結果類型</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RESULT_OPTIONS.map((option) => {
              const isActive = resultType === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleResultTypeChange(option.value)}
                  disabled={loading}
                  className={`min-h-[56px] rounded-2xl border px-4 py-3 font-semibold transition active:scale-[0.98] ${
                    isActive
                      ? 'border-transparent bg-[#B6FF00] text-black shadow-lg'
                      : 'border-white/10 bg-black/20 text-white hover:border-white/20'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {requiresWinner
          ? renderPlayerButtons({
              selectedSeat: winnerSeat,
              onSelect: setWinnerSeat,
              disabledSeat: resultType === 'ron' ? loserSeat : null,
              title: '贏家',
              accentClass: 'bg-[#B6FF00] text-black',
            })
          : null}

        {requiresLoser
          ? renderPlayerButtons({
              selectedSeat: loserSeat,
              onSelect: setLoserSeat,
              disabledSeat: resultType === 'ron' ? winnerSeat : null,
              title: resultType === 'misdeal' ? '相公玩家' : '放槍玩家',
              accentClass: 'bg-[#FF5F5F] text-white',
            })
          : null}

        {requiresTaiCount ? (
          <div className="space-y-3">
            <label className="text-sm text-neutral-300">台數</label>

            <div className="grid grid-cols-5 gap-2">
              {QUICK_TAI_OPTIONS.map((value) => {
                const isActive = taiCount === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTaiCount(value)}
                    disabled={loading}
                    className={`min-h-[52px] rounded-2xl px-4 py-3 font-semibold transition active:scale-[0.98] ${
                      isActive
                        ? 'bg-[#B6FF00] text-black shadow-lg'
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
                disabled={loading}
                className="min-h-[52px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-lg font-semibold text-white transition hover:border-white/20 active:scale-[0.98]"
              >
                −
              </button>

              <input
                type="number"
                min={1}
                className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-lg outline-none transition focus:border-lime-400"
                value={taiCount}
                onChange={(e) =>
                  setTaiCount(Math.max(1, Number(e.target.value) || 1))
                }
              />

              <button
                type="button"
                onClick={() => setTaiCount((prev) => prev + 1)}
                disabled={loading}
                className="min-h-[52px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-lg font-semibold text-white transition hover:border-white/20 active:scale-[0.98]"
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        {supportsWinningTile ? (
          <TilePicker value={winningTile} onChange={setWinningTile} />
        ) : null}

        <div className="space-y-2">
          <label className="text-sm text-neutral-300">備註（可不填）</label>
          <textarea
            className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：過水後改張、關鍵一手、特殊情況..."
          />
        </div>

        <button
          ref={saveButtonRef}
          type="submit"
          disabled={loading}
          className={`sticky bottom-3 z-10 w-full rounded-2xl px-4 py-4 text-base font-semibold transition active:scale-[0.99] ${
            loading
              ? 'cursor-not-allowed bg-[#B6FF00]/60 text-black opacity-70'
              : 'bg-[#B6FF00] text-black shadow-[0_8px_30px_rgba(182,255,0,0.22)] hover:opacity-95'
          }`}
        >
          {loading ? '紀錄中...' : '紀錄此手'}
        </button>
      </form>
    </section>
  );
}