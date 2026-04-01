import type { RecordItem, RoomPlayer } from '@/types/game';

interface PlayerStats {
  playerName: string;
  seatIndex: number;
  tsumoCount: number;
  ronWinCount: number;
  dealInCount: number;
  totalTai: number;
  winCount: number;
}

export function calculateStats(
  records: RecordItem[],
  players: RoomPlayer[]
) {
  const statsMap = new Map<number, PlayerStats>();

  players.forEach((p) => {
    statsMap.set(p.seat_index, {
      playerName: p.player_name,
      seatIndex: p.seat_index,
      tsumoCount: 0,
      ronWinCount: 0,
      dealInCount: 0,
      totalTai: 0,
      winCount: 0,
    });
  });

  records.forEach((r) => {
    if (r.result_type === 'tsumo' && r.winner_seat !== null) {
      const s = statsMap.get(r.winner_seat)!;
      s.tsumoCount++;
      s.winCount++;
      s.totalTai += r.tai_count;
    }

    if (r.result_type === 'ron') {
      if (r.winner_seat !== null) {
        const s = statsMap.get(r.winner_seat)!;
        s.ronWinCount++;
        s.winCount++;
        s.totalTai += r.tai_count;
      }

      if (r.loser_seat !== null) {
        const s = statsMap.get(r.loser_seat)!;
        s.dealInCount++;
      }
    }
  });

  return Array.from(statsMap.values()).map((s) => ({
    ...s,
    avgTai: s.winCount > 0 ? s.totalTai / s.winCount : 0,
  }));
}