# Mahjong Tracker

A mobile-first mahjong match tracking web app built with **Next.js**, **TypeScript**, and **Supabase**.

Mahjong Tracker is designed for real-time in-room score recording, hand-by-hand match tracking, and post-game match preservation. It focuses on a smooth mobile experience so players can quickly record results during live games without breaking the flow.

---

## Features

### Real-time room flow
- Create a room and start a live match
- Record each hand result in real time
- Track dealer rotation, round progression, and streaks
- Automatically update scores after each hand

### Match control
- Undo the last recorded hand
- Finish a room after the match ends
- Save a finished room as a historical match record

### Match analysis
- Score trend chart
- KPI board for player statistics
- Hand history timeline
- Per-hand score changes and match progression

### UX improvements
- Mobile-first UI
- Cleaner room controls with a top action menu
- Direct home navigation from inside a room
- Auto-dismiss toast feedback for success and error states
- Focused bottom CTA for faster in-game recording

### Data and security
- Supabase-backed persistence
- Row Level Security (RLS) aligned for room and match data
- Auth-based room ownership checks
- Saved matches persist with correct owner identity

---

## Tech Stack

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Framer Motion**
- **Recharts**
- **Supabase**

---

## Core Data Flow

This project currently uses two main data flows:

### 1. Live room match flow
Used for in-progress matches:

- `rooms`
- `room_players`
- `hands`
- `records`
- `score_changes`

This flow supports:
- room creation
- player setup
- hand-by-hand result recording
- undo last hand
- finishing a match

### 2. Saved historical match flow
Used for archived matches:

- `matches`
- `match_players`
- `match_records`
- `match_score_changes`

This flow supports:
- saving a finished room as a historical match
- future match lookup
- replay / analysis / sharing extensions

---

## Current Product Status

### Completed
- Mobile-first room UI
- Real-time hand recording flow
- Dealer / round / streak progression
- Undo last hand
- Finish room flow
- Save finished room as match history
- KPI board
- Score trend chart
- Hand history rendering
- Auth-based room ownership logic
- Supabase RLS alignment for core tables
- Cleaner room control UX (v4.0.0)

### Current focus
The project is now moving toward a stronger match presentation and analytics experience, including:
- better match summary presentation
- richer match insights
- cleaner historical hand storytelling
- stronger data visualization

---

## Screens / Main UI Areas

### Home page
- enter room / create room flow

### Room page
- live player positions and scores
- round / dealer / streak display
- top action menu for room management
- bottom primary action for recording the current hand
- score trend chart
- KPI board
- hand history

### Record modal
- choose hand result
- select winner / loser
- set tai count, wait type, winning tile
- optional extras such as notes and misdeal tracking

---

## Ownership and Access Model

Room and match permissions are based on authenticated user identity.

### Room ownership
- room ownership is checked using `owner_id`
- frontend room actions are gated by authenticated user identity
- room management is no longer based only on display name matching

### Match saving
- saved matches persist `owner_user_id`
- finished match data is protected through aligned RLS policies
- saved match access is designed to support future private/public match management

---

## Getting Started

### 1. Install dependencies

```bash
npm install

```

### 2. Run the development server
```bash
npm run dev
```

### 3. Open the app
http://localhost:3000
Environment Variables

Create a .env.local file in the project root:

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
## Demo
GitHub Repository: https://github.com/kuei1026/mahjong-tracker
Live Demo: Add your deployment URL here
## Project Structure
src/
  app/
    globals.css
    layout.tsx
    page.tsx
    room/
      [roomId]/
        page.tsx
  components/
    ActionPanel.tsx
    HandHistory.tsx
    KPIBoard.tsx
    ScoreTrendChart.tsx
    TilePicker.tsx
    UndoLastRecordButton.tsx
    WheelSelector.tsx
  lib/
    analytics.ts
    format.ts
    gameLogic.ts
    supabase.ts
    titles.ts
  types/
    game.ts
### Why This Project

Mahjong Tracker is built around a simple product idea:

Recording a live mahjong game should be fast, clear, and mobile-friendly.

Instead of forcing players through heavy forms or desktop-oriented layouts, this project focuses on:

fast hand result entry
clear match state tracking
visual score progression
lightweight but structured historical match storage
Roadmap
Next priorities
Better match summary cards
Highlight analysis for key turning points
More polished hand history presentation
Stronger visual storytelling for finished matches
Improved match analytics and player insights
Possible future extensions
Public/private saved match pages
Shareable historical match links
Match replay mode
Player title / style analysis
Ranking trend visualization
Advanced match dashboard
Release Notes
v4.0.0
Improved room UX with cleaner control hierarchy
Added home navigation from the room page
Moved room management actions into a top action menu
Added auto-dismiss toast feedback
Switched room ownership checks to auth-based identity
Restored reliable saved match flow with correct owner persistence
License

This project is currently for personal / portfolio use.
You can add a formal license later if needed.