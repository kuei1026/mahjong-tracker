## users

```
id (uuid)
display_name
avatar_url
created_at

```

---

## rooms

```
id
owner_user_id
status (active/ finished)
tai_unit_amount
misdeal_penalty
created_at

```

---

## room_players

```
id
room_id
user_id (nullable)
temp_name
seat_index (0~3)

```

---

## hands

```
id
room_id
hand_no
status (open/ locked)
created_at

```

---

## records（每手結果）

```
id
hand_id
winner_id
loser_id (nullable)
result_type (tsumo/ ron/ draw/ misdeal)
tai_count
created_by
created_at

```

---

## score_changes

```
id
hand_id
player_id
delta_score

```