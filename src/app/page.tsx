'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function rotatePlayersFromStarter(grabOrder: string[], starterName: string): string[] {
  const starterIndex = grabOrder.findIndex((name) => name === starterName);
  if (starterIndex === -1) return grabOrder;
  return [...grabOrder.slice(starterIndex), ...grabOrder.slice(0, starterIndex)];
}

const QUICK_BASE_OPTIONS = [10, 20, 30, 50, 100];
const QUICK_TAI_OPTIONS = [5, 10, 20, 50, 100];

type SeatKey = 'east' | 'south' | 'west' | 'north';

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);

  const [ownerName, setOwnerName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [player3, setPlayer3] = useState('');
  const [player4, setPlayer4] = useState('');

  const [baseScore, setBaseScore] = useState(30);
  const [taiUnitAmount, setTaiUnitAmount] = useState(10);

  const [baseCustomInput, setBaseCustomInput] = useState('30');
  const [taiCustomInput, setTaiCustomInput] = useState('10');

  const [grabEast, setGrabEast] = useState('');
  const [grabSouth, setGrabSouth] = useState('');
  const [grabWest, setGrabWest] = useState('');
  const [grabNorth, setGrabNorth] = useState('');
  const [startingDealerName, setStartingDealerName] = useState('');

  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinUserName, setJoinUserName] = useState('');

  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        const name =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          '';
        setOwnerName(name);
        setPlayer1(name);
      }

      setAuthLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        const name =
          nextUser.user_metadata?.full_name ||
          nextUser.user_metadata?.name ||
          '';
        setOwnerName(name);
        setPlayer1(name);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error('Google 登入失敗:', error);
      setMessage(`登入失敗：${error.message}`);
    }
  };

  const playerNames = useMemo(
    () => [player1.trim(), player2.trim(), player3.trim(), player4.trim()],
    [player1, player2, player3, player4]
  );

  const validPlayerNames = useMemo(() => playerNames.filter(Boolean), [playerNames]);

  const grabOrder = useMemo(
    () => [grabEast.trim(), grabSouth.trim(), grabWest.trim(), grabNorth.trim()],
    [grabEast, grabSouth, grabWest, grabNorth]
  );

  const finalSeatPlayers = useMemo(() => {
    if (grabOrder.some((n) => !n)) return [];
    if (new Set(grabOrder).size !== 4) return [];
    if (!startingDealerName) return [];
    return rotatePlayersFromStarter(grabOrder, startingDealerName);
  }, [grabOrder, startingDealerName]);

  const resetCreateFlow = () => {
    setCreateStep(1);
    setGrabEast('');
    setGrabSouth('');
    setGrabWest('');
    setGrabNorth('');
    setStartingDealerName('');
    setMessage('');
  };

  const validateStep1 = () => {
    if (!playerNames.every((n) => n)) {
      setMessage('請填寫所有玩家名稱');
      return false;
    }

    if (new Set(playerNames).size !== 4) {
      setMessage('玩家名稱不可重複');
      return false;
    }

    if (baseScore <= 0 || taiUnitAmount <= 0) {
      setMessage('底錢與台錢需大於 0');
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    const seats = [grabEast, grabSouth, grabWest, grabNorth];

    if (seats.includes('')) {
      setMessage('抓位不可留空');
      return false;
    }

    if (new Set(seats).size !== 4) {
      setMessage('抓位不可重複');
      return false;
    }

    return true;
  };

  const validateStep3 = () => {
    if (!startingDealerName) {
      setMessage('請選擇起莊玩家');
      return false;
    }

    if (!finalSeatPlayers.length) {
      setMessage('座位計算失敗，請重新確認抓位與起莊');
      return false;
    }

    return true;
  };

  const handleCreateRoom = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!user) {
      setMessage('請先登入 Google 帳號');
      return;
    }

    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      return;
    }

    setCreateLoading(true);
    setMessage('');

    let createdRoomId: string | null = null;

    try {
      const roomCode = generateRoomCode();
      const ownerDisplayName = player1.trim();

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_code: roomCode,
          owner_id: user.id,
          owner_name: ownerDisplayName,
          base_score: baseScore,
          tai_unit_amount: taiUnitAmount,
          status: 'active',
          round_wind: 0,
          dealer_seat_index: 0,
          dealer_streak: 0,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      createdRoomId = roomData.id;

      const ownerSeatIndex = finalSeatPlayers.findIndex((name) => name === ownerDisplayName);

      if (ownerSeatIndex === -1) {
        throw new Error('找不到房主座位，請確認玩家名稱與抓位設定');
      }

      const playersPayload = finalSeatPlayers.map((name, idx) => ({
        room_id: roomData.id,
        seat_index: idx,
        player_name: name,
        is_owner: idx === ownerSeatIndex,
        user_id: idx === ownerSeatIndex ? user.id : null,
      }));

      const { error: playersError } = await supabase.from('room_players').insert(playersPayload);

      if (playersError) throw playersError;

      localStorage.setItem('mahjong_tracker_user_name', ownerDisplayName);
      router.push(`/room/${roomData.id}`);
    } catch (error: any) {
      console.error('建立房間失敗:', error);

      if (createdRoomId) {
        const { error: rollbackError } = await supabase
          .from('rooms')
          .delete()
          .eq('id', createdRoomId);

        if (rollbackError) {
          console.error('回滾刪除房間失敗:', rollbackError);
        }
      }

      setMessage(`建立失敗：${error?.message || '未知錯誤，請查看 console'}`);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinRoom = async (event: FormEvent) => {
    event.preventDefault();

    const roomCode = joinRoomCode.trim().toUpperCase();
    const displayName = joinUserName.trim();

    if (!roomCode || !displayName) {
      setMessage('請填寫完整資訊');
      return;
    }

    setJoinLoading(true);
    setMessage('');

    try {
      const { data: roomData, error } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('room_code', roomCode)
        .single();

      if (error || !roomData) {
        throw new Error('找不到此房間');
      }

      if (roomData.status !== 'active') {
        throw new Error('此房間目前不可加入');
      }

      localStorage.setItem('mahjong_tracker_user_name', displayName);
      router.push(`/room/${roomData.id}`);
    } catch (error: any) {
      console.error('加入房間失敗:', error);
      setMessage(error?.message || '加入房間失敗');
    } finally {
      setJoinLoading(false);
    }
  };

  const selectedMap = {
    east: grabEast,
    south: grabSouth,
    west: grabWest,
    north: grabNorth,
  };

  const getSeatOptions = (seat: SeatKey) => {
    const otherSelected = Object.entries(selectedMap)
      .filter(([key]) => key !== seat)
      .map(([, value]) => value)
      .filter(Boolean);

    return validPlayerNames.filter(
      (name) => name === selectedMap[seat] || !otherSelected.includes(name)
    );
  };

  const ScorePresetPanel = ({
    title,
    subtitle,
    value,
    options,
    customInput,
    setCustomInput,
    onQuickPick,
    onApplyCustom,
  }: {
    title: string;
    subtitle: string;
    value: number;
    options: number[];
    customInput: string;
    setCustomInput: (v: string) => void;
    onQuickPick: (v: number) => void;
    onApplyCustom: (v: number) => void;
  }) => {
    return (
      <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block">
              {title}
            </label>
            <p className="text-neutral-500 text-xs mt-1">{subtitle}</p>
          </div>
          <div className="text-4xl font-black text-[#B6FF00] leading-none">{value}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onQuickPick(option);
                  setCustomInput(String(option));
                }}
                className={`px-4 py-2 rounded-full text-sm font-black border transition-all ${
                  active
                    ? 'bg-[#B6FF00] text-black border-[#B6FF00]'
                    : 'bg-black/40 text-white border-white/10 hover:border-[#B6FF00]/40 hover:text-[#B6FF00]'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none font-bold text-white"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="自訂數值"
          />
          <button
            type="button"
            onClick={() => {
              const parsed = Number(customInput);
              if (!Number.isFinite(parsed) || parsed <= 0) {
                setMessage(`${title} 請輸入大於 0 的數值`);
                return;
              }
              setMessage('');
              onApplyCustom(parsed);
            }}
            className="px-5 rounded-2xl bg-white text-black font-black text-sm hover:opacity-90 transition-opacity"
          >
            套用
          </button>
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-[#B6FF00] font-black italic">
        ARENA LOADING...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 sm:p-10 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter">
            MAHJONG <span className="text-[#B6FF00]">TRACKER.</span>
          </h1>
        </header>

        {message && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold text-center whitespace-pre-wrap">
            {message}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!user && mode !== 'join' ? (
            <motion.section
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.02] border border-white/5 p-10 rounded-[40px] text-center shadow-2xl backdrop-blur-xl"
            >
              <h2 className="text-2xl font-black mb-4">歡迎來到競技場</h2>
              <p className="text-neutral-500 mb-10 text-sm">
                房主登入後可自動儲存對局紀錄與成就
              </p>

              <button
                onClick={handleGoogleLogin}
                className="w-full py-5 bg-white text-black rounded-full font-black text-xl hover:bg-[#B6FF00] active:scale-95 transition-all"
              >
                GOOGLE 帳號登入
              </button>

              <button
                onClick={() => {
                  setMessage('');
                  setMode('join');
                }}
                className="mt-10 text-neutral-600 text-xs font-black uppercase tracking-widest hover:text-white transition-colors underline underline-offset-8"
              >
                我有房號，直接加入 / 觀戰
              </button>
            </motion.section>
          ) : (
            <div className="space-y-6">
              {mode === 'menu' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <button
                    onClick={() => {
                      setMessage('');
                      setMode('create');
                    }}
                    className="bg-[#B6FF00]/5 border border-[#B6FF00]/20 p-8 rounded-[32px] text-left hover:bg-[#B6FF00]/10 transition-all"
                  >
                    <p className="text-[#B6FF00] font-black text-xs uppercase mb-2 tracking-widest">
                      Create Room
                    </p>
                    <h3 className="text-2xl font-black">建立對局</h3>
                  </button>

                  <button
                    onClick={() => {
                      setMessage('');
                      setMode('join');
                    }}
                    className="bg-white/5 border border-white/10 p-8 rounded-[32px] text-left hover:bg-white/10 transition-all"
                  >
                    <p className="text-neutral-500 font-black text-xs uppercase mb-2 tracking-widest">
                      Join / Spectate
                    </p>
                    <h3 className="text-2xl font-black">加入 / 觀戰</h3>
                  </button>

                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="sm:col-span-2 mt-8 text-neutral-700 text-[10px] font-black uppercase tracking-[0.3em] hover:text-red-500 text-center"
                  >
                    Sign Out
                  </button>
                </motion.div>
              )}

              {mode === 'create' && (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/[0.03] border border-white/10 rounded-[40px] overflow-hidden pb-32"
                >
                  <div className="p-8 border-b border-white/5 flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-black italic">Arena Setup.</h2>
                      <p className="text-[#B6FF00] text-[10px] font-black uppercase mt-1">
                        Host: {user?.user_metadata?.full_name || user?.user_metadata?.name || 'Host'}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setMode('menu');
                        resetCreateFlow();
                      }}
                      className="text-neutral-500 font-bold uppercase text-[10px] tracking-widest hover:text-white"
                    >
                      Back
                    </button>
                  </div>

                  <div className="p-8">
                    <div className="mb-8 flex gap-2">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`h-1.5 flex-1 rounded-full ${
                            createStep >= step ? 'bg-[#B6FF00]' : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>

                    {createStep === 1 && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[player1, player2, player3, player4].map((player, i) => (
                            <div key={i} className="space-y-2">
                              <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                                Player {i + 1} {i === 0 && '(Host)'}
                              </label>
                              <input
                                className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl outline-none"
                                value={player}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (i === 0) {
                                    setPlayer1(val);
                                    setOwnerName(val);
                                  } else if (i === 1) {
                                    setPlayer2(val);
                                  } else if (i === 2) {
                                    setPlayer3(val);
                                  } else {
                                    setPlayer4(val);
                                  }
                                }}
                                placeholder={`玩家 ${i + 1}`}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <ScorePresetPanel
                            title="底錢 Base"
                            subtitle="常用數值一鍵選，或手動輸入"
                            value={baseScore}
                            options={QUICK_BASE_OPTIONS}
                            customInput={baseCustomInput}
                            setCustomInput={setBaseCustomInput}
                            onQuickPick={setBaseScore}
                            onApplyCustom={setBaseScore}
                          />

                          <ScorePresetPanel
                            title="台錢 Tai"
                            subtitle="快速設定常用台錢"
                            value={taiUnitAmount}
                            options={QUICK_TAI_OPTIONS}
                            customInput={taiCustomInput}
                            setCustomInput={setTaiCustomInput}
                            onQuickPick={setTaiUnitAmount}
                            onApplyCustom={setTaiUnitAmount}
                          />
                        </div>
                      </div>
                    )}

                    {createStep === 2 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-black italic">Grab Order.</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[
                            {
                              key: 'east' as SeatKey,
                              label: '抓位東',
                              val: grabEast,
                              set: setGrabEast,
                              color: '#B6FF00',
                            },
                            {
                              key: 'south' as SeatKey,
                              label: '抓位南',
                              val: grabSouth,
                              set: setGrabSouth,
                              color: '#67E8F9',
                            },
                            {
                              key: 'west' as SeatKey,
                              label: '抓位西',
                              val: grabWest,
                              set: setGrabWest,
                              color: '#FDBA74',
                            },
                            {
                              key: 'north' as SeatKey,
                              label: '抓位北',
                              val: grabNorth,
                              set: setGrabNorth,
                              color: '#FB7185',
                            },
                          ].map((item) => {
                            const options = getSeatOptions(item.key);

                            return (
                              <div
                                key={item.label}
                                className="p-4 bg-white/5 rounded-2xl border border-white/5"
                              >
                                <label
                                  className="text-[10px] font-black mb-2 block uppercase"
                                  style={{ color: item.color }}
                                >
                                  {item.label}
                                </label>

                                <div className="relative">
                                  <select
                                    className="w-full appearance-none bg-black/50 rounded-2xl px-4 py-4 pr-12 outline-none border border-white/5 text-base font-bold text-white hover:border-white/15 focus:border-[#B6FF00]/40 transition-colors"
                                    value={item.val}
                                    onChange={(e) => item.set(e.target.value)}
                                  >
                                    <option value="">選擇玩家</option>
                                    {options.map((name) => (
                                      <option key={name} value={name}>
                                        {name}
                                      </option>
                                    ))}
                                  </select>

                                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/70">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="18"
                                      height="18"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="m6 9 6 6 6-6" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">
                            小優化說明
                          </p>
                          <p className="text-sm text-neutral-400 leading-relaxed">
                            已選過的玩家會自動從其他抓位選單中隱藏，減少重複選取的機率。
                          </p>
                        </div>
                      </div>
                    )}

                    {createStep === 3 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-black italic">Starting Dealer.</h3>

                        <div className="grid grid-cols-2 gap-3">
                          {validPlayerNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => setStartingDealerName(name)}
                              className={`p-6 rounded-3xl border font-black transition-all text-left ${
                                startingDealerName === name
                                  ? 'bg-[#B6FF00] text-black border-transparent shadow-[0_10px_30px_rgba(182,255,0,0.2)]'
                                  : 'bg-white/5 border-white/5 text-neutral-400'
                              }`}
                            >
                              <p className="text-[10px] uppercase opacity-50 mb-1">Dealer</p>
                              <div className="text-xl">{name}</div>
                            </button>
                          ))}
                        </div>

                        {finalSeatPlayers.length > 0 && (
                          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3">
                              最終座位順序（由莊家開始）
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-sm font-bold">
                              <div className="rounded-2xl bg-black/30 p-4">
                                東 / 莊家起始：{finalSeatPlayers[0]}
                              </div>
                              <div className="rounded-2xl bg-black/30 p-4">
                                南：{finalSeatPlayers[1]}
                              </div>
                              <div className="rounded-2xl bg-black/30 p-4">
                                西：{finalSeatPlayers[2]}
                              </div>
                              <div className="rounded-2xl bg-black/30 p-4">
                                北：{finalSeatPlayers[3]}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="fixed bottom-0 left-0 right-0 p-8 bg-black/90 backdrop-blur-xl border-t border-white/5">
                    <div className="max-w-3xl mx-auto flex gap-4">
                      <button
                        className="flex-1 py-5 rounded-full border border-white/10 font-black uppercase text-xs tracking-widest"
                        onClick={() => {
                          if (createStep === 1) {
                            setMode('menu');
                            resetCreateFlow();
                            return;
                          }
                          setMessage('');
                          setCreateStep((prev) => (prev - 1) as 1 | 2 | 3);
                        }}
                      >
                        Back
                      </button>

                      <button
                        className="flex-[2] py-5 rounded-full bg-[#B6FF00] text-black font-black uppercase text-xs tracking-widest shadow-[0_10px_40px_rgba(182,255,0,0.2)] active:scale-95 transition-all disabled:opacity-60"
                        disabled={createLoading}
                        onClick={(e) => {
                          if (createStep === 1) {
                            setMessage('');
                            if (!validateStep1()) return;
                            setCreateStep(2);
                            return;
                          }

                          if (createStep === 2) {
                            setMessage('');
                            if (!validateStep2()) return;
                            setCreateStep(3);
                            return;
                          }

                          handleCreateRoom(e as any);
                        }}
                      >
                        {createStep === 3
                          ? createLoading
                            ? 'Creating...'
                            : 'Launch Arena'
                          : 'Next Step'}
                      </button>
                    </div>
                  </div>
                </motion.section>
              )}

              {mode === 'join' && (
                <motion.section
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white/[0.03] border border-white/10 rounded-[40px] p-10"
                >
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-black italic">Join / Spectate.</h2>
                    <button
                      onClick={() => {
                        if (user) setMode('menu');
                        setMessage('');
                      }}
                      className="text-neutral-500 font-bold uppercase text-[10px] tracking-widest hover:text-white"
                    >
                      {user ? 'Cancel' : 'Close'}
                    </button>
                  </div>

                  <form onSubmit={handleJoinRoom} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">
                        Room Code
                      </label>
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-black/40 px-6 py-6 text-3xl font-black tracking-[0.3em] uppercase text-[#B6FF00] outline-none"
                        value={joinRoomCode}
                        onChange={(e) => setJoinRoomCode(e.target.value)}
                        placeholder="CODE"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">
                        Your Name
                      </label>
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-black/40 px-6 py-5 outline-none font-bold"
                        value={joinUserName}
                        onChange={(e) => setJoinUserName(e.target.value)}
                        placeholder="輸入你的暱稱"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={joinLoading}
                      className="w-full py-6 rounded-full bg-white text-black font-black text-lg active:scale-95 transition-all disabled:opacity-60"
                    >
                      {joinLoading ? 'ENTERING...' : 'ENTER ARENA'}
                    </button>
                  </form>
                </motion.section>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}