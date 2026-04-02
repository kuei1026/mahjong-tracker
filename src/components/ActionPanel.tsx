'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateScoreChanges, type RecordType } from '@/lib/gameLogic';
import type { Room, RoomPlayer, WaitType } from '@/types/game';
import WheelSelector, { type WheelOption } from '@/components/WheelSelector';

interface ActionPanelProps {
  room: Room;
  players: RoomPlayer[];
  onRecorded: () => Promise<void> | void;
}

const RESULT_OPTIONS: { label: string; value: RecordType }[] = [
  { label: '自摸', value: 'tsumo' },
  { label: '胡牌', value: 'ron' },
  { label: '流局', value: 'draw' },
];

const TAI_OPTIONS: WheelOption<number>[] = Array.from({ length: 10 }, (_, i) => ({
  label: `${i + 1} 台`,
  value: i + 1,
}));

const WAIT_TYPE_OPTIONS: WheelOption<WaitType>[] = [
  { label: '單吊', value: 'single_wait' },
  { label: '雙頭', value: 'double_sided' },
  { label: '對對', value: 'double_pair' },
  { label: '邊章', value: 'edge_wait' },
  { label: '三個洞', value: 'triple_wait' },
  { label: '很多洞', value: 'multi_wait' },
];

const TILE_GROUPS = [
  {
    key: 'wan',
    label: '萬子',
    tiles: ['1萬', '2萬', '3萬', '4萬', '5萬', '6萬', '7萬', '8萬', '9萬'],
  },
  {
    key: 'tong',
    label: '筒子',
    tiles: ['1筒', '2筒', '3筒', '4筒', '5筒', '6筒', '7筒', '8筒', '9筒'],
  },
  {
    key: 'tiao',
    label: '條子',
    tiles: ['1條', '2條', '3條', '4條', '5條', '6條', '7條', '8條', '9條'],
  },
  {
    key: 'honor',
    label: '字牌',
    tiles: ['東', '南', '西', '北', '中', '發', '白'],
  },
] as const;

type TileGroupKey = (typeof TILE_GROUPS)[number]['key'];

export default function ActionPanel({
  room,
  players,
  onRecorded,
}: ActionPanelProps) {
  const [step, setStep] = useState(1);
  const [resultType, setResultType] = useState<RecordType>('tsumo');
  const [winnerSeat, setWinnerSeat] = useState<number | null>(null);
  const [loserSeat, setLoserSeat] = useState<number | null>(null);

  const [taiCount, setTaiCount] = useState(1);
  const [waitType, setWaitType] = useState<WaitType>('single_wait');
  const [winningTile, setWinningTile] = useState<string>('');
  const [activeTileGroup, setActiveTileGroup] = useState<TileGroupKey>('wan');

  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const [hasMisdeal, setHasMisdeal] = useState(false);
  const [misdealSeat, setMisdealSeat] = useState<number | null>(null);
  const [misdealNote, setMisdealNote] = useState('');

  const [showExtras, setShowExtras] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [recentlySaved, setRecentlySaved] = useState(false);

  const panelRef = useRef<HTMLElement | null>(null);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.seat_index - b.seat_index),
    [players]
  );

  const currentTileGroup = useMemo(
    () => TILE_GROUPS.find((group) => group.key === activeTileGroup) ?? TILE_GROUPS[0],
    [activeTileGroup]
  );

  const requiresWinner = resultType === 'tsumo' || resultType === 'ron';
  const requiresLoser = resultType === 'ron';
  const requiresTaiCount = resultType === 'tsumo' || resultType === 'ron';
  const supportsWinMeta = resultType === 'tsumo' || resultType === 'ron';

  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (resultType === 'draw') {
        setStep(3);
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
    setWaitType('single_wait');
    setWinningTile('');
    setActiveTileGroup('wan');
    setNote('');
    setHasMisdeal(false);
    setMisdealSeat(null);
    setMisdealNote('');
    setShowExtras(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (loading) return;

    if (requiresWinner && winnerSeat === null) {
      setFeedbackType('error');
      setFeedbackMessage('請先選擇胡牌玩家。');
      return;
    }

    if (requiresLoser && loserSeat === null) {
      setFeedbackType('error');
      setFeedbackMessage('請先選擇放槍玩家。');
      return;
    }

    if (supportsWinMeta && !waitType) {
      setFeedbackType('error');
      setFeedbackMessage('請選擇聽型。');
      return;
    }

    if (showExtras && hasMisdeal && misdealSeat === null) {
      setFeedbackType('error');
      setFeedbackMessage('請選擇相公玩家。');
      return;
    }

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
        baseScore: room.base_score ?? 0,
        taiUnitAmount: room.tai_unit_amount,
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
          wait_type: supportsWinMeta ? waitType : null,
          winning_tile: supportsWinMeta ? winningTile || null : null,
          note: showExtras ? note.trim() || null : null,
          misdeal_seat: showExtras && hasMisdeal ? misdealSeat : null,
          misdeal_note:
            showExtras && hasMisdeal ? misdealNote.trim() || null : null,
          created_by_name: room.owner_name,
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
    <section
      ref={panelRef}
      className={`rounded-[30px] border p-4 transition-all duration-500 ${
        recentlySaved
          ? 'border-[#B6FF00] bg-[#B6FF00]/10'
          : 'border-white/10 bg-white/5 shadow-2xl'
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${
              step >= s ? 'bg-[#B6FF00]' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {feedbackMessage && feedbackType ? (
        <div
          className={`mb-3 rounded-2xl px-4 py-3 text-sm font-medium ${
            feedbackType === 'success'
              ? 'border border-lime-400/20 bg-lime-400/10 text-lime-300'
              : 'border border-red-400/20 bg-red-400/10 text-red-300'
          }`}
        >
          {feedbackMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-bold text-white">這把結果是？</h3>
            <div className="grid grid-cols-3 gap-3">
              {RESULT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setResultType(opt.value);
                    handleNextStep();
                  }}
                  className={`h-20 rounded-2xl border text-lg font-bold transition active:scale-95 ${
                    resultType === opt.value
                      ? 'border-transparent bg-[#B6FF00] text-black'
                      : 'border-white/10 bg-black/40 text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            {requiresWinner && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-400">是誰胡了？</p>
                <div className="grid grid-cols-2 gap-3">
                  {sortedPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setWinnerSeat(p.seat_index)}
                      className={`h-16 rounded-xl border font-bold transition ${
                        winnerSeat === p.seat_index
                          ? 'border-transparent bg-[#B6FF00] text-black'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      {p.player_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {requiresLoser && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-400">誰放槍？</p>
                <div className="grid grid-cols-2 gap-3">
                  {sortedPlayers.map((p) => {
                    const isDisabled = winnerSeat === p.seat_index;
                    const isSelected = loserSeat === p.seat_index;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setLoserSeat(p.seat_index)}
                        disabled={isDisabled}
                        className={`h-16 rounded-xl border font-bold transition ${
                          isSelected
                            ? 'border-transparent bg-[#FF5F5F] text-white'
                            : 'border-white/10 bg-white/5'
                        } ${isDisabled ? 'cursor-not-allowed opacity-30' : ''}`}
                      >
                        {p.player_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleNextStep}
              disabled={
                (requiresWinner && winnerSeat === null) ||
                (requiresLoser && loserSeat === null)
              }
              className="w-full rounded-2xl bg-white/10 py-4 font-bold transition hover:bg-white/20 disabled:opacity-30"
            >
              下一步
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            {supportsWinMeta ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <WheelSelector
                    label="台數"
                    value={taiCount}
                    options={TAI_OPTIONS}
                    onChange={setTaiCount}
                  />

                  <WheelSelector
                    label="聽型"
                    value={waitType}
                    options={WAIT_TYPE_OPTIONS}
                    onChange={setWaitType}
                  />
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex gap-2">
                      {TILE_GROUPS.map((group) => (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => setActiveTileGroup(group.key)}
                          className={`rounded-full px-3 py-2 text-sm font-bold transition ${
                            activeTileGroup === group.key
                              ? 'bg-[#B6FF00] text-black'
                              : 'border border-white/10 bg-black/25 text-white'
                          }`}
                        >
                          {group.label}
                        </button>
                      ))}
                    </div>

                    {winningTile ? (
                      <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold text-neutral-300">
                        {winningTile}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`grid gap-3 ${
                      activeTileGroup === 'honor'
                        ? 'grid-cols-4'
                        : 'grid-cols-3'
                    }`}
                  >
                    {currentTileGroup.tiles.map((tile) => (
                      <button
                        key={tile}
                        type="button"
                        onClick={() => setWinningTile(tile)}
                        className={`h-16 rounded-[20px] border text-xl font-black transition active:scale-[0.98] ${
                          winningTile === tile
                            ? 'border-transparent bg-[#B6FF00] text-black shadow-[0_10px_30px_rgba(182,255,0,0.18)]'
                            : 'border-white/10 bg-black/30 text-white'
                        }`}
                      >
                        {activeTileGroup === 'honor' ? tile : tile.replace(/(萬|筒|條)/, '')}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-sm text-neutral-400">
                流局不需填寫台數、聽型與胡牌張。
              </div>
            )}

            {!showExtras ? (
              <button
                type="button"
                onClick={() => setShowExtras(true)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white transition active:scale-[0.99]"
              >
                更多紀錄（相公 / 備註）
              </button>
            ) : (
              <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">本手有人相公嗎？</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      這是附加紀錄，不影響本手分數。
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHasMisdeal(false);
                        setMisdealSeat(null);
                        setMisdealNote('');
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                        !hasMisdeal
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      沒有
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasMisdeal(true)}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                        hasMisdeal
                          ? 'bg-amber-300 text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      有
                    </button>
                  </div>
                </div>

                {hasMisdeal && (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm text-neutral-300">誰相公？</p>
                      <div className="grid grid-cols-2 gap-3">
                        {sortedPlayers.map((p) => (
                          <button
                            key={`misdeal-${p.id}`}
                            type="button"
                            onClick={() => setMisdealSeat(p.seat_index)}
                            className={`h-14 rounded-xl border font-bold transition ${
                              misdealSeat === p.seat_index
                                ? 'border-transparent bg-amber-300 text-black'
                                : 'border-white/10 bg-white/5 text-white'
                            }`}
                          >
                            {p.player_name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm text-neutral-300">
                        相公備註（可選）
                      </label>
                      <textarea
                        value={misdealNote}
                        onChange={(e) => setMisdealNote(e.target.value)}
                        rows={2}
                        placeholder="例如：少一張、多一張..."
                        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-neutral-500"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="block text-sm text-neutral-300">
                    本手備註（可選）
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="例如：特殊情況、補充說明..."
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-neutral-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowExtras(false)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 text-sm font-bold text-neutral-300"
                >
                  收起補充資訊
                </button>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-2xl bg-white/5 py-4 font-bold"
              >
                重選
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] rounded-2xl bg-[#B6FF00] py-4 font-bold text-black shadow-xl shadow-[#B6FF00]/20 disabled:opacity-60"
              >
                {loading ? '紀錄中...' : '確認送出'}
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}