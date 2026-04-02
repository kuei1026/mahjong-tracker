export type RoomStatus = 'active' | 'finished';

export type RecordType = 'tsumo' | 'ron' | 'draw';

export type WaitType =
  | 'single_wait'
  | 'double_sided'
  | 'double_pair'
  | 'edge_wait'
  | 'triple_wait'
  | 'multi_wait';

export interface Room {
  id: string;
  room_code: string;
  owner_name: string;
  base_score: number;
  status: RoomStatus;
  tai_unit_amount: number;
  current_hand_no: number;
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