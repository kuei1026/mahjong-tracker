'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const LOCAL_STORAGE_USER_NAME_KEY = 'mahjong_tracker_user_name';

function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';

  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

export default function HomePage() {
  const router = useRouter();

  const [ownerName, setOwnerName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [player3, setPlayer3] = useState('');
  const [player4, setPlayer4] = useState('');
  const [taiUnitAmount, setTaiUnitAmount] = useState(10);
  const [misdealPenalty, setMisdealPenalty] = useState(20);

  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinUserName, setJoinUserName] = useState('');

  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [message, setMessage] = useState('');

  const playerNames = useMemo(
    () => [player1.trim(), player2.trim(), player3.trim(), player4.trim()],
    [player1, player2, player3, player4]
  );

  const saveUserNameToLocalStorage = (name: string) => {
    localStorage.setItem(LOCAL_STORAGE_USER_NAME_KEY, name.trim());
  };

  const handleCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    const trimmedOwnerName = ownerName.trim();

    if (!trimmedOwnerName) {
      setMessage('請輸入房主名稱。');
      return;
    }

    if (playerNames.some((name) => !name)) {
      setMessage('請完整輸入 4 位玩家名稱。');
      return;
    }

    if (new Set(playerNames).size !== 4) {
      setMessage('4 位玩家名稱不能重複。');
      return;
    }

    if (!playerNames.includes(trimmedOwnerName)) {
      setMessage('房主名稱必須和其中一位玩家名稱一致。');
      return;
    }

    if (taiUnitAmount <= 0) {
      setMessage('每台金額必須大於 0。');
      return;
    }

    if (misdealPenalty < 0) {
      setMessage('相公罰分不能小於 0。');
      return;
    }

    setCreateLoading(true);

    try {
      let roomCode = generateRoomCode();
      let roomId: string | null = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .insert({
            room_code: roomCode,
            owner_name: trimmedOwnerName,
            tai_unit_amount: taiUnitAmount,
            misdeal_penalty: misdealPenalty,
          })
          .select()
          .single();

        if (!roomError && roomData) {
          roomId = roomData.id;
          break;
        }

        if (roomError?.code === '23505') {
          roomCode = generateRoomCode();
          continue;
        }

        throw roomError;
      }

      if (!roomId) {
        throw new Error('建立房間失敗。');
      }

      const playersPayload = playerNames.map((name, index) => ({
        room_id: roomId,
        seat_index: index,
        player_name: name,
        is_owner: name === trimmedOwnerName,
      }));

      const { error: playersError } = await supabase
        .from('room_players')
        .insert(playersPayload);

      if (playersError) {
        throw playersError;
      }

      saveUserNameToLocalStorage(trimmedOwnerName);
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error('Create room failed:', error);
      setMessage('建立房間失敗，請稍後再試。');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    const roomCode = joinRoomCode.trim().toUpperCase();
    const trimmedJoinUserName = joinUserName.trim();

    if (!roomCode) {
      setMessage('請輸入房號。');
      return;
    }

    if (!trimmedJoinUserName) {
      setMessage('請輸入你的名稱。');
      return;
    }

    setJoinLoading(true);

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_code, status')
        .eq('room_code', roomCode)
        .single();

      if (roomError || !roomData) {
        setMessage('找不到此房間。');
        return;
      }

      if (roomData.status !== 'active') {
        setMessage('此房間目前不是進行中狀態。');
        return;
      }

      saveUserNameToLocalStorage(trimmedJoinUserName);
      router.push(`/room/${roomData.id}`);
    } catch (error) {
      console.error('Join room failed:', error);
      setMessage('加入房間失敗，請稍後再試。');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1B1B1B] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-white/8 to-white/4 shadow-[0_20px_70px_rgba(0,0,0,0.32)] backdrop-blur">
          <div className="grid gap-8 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
                  Mahjong Tracker
                </p>
                <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                  🀄 麻將對局紀錄工具
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-neutral-400 sm:text-base">
                  用最不打斷牌局節奏的方式，快速紀錄每一手輸贏、同步比分、查看分數走勢與牌局數據。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    即時同步
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Supabase Realtime
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    核心定位
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    數據極簡風
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    目前版本
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    MVP v1.0
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    特色亮點
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">快速記錄，不破壞節奏</h2>
                </div>

                <div className="space-y-3 text-sm leading-7 text-neutral-400">
                  <p>• 房主一人紀錄，全員畫面即時同步</p>
                  <p>• 自摸 / 胡牌 / 流局 / 相公快速輸入</p>
                  <p>• 分數走勢圖與對局數據分析</p>
                  <p>• 胡牌張紀錄，逐步朝麻將數據產品靠近</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">建立房間</h2>
              <p className="mt-2 text-sm text-neutral-400">
                先設定 4 位玩家與基本規則，快速開始一場牌局。
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreateRoom}>
              <div className="space-y-2">
                <label className="text-sm text-neutral-300">房主名稱</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="例如：阿傑"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">玩家 1</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    placeholder="輸入名稱"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">玩家 2</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    placeholder="輸入名稱"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">玩家 3</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={player3}
                    onChange={(e) => setPlayer3(e.target.value)}
                    placeholder="輸入名稱"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">玩家 4</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={player4}
                    onChange={(e) => setPlayer4(e.target.value)}
                    placeholder="輸入名稱"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">每台金額</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={taiUnitAmount}
                    onChange={(e) => setTaiUnitAmount(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">相公罰分</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={misdealPenalty}
                    onChange={(e) => setMisdealPenalty(Number(e.target.value))}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full rounded-2xl bg-[#B6FF00] px-4 py-4 font-semibold text-black transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createLoading ? '建立中...' : '建立房間'}
              </button>
            </form>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">加入房間</h2>
              <p className="mt-2 text-sm text-neutral-400">
                輸入房號與你的名稱，直接進入已建立的對局。
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleJoinRoom}>
              <div className="space-y-2">
                <label className="text-sm text-neutral-300">房號</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 uppercase outline-none transition focus:border-lime-400"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                  placeholder="輸入房號"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-300">你的名稱</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                  value={joinUserName}
                  onChange={(e) => setJoinUserName(e.target.value)}
                  placeholder="例如：小白"
                />
              </div>

              <button
                type="submit"
                disabled={joinLoading}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joinLoading ? '加入中...' : '加入房間'}
              </button>
            </form>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">
              <p className="font-medium text-white">目前版本功能</p>
              <p className="mt-2 leading-7">
                建房、加房、房主紀錄、即時比分同步、分數走勢圖、對局紀錄、KPI 分析與稱號系統。
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}