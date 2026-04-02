import type {
  AdvanceGameStateInput,
  AdvanceGameStateResult,
  GameState,
  RecordType,
  RoundWind,
  ScoreCalculationInput,
  ScoreDelta,
  SeatWind,
} from '@/types/game';

export type { RecordType } from '@/types/game';

export const SEAT_WINDS: SeatWind[] = ['東', '南', '西', '北'];
export const ROUND_WINDS: RoundWind[] = ['東', '南', '西', '北'];

export function getSeatWind(seatIndex: number): SeatWind {
  return SEAT_WINDS[((seatIndex % 4) + 4) % 4];
}

export function getRoundWind(roundWindIndex: number): RoundWind {
  return ROUND_WINDS[((roundWindIndex % 4) + 4) % 4];
}

export function getRoundLabel(roundWindIndex: number, dealerSeatIndex: number): string {
  return `${getRoundWind(roundWindIndex)}風${getSeatWind(dealerSeatIndex)}`;
}

export function buildGameState(params: {
  roundWind?: number | null;
  dealerSeatIndex?: number | null;
  dealerStreak?: number | null;
  handIndex?: number | null;
}): GameState {
  const roundWindIndex = params.roundWind ?? 0;
  const dealerSeatIndex = params.dealerSeatIndex ?? 0;
  const dealerStreak = params.dealerStreak ?? 0;
  const handIndex = params.handIndex ?? 0;

  return {
    roundWind: getRoundWind(roundWindIndex),
    roundWindIndex,
    dealerSeatIndex,
    dealerSeatWind: getSeatWind(dealerSeatIndex),
    dealerStreak,
    handIndex,
  };
}

export function calculateScoreChanges(
  input: ScoreCalculationInput
): ScoreDelta[] {
  const {
    resultType,
    winnerSeat,
    loserSeat,
    taiCount,
    baseScore,
    taiUnitAmount,
  } = input;

  const deltas: ScoreDelta[] = [];

  if (resultType === 'draw') {
    return [0, 1, 2, 3].map((seat) => ({
      seat_index: seat,
      delta_score: 0,
    }));
  }

  if (resultType === 'tsumo') {
    if (winnerSeat === null) {
      throw new Error('winnerSeat is required for tsumo.');
    }

    const perLoserPay = baseScore + taiCount * taiUnitAmount;

    for (let seat = 0; seat < 4; seat += 1) {
      if (seat === winnerSeat) {
        deltas.push({
          seat_index: seat,
          delta_score: perLoserPay * 3,
        });
      } else {
        deltas.push({
          seat_index: seat,
          delta_score: -perLoserPay,
        });
      }
    }

    return deltas;
  }

  if (resultType === 'ron') {
    if (winnerSeat === null || loserSeat === null) {
      throw new Error('winnerSeat and loserSeat are required for ron.');
    }

    if (winnerSeat === loserSeat) {
      throw new Error('winnerSeat and loserSeat cannot be the same.');
    }

    const totalPay = baseScore + taiCount * taiUnitAmount;

    for (let seat = 0; seat < 4; seat += 1) {
      if (seat === winnerSeat) {
        deltas.push({
          seat_index: seat,
          delta_score: totalPay,
        });
      } else if (seat === loserSeat) {
        deltas.push({
          seat_index: seat,
          delta_score: -totalPay,
        });
      } else {
        deltas.push({
          seat_index: seat,
          delta_score: 0,
        });
      }
    }

    return deltas;
  }

  throw new Error(`Unsupported resultType: ${resultType}`);
}

/**
 * 牌局推進規則
 *
 * 你目前 spec：
 * - 一將 = 東風東 -> 北風北
 * - 胡牌者若為莊家 => 連莊 +1，莊家不變
 * - 流局 => 莊家不變，連莊 +1
 * - 非莊家胡牌 => 莊家下莊，由下家接莊
 * - 若原莊家為北位且非莊家胡牌，則下一手進入下一風圈
 * - 若目前已是北風北，且發生「非莊家胡牌」需要再往下推，則整場結束
 */
export function advanceGameState(
  input: AdvanceGameStateInput
): AdvanceGameStateResult {
  const {
    currentRoundWind,
    currentDealerSeatIndex,
    currentDealerStreak,
    resultType,
    winnerSeat,
  } = input;

  const normalizedRoundWind = ((currentRoundWind % 4) + 4) % 4;
  const normalizedDealerSeat = ((currentDealerSeatIndex % 4) + 4) % 4;
  const normalizedDealerStreak = Math.max(0, currentDealerStreak);

  // 流局：莊家不變，連莊 +1
  if (resultType === 'draw') {
    return {
      nextRoundWind: normalizedRoundWind,
      nextDealerSeatIndex: normalizedDealerSeat,
      nextDealerStreak: normalizedDealerStreak + 1,
      isDealerContinued: true,
      isGameFinished: false,
    };
  }

  if (winnerSeat === null) {
    throw new Error('winnerSeat is required when resultType is tsumo or ron.');
  }

  const normalizedWinnerSeat = ((winnerSeat % 4) + 4) % 4;
  const isDealerWin = normalizedWinnerSeat === normalizedDealerSeat;

  // 莊家胡牌：莊家不變，連莊 +1
  if (isDealerWin) {
    return {
      nextRoundWind: normalizedRoundWind,
      nextDealerSeatIndex: normalizedDealerSeat,
      nextDealerStreak: normalizedDealerStreak + 1,
      isDealerContinued: true,
      isGameFinished: false,
    };
  }

  // 非莊家胡牌：換下家當莊，連莊歸零
  const nextDealerSeatIndex = (normalizedDealerSeat + 1) % 4;
  const shouldAdvanceRoundWind = normalizedDealerSeat === 3; // 北位下莊

  // 已經是北風北，再往下推就結束
  if (normalizedRoundWind === 3 && normalizedDealerSeat === 3) {
    return {
      nextRoundWind: normalizedRoundWind,
      nextDealerSeatIndex,
      nextDealerStreak: 0,
      isDealerContinued: false,
      isGameFinished: true,
    };
  }

  return {
    nextRoundWind: shouldAdvanceRoundWind
      ? normalizedRoundWind + 1
      : normalizedRoundWind,
    nextDealerSeatIndex,
    nextDealerStreak: 0,
    isDealerContinued: false,
    isGameFinished: false,
  };
}

export function getCurrentUserName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('mahjong_tracker_user_name')?.trim() ?? '';
}

export function buildScoreMap(scoreChanges: ScoreDelta[]): Map<number, number> {
  const scoreMap = new Map<number, number>();

  scoreChanges.forEach((change) => {
    scoreMap.set(
      change.seat_index,
      (scoreMap.get(change.seat_index) ?? 0) + change.delta_score
    );
  });

  return scoreMap;
}

export function getScoresAfter(
  existingScoreChanges: Array<{ seat_index: number; delta_score: number }>,
  currentHandScoreChanges: ScoreDelta[]
): Record<number, number> {
  const scoreMap = new Map<number, number>();

  existingScoreChanges.forEach((change) => {
    scoreMap.set(
      change.seat_index,
      (scoreMap.get(change.seat_index) ?? 0) + change.delta_score
    );
  });

  currentHandScoreChanges.forEach((change) => {
    scoreMap.set(
      change.seat_index,
      (scoreMap.get(change.seat_index) ?? 0) + change.delta_score
    );
  });

  return {
    0: scoreMap.get(0) ?? 0,
    1: scoreMap.get(1) ?? 0,
    2: scoreMap.get(2) ?? 0,
    3: scoreMap.get(3) ?? 0,
  };
}