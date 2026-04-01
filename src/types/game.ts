export type RoomStatus = 'active' | 'finished';

export type RecordType = 'tsumo' | 'ron' | 'draw' | 'misdeal';

export interface Room {
  id: string;
  room_code: string;
  owner_name: string;
  status: RoomStatus;
  tai_unit_amount: number;
  misdeal_penalty: number;
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
  note: string | null;
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