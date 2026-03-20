# Pong Minimal

Minimal Pong with two modes:

- `1v CPU` for local single-player.
- `Online 1v1` for live browser-to-browser-feeling play using Supabase Realtime channels.

It also includes 6 switchable themes:

- Midnight
- Paper
- Coral
- Mint
- Mono
- Arcade

## Local Run

1. Set these environment variables:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-or-publishable-key"
```

2. Start the app:

```bash
npm start
```

3. Open `http://localhost:3000`.

## Vercel Setup

Add these project environment variables in Vercel:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

The frontend reads them through [api/realtime-config.js](/home/grey/PongGame/api/realtime-config.js).

## Online Flow

1. Both players open the same deployed URL.
2. One player clicks `Create Room`.
3. Share the room code.
4. The second player clicks `Join` with that code.
5. The host simulates the match and broadcasts live state over Supabase Realtime.

## Controls

- Mouse or touch
- `W` / `S`
- `Up` / `Down`
- `Space` for the main on-screen action
