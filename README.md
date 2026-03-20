# Pong Minimal

Minimal Pong with two modes:

- `1v CPU` for local single-player.
- `Online 1v1` for remote play through a room code.

It also includes 6 switchable themes:

- Midnight
- Paper
- Coral
- Mint
- Mono
- Arcade

## Run It

1. Start the app with:

```bash
npm start
```

2. Open `http://localhost:3000`.
3. For online play, both players open the same app URL.
4. One player creates a room and shares the room code.
5. The second player joins with that code.

## Notes

- Online play works through the included Node server in [server.js](/home/grey/PongGame/server.js).
- To play with a friend from somewhere else, the server must be reachable by both players.
- That usually means deploying it somewhere public, using a tunnel, or port-forwarding your machine.

## Controls

- Mouse or touch
- `W` / `S`
- `Up` / `Down`
- `Space` for the main on-screen action
