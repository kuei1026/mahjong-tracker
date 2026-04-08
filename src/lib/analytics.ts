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

interface PlayerStatsWithAverage extends PlayerStats {
  avgTai: number;
}

export function calculateStats(
  records: RecordItem[],
  players: RoomPlayer[]
): PlayerStatsWithAverage[] {
  const statsMap = new Map<number, PlayerStats>();

  players.forEach((player) => {
    statsMap.set(player.seat_index, {
      playerName: player.player_name,
      seatIndex: player.seat_index,
      tsumoCount: 0,
      ronWinCount: 0,
      dealInCount: 0,
      totalTai: 0,
      winCount: 0,
    });
  });

  records.forEach((record) => {
    const winnerSeat = record.winner_seat;
    const loserSeat = record.loser_seat;
    const taiCount = typeof record.tai_count === 'number' ? record.tai_count : 0;

    if (record.result_type === 'tsumo') {
      if (winnerSeat === null || winnerSeat === undefined) return;

      const winnerStats = statsMap.get(winnerSeat);
      if (!winnerStats) return;

      winnerStats.tsumoCount += 1;
      winnerStats.winCount += 1;
      winnerStats.totalTai += taiCount;
      return;
    }

    if (record.result_type === 'ron') {
      if (winnerSeat !== null && winnerSeat !== undefined) {
        const winnerStats = statsMap.get(winnerSeat);
        if (winnerStats) {
          winnerStats.ronWinCount += 1;
          winnerStats.winCount += 1;
          winnerStats.totalTai += taiCount;
        }
      }

      if (loserSeat !== null && loserSeat !== undefined) {
        const loserStats = statsMap.get(loserSeat);
        if (loserStats) {
          loserStats.dealInCount += 1;
        }
      }
    }
  });

  return Array.from(statsMap.values()).map((stats) => ({
    ...stats,
    avgTai: stats.winCount > 0 ? stats.totalTai / stats.winCount : 0,
  }));
}