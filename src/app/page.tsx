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
      setMessage('Please enter the owner name.');
      return;
    }

    if (playerNames.some((name) => !name)) {
      setMessage('Please enter all 4 player names.');
      return;
    }

    if (new Set(playerNames).size !== 4) {
      setMessage('Player names must be unique.');
      return;
    }

    if (!playerNames.includes(trimmedOwnerName)) {
      setMessage('Owner name must match one of the 4 player names.');
      return;
    }

    if (taiUnitAmount <= 0) {
      setMessage('Tai unit amount must be greater than 0.');
      return;
    }

    if (misdealPenalty < 0) {
      setMessage('Misdeal penalty cannot be negative.');
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
        throw new Error('Failed to create room after multiple attempts.');
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
      setMessage('Failed to create room. Please try again.');
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
      setMessage('Please enter a room code.');
      return;
    }

    if (!trimmedJoinUserName) {
      setMessage('Please enter your name.');
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
        setMessage('Room not found.');
        return;
      }

      if (roomData.status !== 'active') {
        setMessage('This room is not active.');
        return;
      }

      saveUserNameToLocalStorage(trimmedJoinUserName);
      router.push(`/room/${roomData.id}`);
    } catch (error) {
      console.error('Join room failed:', error);
      setMessage('Failed to join room. Please try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1B1B1B] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">
            Mahjong Tracker
          </p>
          <h1 className="text-4xl font-bold">Create or Join a Room</h1>
          <p className="max-w-2xl text-neutral-400">
            Start with the MVP flow first: create a room, add four players, and
            sync score updates in real time.
          </p>
        </div>

        {message ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">Create Room</h2>
              <p className="mt-2 text-sm text-neutral-400">
                Set up a new room with four players and basic scoring rules.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreateRoom}>
              <div className="space-y-2">
                <label className="text-sm text-neutral-300">Owner Name</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Enter owner name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">Player 1</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    placeholder="Player 1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">Player 2</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    placeholder="Player 2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">Player 3</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={player3}
                    onChange={(e) => setPlayer3(e.target.value)}
                    placeholder="Player 3"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">Player 4</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={player4}
                    onChange={(e) => setPlayer4(e.target.value)}
                    placeholder="Player 4"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">
                    Tai Unit Amount
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                    value={taiUnitAmount}
                    onChange={(e) => setTaiUnitAmount(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-neutral-300">
                    Misdeal Penalty
                  </label>
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
                className="w-full rounded-2xl bg-[#B6FF00] px-4 py-3 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createLoading ? 'Creating Room...' : 'Create Room'}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">Join Room</h2>
              <p className="mt-2 text-sm text-neutral-400">
                Enter a room code and your name to enter the room.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleJoinRoom}>
              <div className="space-y-2">
                <label className="text-sm text-neutral-300">Room Code</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 uppercase outline-none transition focus:border-lime-400"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-300">Your Name</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-lime-400"
                  value={joinUserName}
                  onChange={(e) => setJoinUserName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              <button
                type="submit"
                disabled={joinLoading}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joinLoading ? 'Joining Room...' : 'Join Room'}
              </button>
            </form>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">
              <p className="font-medium text-white">Current MVP Scope</p>
              <p className="mt-2">
                Build room, join room, owner records, and four-player synced
                score display first. Skip auth and advanced analytics for now.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}