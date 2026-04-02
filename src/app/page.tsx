'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSeatWind } from '@/lib/gameLogic';

const LOCAL_STORAGE_USER_NAME_KEY = 'mahjong_tracker_user_name';

function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type SeatAssignment = {
  seatIndex: number;
  playerName: string;
};

const SEATS = [0, 1, 2, 3] as const;

export default function HomePage() {
  const router = useRouter();

  const [ownerName, setOwnerName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [player3, setPlayer3] = useState('');
  const [player4, setPlayer4] = useState('');

  const [baseScore, setBaseScore] = useState(30);
  const [taiUnitAmount, setTaiUnitAmount] = useState(10);

  const [dealerSeatIndex, setDealerSeatIndex] = useState(0);

  const [seatEast, setSeatEast] = useState('');
  const [seatSouth, setSeatSouth] = useState('');
  const [seatWest, setSeatWest] = useState('');
  const [seatNorth, setSeatNorth] = useState('');

  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [message, setMessage] = useState('');

  const playerNames = useMemo(
    () => [player1.trim(), player2.trim(), player3.trim(), player4.trim()],
    [player1, player2, player3, player4]
  );

  const seatAssignments = useMemo<SeatAssignment[]>(
    () => [
      { seatIndex: 0, playerName: seatEast.trim() },
      { seatIndex: 1, playerName: seatSouth.trim() },
      { seatIndex: 2, playerName: seatWest.trim() },
      { seatIndex: 3, playerName: seatNorth.trim() },
    ],
    [seatEast, seatSouth, seatWest, seatNorth]
  );

  const allNamedPlayersReady =
    playerNames.filter(Boolean).length === 4 && new Set(playerNames).size === 4;

  const saveUserNameToLocalStorage = (name: string) => {
    localStorage.setItem(LOCAL_STORAGE_USER_NAME_KEY, name.trim());
  };

  const handleAutoSeat = () => {
    if (!allNamedPlayersReady) {
      setMessage('請先完整輸入 4 位且不重複的玩家名稱。');
      return;
    }

    setSeatEast(playerNames[0]);
    setSeatSouth(playerNames[1]);
    setSeatWest(playerNames[2]);
    setSeatNorth(playerNames[3]);
    setMessage('');
  };

  const handleCreateRoom = async (event: FormEvent) => {
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

    if (baseScore < 0) {
      setMessage('底分不能小於 0。');
      return;
    }

    if (taiUnitAmount <= 0) {
      setMessage('每台金額必須大於 0。');
      return;
    }

    if (seatAssignments.some((item) => !item.playerName)) {
      setMessage('請完成東、南、西、北四個座位安排。');
      return;
    }

    const assignedNames = seatAssignments.map((item) => item.playerName);

    if (new Set(assignedNames).size !== 4) {
      setMessage('座位安排不能重複，東南西北必須各是一位不同玩家。');
      return;
    }

    const allAssignedFromPlayers = assignedNames.every((name) => playerNames.includes(name));
    if (!allAssignedFromPlayers) {
      setMessage('座位安排中的玩家必須來自上方輸入的 4 位玩家。');
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
            base_score: baseScore,
            tai_unit_amount: taiUnitAmount,
            round_wind: 0,
            dealer_seat_index: dealerSeatIndex,
            dealer_streak: 0,
            status: 'active',
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

      const playersPayload = seatAssignments.map((item) => ({
        room_id: roomId,
        seat_index: item.seatIndex,
        player_name: item.playerName,
        is_owner: item.playerName === trimmedOwnerName,
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

  const handleJoinRoom = async (event: FormEvent) => {
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
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black">麻將對局紀錄工具</h1>
        <p className="mt-3 text-white/70">
          用最不打斷牌局節奏的方式，快速紀錄每一手輸贏、同步比分、查看分數走勢與牌局數據。
        </p>

        {message ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {message}
          </div>
        ) : null}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black">建立房間</h2>
          <p className="mt-2 text-sm text-white/60">
            先設定 4 位玩家、座位與起莊，快速開始一場牌局。
          </p>

          <form onSubmit={handleCreateRoom} className="mt-6 space-y-5">
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="房主名稱，例如：阿傑"
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                value={player1}
                onChange={(e) => setPlayer1(e.target.value)}
                placeholder="玩家 1"
              />
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                value={player2}
                onChange={(e) => setPlayer2(e.target.value)}
                placeholder="玩家 2"
              />
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                value={player3}
                onChange={(e) => setPlayer3(e.target.value)}
                placeholder="玩家 3"
              />
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                value={player4}
                onChange={(e) => setPlayer4(e.target.value)}
                placeholder="玩家 4"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-white/70">一底多少</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                  value={baseScore}
                  onChange={(e) => setBaseScore(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/70">一台多少</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                  value={taiUnitAmount}
                  onChange={(e) => setTaiUnitAmount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">安排座位</h3>
                  <p className="mt-1 text-sm text-white/60">
                    請決定東、南、西、北各自是哪位玩家。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAutoSeat}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition active:scale-[0.99]"
                >
                  自動帶入
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#B6FF00]">東</label>
                  <select
                    value={seatEast}
                    onChange={(e) => setSeatEast(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                  >
                    <option value="">請選擇玩家</option>
                    {playerNames
                      .filter(Boolean)
                      .map((name) => (
                        <option key={`east-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#67E8F9]">南</label>
                  <select
                    value={seatSouth}
                    onChange={(e) => setSeatSouth(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                  >
                    <option value="">請選擇玩家</option>
                    {playerNames
                      .filter(Boolean)
                      .map((name) => (
                        <option key={`south-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#FDBA74]">西</label>
                  <select
                    value={seatWest}
                    onChange={(e) => setSeatWest(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                  >
                    <option value="">請選擇玩家</option>
                    {playerNames
                      .filter(Boolean)
                      .map((name) => (
                        <option key={`west-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#FB7185]">北</label>
                  <select
                    value={seatNorth}
                    onChange={(e) => setSeatNorth(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                  >
                    <option value="">請選擇玩家</option>
                    {playerNames
                      .filter(Boolean)
                      .map((name) => (
                        <option key={`north-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-lg font-black">確認起莊</h3>
              <p className="mt-1 text-sm text-white/60">
                開局會從東風圈開始，請設定第一位莊家座位。
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {SEATS.map((seatIndex) => {
                  const seatWind = getSeatWind(seatIndex);
                  const seatPlayer = seatAssignments.find(
                    (item) => item.seatIndex === seatIndex
                  )?.playerName;

                  return (
                    <button
                      key={seatIndex}
                      type="button"
                      onClick={() => setDealerSeatIndex(seatIndex)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        dealerSeatIndex === seatIndex
                          ? 'border-transparent bg-[#B6FF00] text-black'
                          : 'border-white/10 bg-black/40 text-white'
                      }`}
                    >
                      <div className="text-sm font-black">{seatWind}</div>
                      <div className="mt-1 text-xs opacity-80">
                        {seatPlayer || '尚未安排'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-300">
              目前規則：1 底 {baseScore}，1 台 {taiUnitAmount}｜起始局面：
              {' '}
              東風{getSeatWind(dealerSeatIndex)}
            </div>

            <button
              type="submit"
              disabled={createLoading}
              className="w-full rounded-full bg-[#B6FF00] py-4 text-lg font-black text-black transition active:scale-[0.99] disabled:opacity-60"
            >
              {createLoading ? '建立中...' : '建立房間'}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black">加入房間</h2>
          <p className="mt-2 text-sm text-white/60">
            輸入房號與你的名稱即可進入對局。
          </p>

          <form onSubmit={handleJoinRoom} className="mt-6 space-y-4">
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value)}
              placeholder="輸入房號"
            />

            <input
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
              value={joinUserName}
              onChange={(e) => setJoinUserName(e.target.value)}
              placeholder="你的名稱"
            />

            <button
              type="submit"
              disabled={joinLoading}
              className="w-full rounded-full border border-white/10 bg-white/5 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {joinLoading ? '加入中...' : '加入房間'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}