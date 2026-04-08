export type RoomStatus = 'active' | 'finished';

export type RecordType = 'tsumo' | 'ron' | 'draw';

export type WaitType =
  | 'single_wait'
  | 'double_sided'
  | 'double_pair'
  | 'edge_wait'
  | 'triple_wait'
  | 'multi_wait';

export type SeatWind = '東' | '南' | '西' | '北';
export type RoundWind = '東' | '南' | '西' | '北';

export interface Room {
  id: string;
  room_code: string;
  owner_name: string;
  owner_id: string | null;
  base_score: number;
  status: RoomStatus;
  tai_unit_amount: number;
  current_hand_no: number;

  round_wind?: number;
  dealer_seat_index?: number;
  dealer_streak?: number;

  created_at: string;
  updated_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  seat_index: number;
  player_name: string;
  is_owner: boolean;
  created_at: string;
}

export interface Hand {
  id: string;
  room_id: string;
  hand_no: number;
  status: 'open' | 'locked';
  created_at: string;
}

export interface RecordItem {
  id: string;
  hand_id: string;
  room_id: string;
  result_type: RecordType;
  winner_seat: number | null;
  loser_seat: number | null;
  tai_count: number;
  wait_type: WaitType | null;
  winning_tile: string | null;
  note: string | null;
  misdeal_seat: number | null;
  misdeal_note: string | null;
  created_by_name: string;

  round_wind_before?: number | null;
  dealer_seat_index_before?: number | null;
  dealer_streak_before?: number | null;

  round_wind_after?: number | null;
  dealer_seat_index_after?: number | null;
  dealer_streak_after?: number | null;

  created_at: string;
}

export interface ScoreChange {
  id: string;
  hand_id: string;
  room_id: string;
  seat_index: number;
  delta_score: number;
  created_at: string;
}

export interface ScoreCalculationInput {
  resultType: RecordType;
  winnerSeat: number | null;
  loserSeat: number | null;
  taiCount: number;
  baseScore: number;
  taiUnitAmount: number;
}

export interface ScoreDelta {
  seat_index: number;
  delta_score: number;
}

export interface GameState {
  roundWind: RoundWind;
  roundWindIndex: number;
  dealerSeatIndex: number;
  dealerSeatWind: SeatWind;
  dealerStreak: number;
  handIndex: number;
}

export interface AdvanceGameStateInput {
  currentRoundWind: number;
  currentDealerSeatIndex: number;
  currentDealerStreak: number;
  resultType: RecordType;
  winnerSeat: number | null;
}

export interface AdvanceGameStateResult {
  nextRoundWind: number;
  nextDealerSeatIndex: number;
  nextDealerStreak: number;
  isDealerContinued: boolean;
  isGameFinished: boolean;
}