export type RecordType = 'tsumo' | 'ron' | 'draw' | 'misdeal';

export interface ScoreCalculationInput {
  resultType: RecordType;
  winnerSeat: number | null;
  loserSeat: number | null;
  taiCount: number;
  taiUnitAmount: number;
  misdealPenalty: number;
}

export interface ScoreDelta {
  seat_index: number;
  delta_score: number;
}

export function calculateScoreChanges(
  input: ScoreCalculationInput
): ScoreDelta[] {
  const {
    resultType,
    winnerSeat,
    loserSeat,
    taiCount,
    taiUnitAmount,
    misdealPenalty,
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

    const unit = taiCount * taiUnitAmount;

    for (let seat = 0; seat < 4; seat += 1) {
      if (seat === winnerSeat) {
        deltas.push({
          seat_index: seat,
          delta_score: unit * 3,
        });
      } else {
        deltas.push({
          seat_index: seat,
          delta_score: -unit,
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

    const unit = taiCount * taiUnitAmount;

    for (let seat = 0; seat < 4; seat += 1) {
      if (seat === winnerSeat) {
        deltas.push({
          seat_index: seat,
          delta_score: unit,
        });
      } else if (seat === loserSeat) {
        deltas.push({
          seat_index: seat,
          delta_score: -unit,
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

  if (resultType === 'misdeal') {
    if (loserSeat === null) {
      throw new Error('loserSeat is required for misdeal.');
    }

    for (let seat = 0; seat < 4; seat += 1) {
      deltas.push({
        seat_index: seat,
        delta_score: seat === loserSeat ? -misdealPenalty : 0,
      });
    }

    return deltas;
  }

  throw new Error(`Unsupported resultType: ${resultType}`);
}