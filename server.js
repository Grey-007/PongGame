const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;

const GAME = {
    width: 800,
    height: 400,
    winningScore: 5,
    serveDelay: 900,
    paddle: {
        width: 12,
        height: 96,
        speed: 460
    },
    ball: {
        radius: 8,
        baseSpeed: 380,
        maxSpeed: 780,
        speedStep: 28
    }
};

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
};

const rooms = new Map();

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function centerPaddleY() {
    return GAME.height / 2 - GAME.paddle.height / 2;
}

function makeMatch(message) {
    return {
        status: 'waiting',
        message,
        winner: null,
        scores: {
            left: 0,
            right: 0
        },
        paddles: {
            left: { y: centerPaddleY(), targetY: centerPaddleY() },
            right: { y: centerPaddleY(), targetY: centerPaddleY() }
        },
        ball: {
            x: GAME.width / 2,
            y: GAME.height / 2,
            radius: GAME.ball.radius,
            vx: 0,
            vy: 0
        },
        serveDirection: 1,
        serveReadyAt: 0
    };
}

function centerBall(match, direction) {
    match.ball.x = GAME.width / 2;
    match.ball.y = GAME.height / 2;
    match.ball.vx = 0;
    match.ball.vy = 0;
    match.serveDirection = direction;
}

function resetPaddles(match) {
    match.paddles.left.y = centerPaddleY();
    match.paddles.right.y = centerPaddleY();
    match.paddles.left.targetY = centerPaddleY();
    match.paddles.right.targetY = centerPaddleY();
}

function scheduleServe(match, direction, message, now) {
    centerBall(match, direction);
    match.status = 'serving';
    match.message = message;
    match.winner = null;
    match.serveReadyAt = now + GAME.serveDelay;
}

function launchBall(match) {
    const angle = (Math.random() - 0.5) * (Math.PI / 2.6);
    const verticalSign = Math.random() > 0.5 ? 1 : -1;

    match.ball.vx = Math.cos(angle) * GAME.ball.baseSpeed * match.serveDirection;
    match.ball.vy = Math.sin(angle) * GAME.ball.baseSpeed;

    if (Math.abs(match.ball.vy) < 130) {
        match.ball.vy = 130 * verticalSign;
    }

    match.status = 'playing';
    match.message = 'Rally live. First to 5 wins.';
}

function bounceBall(match, side) {
    const paddle = match.paddles[side];
    const impact = clamp(
        (match.ball.y - (paddle.y + GAME.paddle.height / 2)) / (GAME.paddle.height / 2),
        -1,
        1
    );
    const angle = impact * (Math.PI / 3);
    const speed = clamp(
        Math.hypot(match.ball.vx, match.ball.vy) + GAME.ball.speedStep,
        GAME.ball.baseSpeed,
        GAME.ball.maxSpeed
    );
    const direction = side === 'left' ? 1 : -1;

    match.ball.vx = Math.cos(angle) * speed * direction;
    match.ball.vy = Math.sin(angle) * speed;
}

function startRoomMatch(room) {
    room.match.scores.left = 0;
    room.match.scores.right = 0;
    resetPaddles(room.match);
    scheduleServe(room.match, Math.random() > 0.5 ? 1 : -1, 'Match starting.', Date.now());
    room.dirty = true;
}

function setWaiting(room, message) {
    room.match.status = 'waiting';
    room.match.message = message;
    room.match.winner = null;
    room.match.scores.left = 0;
    room.match.scores.right = 0;
    resetPaddles(room.match);
    centerBall(room.match, 1);
    room.dirty = true;
}

function scorePoint(room, side, now) {
    room.match.scores[side] += 1;

    if (room.match.scores[side] >= GAME.winningScore) {
        room.match.status = 'gameover';
        room.match.winner = side;
        room.match.message = side === 'left' ? 'Left player won the match.' : 'Right player won the match.';
        centerBall(room.match, side === 'left' ? -1 : 1);
        room.dirty = true;
        return;
    }

    const message = side === 'left' ? 'Left player scored.' : 'Right player scored.';
    scheduleServe(room.match, side === 'left' ? 1 : -1, `${message} Next serve in a moment.`, now);
    room.dirty = true;
}

function makeRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    do {
        code = '';

        for (let index = 0; index < 6; index += 1) {
            code += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
    } while (rooms.has(code));

    return code;
}

function createRoom() {
    const code = makeRoomCode();
    const room = {
        code,
        players: {
            left: null,
            right: null
        },
        clients: new Set(),
        match: makeMatch('Waiting for another player.'),
        lastTickAt: Date.now(),
        lastBroadcastAt: 0,
        dirty: true
    };

    rooms.set(code, room);
    return room;
}

function createPlayer(side) {
    return {
        id: randomUUID(),
        side
    };
}

function serializeRoom(room) {
    return {
        roomCode: room.code,
        status: room.match.status,
        message: room.match.message,
        winner: room.match.winner,
        scores: room.match.scores,
        paddles: {
            left: { y: Math.round(room.match.paddles.left.y * 100) / 100 },
            right: { y: Math.round(room.match.paddles.right.y * 100) / 100 }
        },
        ball: {
            x: Math.round(room.match.ball.x * 100) / 100,
            y: Math.round(room.match.ball.y * 100) / 100,
            radius: room.match.ball.radius
        },
        players: {
            left: { connected: Boolean(room.players.left) },
            right: { connected: Boolean(room.players.right) }
        }
    };
}

function broadcastRoom(room) {
    if (room.clients.size === 0) {
        return;
    }

    const payload = `data: ${JSON.stringify(serializeRoom(room))}\n\n`;

    for (const client of room.clients) {
        client.res.write(payload);
    }
}

function findPlayer(room, playerId) {
    if (room.players.left && room.players.left.id === playerId) {
        return room.players.left;
    }

    if (room.players.right && room.players.right.id === playerId) {
        return room.players.right;
    }

    return null;
}

function updateRoom(room, now) {
    const deltaSeconds = Math.min((now - room.lastTickAt) / 1000, 0.02);
    room.lastTickAt = now;

    if (!room.players.left || !room.players.right) {
        return;
    }

    for (const side of ['left', 'right']) {
        const paddle = room.match.paddles[side];
        const delta = paddle.targetY - paddle.y;
        const step = GAME.paddle.speed * deltaSeconds;

        if (Math.abs(delta) <= step) {
            paddle.y = paddle.targetY;
        } else {
            paddle.y += Math.sign(delta) * step;
        }

        paddle.y = clamp(paddle.y, 0, GAME.height - GAME.paddle.height);
    }

    if (room.match.status === 'serving' && now >= room.match.serveReadyAt) {
        launchBall(room.match);
        room.dirty = true;
    }

    if (room.match.status !== 'playing') {
        return;
    }

    room.match.ball.x += room.match.ball.vx * deltaSeconds;
    room.match.ball.y += room.match.ball.vy * deltaSeconds;

    if (room.match.ball.y - room.match.ball.radius <= 0) {
        room.match.ball.y = room.match.ball.radius;
        room.match.ball.vy = Math.abs(room.match.ball.vy);
        room.dirty = true;
    } else if (room.match.ball.y + room.match.ball.radius >= GAME.height) {
        room.match.ball.y = GAME.height - room.match.ball.radius;
        room.match.ball.vy = -Math.abs(room.match.ball.vy);
        room.dirty = true;
    }

    const leftX = 24;
    const hitLeft =
        room.match.ball.vx < 0 &&
        room.match.ball.x - room.match.ball.radius <= leftX &&
        room.match.ball.y + room.match.ball.radius >= room.match.paddles.left.y &&
        room.match.ball.y - room.match.ball.radius <= room.match.paddles.left.y + GAME.paddle.height;

    if (hitLeft) {
        room.match.ball.x = leftX + room.match.ball.radius;
        bounceBall(room.match, 'left');
        room.dirty = true;
    }

    const rightX = GAME.width - 24;
    const hitRight =
        room.match.ball.vx > 0 &&
        room.match.ball.x + room.match.ball.radius >= rightX &&
        room.match.ball.y + room.match.ball.radius >= room.match.paddles.right.y &&
        room.match.ball.y - room.match.ball.radius <= room.match.paddles.right.y + GAME.paddle.height;

    if (hitRight) {
        room.match.ball.x = rightX - room.match.ball.radius;
        bounceBall(room.match, 'right');
        room.dirty = true;
    }

    if (room.match.ball.x + room.match.ball.radius < 0) {
        scorePoint(room, 'right', now);
    } else if (room.match.ball.x - room.match.ball.radius > GAME.width) {
        scorePoint(room, 'left', now);
    }
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';

        request.on('data', (chunk) => {
            body += chunk;

            if (body.length > 1_000_000) {
                reject(new Error('Payload too large.'));
                request.destroy();
            }
        });

        request.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error('Invalid JSON body.'));
            }
        });

        request.on('error', reject);
    });
}

function json(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}

function text(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'text/plain; charset=utf-8'
    });
    response.end(payload);
}

function serveFile(response, pathname) {
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(__dirname, safePath);

    if (!filePath.startsWith(__dirname)) {
        text(response, 403, 'Forbidden');
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            text(response, 404, 'Not found');
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(content);
    });
}

async function handleApi(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/api/health') {
        json(response, 200, { ok: true });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/rooms/create') {
        const room = createRoom();
        const player = createPlayer('left');
        room.players.left = player;
        room.dirty = true;
        json(response, 200, {
            roomCode: room.code,
            playerId: player.id,
            side: player.side
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/rooms/join') {
        const body = await readBody(request);
        const code = String(body.code || '').trim().toUpperCase();
        const room = rooms.get(code);

        if (!room) {
            json(response, 404, { error: 'Room not found.' });
            return true;
        }

        if (room.players.left && room.players.right) {
            json(response, 409, { error: 'Room is already full.' });
            return true;
        }

        const side = room.players.left ? 'right' : 'left';
        const player = createPlayer(side);
        room.players[side] = player;
        startRoomMatch(room);
        broadcastRoom(room);

        json(response, 200, {
            roomCode: room.code,
            playerId: player.id,
            side: player.side
        });
        return true;
    }

    const eventsMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/events$/);

    if (request.method === 'GET' && eventsMatch) {
        const room = rooms.get(eventsMatch[1]);
        const playerId = url.searchParams.get('playerId');

        if (!room) {
            json(response, 404, { error: 'Room not found.' });
            return true;
        }

        if (!findPlayer(room, playerId)) {
            json(response, 403, { error: 'Unknown player.' });
            return true;
        }

        response.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store',
            Connection: 'keep-alive'
        });

        response.write(`data: ${JSON.stringify(serializeRoom(room))}\n\n`);

        const client = {
            id: randomUUID(),
            playerId,
            res: response
        };

        room.clients.add(client);

        request.on('close', () => {
            room.clients.delete(client);
        });

        return true;
    }

    const roomActionMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/(input|action|leave)$/);

    if (request.method === 'POST' && roomActionMatch) {
        const code = roomActionMatch[1];
        const action = roomActionMatch[2];
        const room = rooms.get(code);

        if (!room) {
            json(response, 404, { error: 'Room not found.' });
            return true;
        }

        const body = await readBody(request);
        const player = findPlayer(room, body.playerId);

        if (!player) {
            json(response, 403, { error: 'Unknown player.' });
            return true;
        }

        if (action === 'input') {
            const paddle = room.match.paddles[player.side];
            paddle.targetY = clamp(Number(body.paddleY) || 0, 0, GAME.height - GAME.paddle.height);
            json(response, 200, { ok: true });
            return true;
        }

        if (action === 'action') {
            if (body.action === 'restart' && room.players.left && room.players.right) {
                startRoomMatch(room);
                broadcastRoom(room);
            }

            json(response, 200, { ok: true });
            return true;
        }

        if (action === 'leave') {
            room.players[player.side] = null;

            for (const client of [...room.clients]) {
                if (client.playerId === player.id) {
                    client.res.end();
                    room.clients.delete(client);
                }
            }

            if (!room.players.left && !room.players.right) {
                rooms.delete(room.code);
            } else {
                setWaiting(room, 'A player left the room. Waiting for another player.');
                broadcastRoom(room);
            }

            json(response, 200, { ok: true });
            return true;
        }
    }

    return false;
}

const server = http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const handled = await handleApi(request, response, url);

        if (handled) {
            return;
        }

        if (request.method !== 'GET') {
            text(response, 405, 'Method not allowed');
            return;
        }

        serveFile(response, url.pathname);
    } catch (error) {
        json(response, 500, {
            error: error.message || 'Server error.'
        });
    }
});

setInterval(() => {
    const now = Date.now();

    for (const room of rooms.values()) {
        updateRoom(room, now);

        if (room.dirty || now - room.lastBroadcastAt >= 50) {
            broadcastRoom(room);
            room.lastBroadcastAt = now;
            room.dirty = false;
        }
    }
}, 1000 / 60);

server.listen(PORT, HOST, () => {
    console.log(`Pong server running at http://localhost:${PORT}`);
});
