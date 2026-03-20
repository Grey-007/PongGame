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
    cpu: {
        speed: 390,
        deadZone: 16
    },
    ball: {
        radius: 8,
        baseSpeed: 380,
        maxSpeed: 780,
        speedStep: 28
    }
};

const THEMES = [
    { id: 'midnight', label: 'Midnight', swatch: '#7dd3fc' },
    { id: 'paper', label: 'Paper', swatch: '#2563eb' },
    { id: 'coral', label: 'Coral', swatch: '#f97316' },
    { id: 'mint', label: 'Mint', swatch: '#34d399' },
    { id: 'mono', label: 'Mono', swatch: '#fafafa' },
    { id: 'arcade', label: 'Arcade', swatch: '#f472b6' }
];

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const themePicker = document.getElementById('themePicker');
const cpuModeButton = document.getElementById('cpuModeButton');
const onlineModeButton = document.getElementById('onlineModeButton');
const cpuPanel = document.getElementById('cpuPanel');
const onlinePanel = document.getElementById('onlinePanel');
const startCpuButton = document.getElementById('startCpuButton');
const createRoomButton = document.getElementById('createRoomButton');
const joinRoomButton = document.getElementById('joinRoomButton');
const copyCodeButton = document.getElementById('copyCodeButton');
const leaveRoomButton = document.getElementById('leaveRoomButton');
const roomCodeInput = document.getElementById('roomCodeInput');
const roomCodeBadge = document.getElementById('roomCodeBadge');
const roomRoleBadge = document.getElementById('roomRoleBadge');
const shareHint = document.getElementById('shareHint');
const leftScoreLabel = document.getElementById('leftScoreLabel');
const rightScoreLabel = document.getElementById('rightScoreLabel');
const leftScoreValue = document.getElementById('leftScoreValue');
const rightScoreValue = document.getElementById('rightScoreValue');
const gameStatus = document.getElementById('gameStatus');
const controlsNote = document.getElementById('controlsNote');
const overlay = document.getElementById('gameOverlay');
const overlayEyebrow = document.getElementById('overlayEyebrow');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const overlayButton = document.getElementById('overlayButton');

const keys = {};
const centerPaddleY = GAME.height / 2 - GAME.paddle.height / 2;

const app = {
    mode: 'cpu',
    theme: localStorage.getItem('pong-theme') || THEMES[0].id,
    overlayAction: 'start-cpu',
    lastFrameTime: 0,
    palette: {},
    local: createLocalMatch('menu', 'Start a local match or switch to online 1v1.'),
    online: createOnlineState()
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function makeBall() {
    return {
        x: GAME.width / 2,
        y: GAME.height / 2,
        radius: GAME.ball.radius,
        vx: 0,
        vy: 0
    };
}

function makePaddles() {
    return {
        left: { y: centerPaddleY },
        right: { y: centerPaddleY }
    };
}

function createLocalMatch(status, message) {
    return {
        status,
        message,
        winner: null,
        scores: { left: 0, right: 0 },
        paddles: makePaddles(),
        ball: makeBall(),
        serveDirection: 1,
        serveReadyAt: 0
    };
}

function createOnlineState() {
    return {
        connected: false,
        busy: false,
        roomCode: '',
        playerId: '',
        side: null,
        eventSource: null,
        snapshot: null,
        message: 'Create a room or join one with a code.',
        inputY: centerPaddleY,
        lastSentY: null,
        lastSentAt: 0,
        sending: false
    };
}

function createOnlinePlaceholder(message) {
    return {
        status: 'idle',
        message,
        winner: null,
        scores: { left: 0, right: 0 },
        paddles: makePaddles(),
        ball: makeBall(),
        players: {
            left: { connected: false },
            right: { connected: false }
        }
    };
}

function centerBall(state, direction) {
    state.ball.x = GAME.width / 2;
    state.ball.y = GAME.height / 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.serveDirection = direction;
}

function resetPaddles(state) {
    state.paddles.left.y = centerPaddleY;
    state.paddles.right.y = centerPaddleY;
}

function scheduleServe(state, direction, message, now) {
    centerBall(state, direction);
    state.status = 'serving';
    state.message = message;
    state.serveReadyAt = now + GAME.serveDelay;
}

function launchBall(state) {
    const angle = (Math.random() - 0.5) * (Math.PI / 2.6);
    const verticalSign = Math.random() > 0.5 ? 1 : -1;

    state.ball.vx = Math.cos(angle) * GAME.ball.baseSpeed * state.serveDirection;
    state.ball.vy = Math.sin(angle) * GAME.ball.baseSpeed;

    if (Math.abs(state.ball.vy) < 130) {
        state.ball.vy = 130 * verticalSign;
    }

    state.status = 'playing';
    state.message = 'Rally live. First to 5 wins.';
}

function bounceBall(state, side) {
    const paddle = state.paddles[side];
    const impact = clamp(
        (state.ball.y - (paddle.y + GAME.paddle.height / 2)) / (GAME.paddle.height / 2),
        -1,
        1
    );
    const angle = impact * (Math.PI / 3);
    const speed = clamp(
        Math.hypot(state.ball.vx, state.ball.vy) + GAME.ball.speedStep,
        GAME.ball.baseSpeed,
        GAME.ball.maxSpeed
    );
    const direction = side === 'left' ? 1 : -1;

    state.ball.vx = Math.cos(angle) * speed * direction;
    state.ball.vy = Math.sin(angle) * speed;
}

function finishLocalMatch(winner) {
    app.local.status = 'gameover';
    app.local.winner = winner;
    centerBall(app.local, winner === 'left' ? -1 : 1);

    if (winner === 'left') {
        app.local.message = 'You won the local match.';
        setOverlay({
            eyebrow: '1v CPU',
            title: 'You Win',
            message: 'Start another local match whenever you want.',
            action: 'restart-cpu',
            label: 'Play Again'
        });
        return;
    }

    app.local.message = 'CPU won the local match.';
    setOverlay({
        eyebrow: '1v CPU',
        title: 'CPU Wins',
        message: 'The computer reached five first. Run it back.',
        action: 'restart-cpu',
        label: 'Play Again'
    });
}

function scoreLocal(side, now) {
    app.local.scores[side] += 1;

    if (app.local.scores[side] >= GAME.winningScore) {
        finishLocalMatch(side);
        return;
    }

    const direction = side === 'left' ? 1 : -1;
    app.local.message = side === 'left' ? 'You scored.' : 'CPU scored.';
    scheduleServe(app.local, direction, `${app.local.message} Next serve in a moment.`, now);
}

function startLocalMatch() {
    app.local = createLocalMatch('serving', 'Local match starting.');
    resetPaddles(app.local);
    scheduleServe(app.local, Math.random() > 0.5 ? 1 : -1, 'Local match starting.', performance.now());
    hideOverlay();
    syncUi();
}

function moveLocalPlayer(deltaSeconds) {
    let direction = 0;

    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        direction -= 1;
    }

    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        direction += 1;
    }

    app.local.paddles.left.y += direction * GAME.paddle.speed * deltaSeconds;
    app.local.paddles.left.y = clamp(app.local.paddles.left.y, 0, GAME.height - GAME.paddle.height);
}

function moveCpu(deltaSeconds) {
    let targetY = GAME.height / 2;

    if (app.local.status === 'playing' && app.local.ball.vx > 0) {
        targetY = app.local.ball.y + app.local.ball.vy * 0.08;
    } else if (app.local.status === 'playing') {
        targetY = GAME.height / 2 + (app.local.ball.y - GAME.height / 2) * 0.25;
    }

    const cpuCenter = app.local.paddles.right.y + GAME.paddle.height / 2;
    const delta = targetY - cpuCenter;

    if (Math.abs(delta) > GAME.cpu.deadZone) {
        app.local.paddles.right.y += Math.sign(delta) * GAME.cpu.speed * deltaSeconds;
    }

    app.local.paddles.right.y = clamp(app.local.paddles.right.y, 0, GAME.height - GAME.paddle.height);
}

function updateLocalBall(deltaSeconds, now) {
    app.local.ball.x += app.local.ball.vx * deltaSeconds;
    app.local.ball.y += app.local.ball.vy * deltaSeconds;

    if (app.local.ball.y - app.local.ball.radius <= 0) {
        app.local.ball.y = app.local.ball.radius;
        app.local.ball.vy = Math.abs(app.local.ball.vy);
    } else if (app.local.ball.y + app.local.ball.radius >= GAME.height) {
        app.local.ball.y = GAME.height - app.local.ball.radius;
        app.local.ball.vy = -Math.abs(app.local.ball.vy);
    }

    const hitsLeft =
        app.local.ball.vx < 0 &&
        app.local.ball.x - app.local.ball.radius <= 24 &&
        app.local.ball.y + app.local.ball.radius >= app.local.paddles.left.y &&
        app.local.ball.y - app.local.ball.radius <= app.local.paddles.left.y + GAME.paddle.height;

    if (hitsLeft) {
        app.local.ball.x = 24 + app.local.ball.radius;
        bounceBall(app.local, 'left');
    }

    const rightX = GAME.width - 24;
    const hitsRight =
        app.local.ball.vx > 0 &&
        app.local.ball.x + app.local.ball.radius >= rightX &&
        app.local.ball.y + app.local.ball.radius >= app.local.paddles.right.y &&
        app.local.ball.y - app.local.ball.radius <= app.local.paddles.right.y + GAME.paddle.height;

    if (hitsRight) {
        app.local.ball.x = rightX - app.local.ball.radius;
        bounceBall(app.local, 'right');
    }

    if (app.local.ball.x + app.local.ball.radius < 0) {
        scoreLocal('right', now);
    } else if (app.local.ball.x - app.local.ball.radius > GAME.width) {
        scoreLocal('left', now);
    }
}

function updateLocalMatch(deltaSeconds, now) {
    if (app.local.status === 'menu' || app.local.status === 'gameover') {
        return;
    }

    moveLocalPlayer(deltaSeconds);
    moveCpu(deltaSeconds);

    if (app.local.status === 'serving' && now >= app.local.serveReadyAt) {
        launchBall(app.local);
    }

    if (app.local.status === 'playing') {
        updateLocalBall(deltaSeconds, now);
    }
}

function getCanvasY(clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaledY = ((clientY - rect.top) / rect.height) * GAME.height;
    return clamp(scaledY - GAME.paddle.height / 2, 0, GAME.height - GAME.paddle.height);
}

function applyPointerControl(clientY) {
    const nextY = getCanvasY(clientY);

    if (app.mode === 'cpu') {
        app.local.paddles.left.y = nextY;
        return;
    }

    if (app.mode === 'online' && app.online.connected) {
        app.online.inputY = nextY;
        sendOnlineInput(true);
    }
}

function updateOnlineInput(deltaSeconds, now) {
    if (!app.online.connected) {
        return;
    }

    let direction = 0;

    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        direction -= 1;
    }

    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        direction += 1;
    }

    if (direction !== 0) {
        app.online.inputY += direction * GAME.paddle.speed * deltaSeconds;
        app.online.inputY = clamp(app.online.inputY, 0, GAME.height - GAME.paddle.height);
    }

    const moved = app.online.lastSentY === null || Math.abs(app.online.inputY - app.online.lastSentY) > 1;
    const heartbeat = now - app.online.lastSentAt > 1000;

    if (moved || heartbeat) {
        sendOnlineInput();
    }
}

async function sendOnlineInput(force) {
    if (!app.online.connected || app.online.sending || (!force && app.online.playerId === '')) {
        return;
    }

    app.online.sending = true;
    const payloadY = Math.round(app.online.inputY * 100) / 100;

    try {
        const response = await fetch(`/api/rooms/${app.online.roomCode}/input`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                playerId: app.online.playerId,
                paddleY: payloadY
            })
        });

        if (!response.ok) {
            throw new Error('Input sync failed.');
        }

        app.online.lastSentY = payloadY;
        app.online.lastSentAt = performance.now();
    } catch (error) {
        app.online.message = 'Connection problem while sending paddle movement.';
        syncUi();
    } finally {
        app.online.sending = false;
    }
}

function getRenderableState() {
    if (app.mode === 'online') {
        return app.online.snapshot || createOnlinePlaceholder(app.online.message);
    }

    return app.local;
}

function refreshPalette() {
    const styles = getComputedStyle(document.body);
    app.palette = {
        court: styles.getPropertyValue('--court').trim(),
        courtLine: styles.getPropertyValue('--court-line').trim(),
        courtEdge: styles.getPropertyValue('--court-edge').trim(),
        left: styles.getPropertyValue('--left-accent').trim(),
        right: styles.getPropertyValue('--right-accent').trim(),
        ball: styles.getPropertyValue('--ball-accent').trim()
    };
}

function drawCourt() {
    ctx.fillStyle = app.palette.court;
    ctx.fillRect(0, 0, GAME.width, GAME.height);

    ctx.fillStyle = app.palette.courtEdge;
    ctx.fillRect(0, 0, GAME.width, 12);
    ctx.fillRect(0, GAME.height - 12, GAME.width, 12);

    ctx.strokeStyle = app.palette.courtLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(GAME.width / 2, 18);
    ctx.lineTo(GAME.width / 2, GAME.height - 18);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(GAME.width / 2, GAME.height / 2, 52, 0, Math.PI * 2);
    ctx.strokeStyle = app.palette.courtLine;
    ctx.stroke();
}

function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function render() {
    const state = getRenderableState();

    drawCourt();
    drawRect(24 - GAME.paddle.width, state.paddles.left.y, GAME.paddle.width, GAME.paddle.height, app.palette.left);
    drawRect(GAME.width - 24, state.paddles.right.y, GAME.paddle.width, GAME.paddle.height, app.palette.right);
    drawCircle(state.ball.x, state.ball.y, state.ball.radius, app.palette.ball);
}

function setOverlay(config) {
    overlay.classList.remove('is-hidden');
    overlayEyebrow.textContent = config.eyebrow;
    overlayTitle.textContent = config.title;
    overlayMessage.textContent = config.message;

    if (config.label) {
        overlayButton.textContent = config.label;
        overlayButton.disabled = false;
        overlayButton.classList.remove('is-hidden');
    } else {
        overlayButton.classList.add('is-hidden');
        overlayButton.disabled = true;
    }

    app.overlayAction = config.action || 'none';
}

function hideOverlay() {
    overlay.classList.add('is-hidden');
    app.overlayAction = 'none';
}

function setTheme(themeId) {
    app.theme = THEMES.some((theme) => theme.id === themeId) ? themeId : THEMES[0].id;
    document.body.dataset.theme = app.theme;
    localStorage.setItem('pong-theme', app.theme);
    document.querySelectorAll('.theme-chip').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.theme === app.theme);
    });
    refreshPalette();
    render();
}

function setMode(mode) {
    app.mode = mode;
    cpuModeButton.classList.toggle('is-active', mode === 'cpu');
    onlineModeButton.classList.toggle('is-active', mode === 'online');
    cpuPanel.classList.toggle('is-hidden', mode !== 'cpu');
    onlinePanel.classList.toggle('is-hidden', mode !== 'online');

    if (mode === 'cpu') {
        controlsNote.textContent = 'Use mouse, touch, W/S, or Up/Down to move your paddle.';

        if (app.local.status === 'menu') {
            setOverlay({
                eyebrow: '1v CPU',
                title: 'Start a Match',
                message: 'Play locally against the computer.',
                action: 'start-cpu',
                label: 'Start Local Match'
            });
        } else if (app.local.status === 'gameover') {
            setOverlay({
                eyebrow: '1v CPU',
                title: app.local.winner === 'left' ? 'You Win' : 'CPU Wins',
                message: app.local.winner === 'left'
                    ? 'Start another local match whenever you want.'
                    : 'The computer reached five first. Run it back.',
                action: 'restart-cpu',
                label: 'Play Again'
            });
        } else {
            hideOverlay();
        }
    } else {
        const sideText = app.online.side ? `You control the ${app.online.side} paddle.` : 'Create or join a room to start.';
        controlsNote.textContent = `${sideText} Share this page URL and the room code with your friend.`;
        syncOnlineOverlay();
    }

    syncUi();
}

function syncOnlineOverlay() {
    const snapshot = app.online.snapshot;

    if (!app.online.connected) {
        setOverlay({
            eyebrow: 'Online 1v1',
            title: 'Create or Join a Room',
            message: 'Both players open the same app, then one creates a room and shares the code.',
            action: 'create-room',
            label: 'Create Room'
        });
        return;
    }

    if (!snapshot) {
        setOverlay({
            eyebrow: `Room ${app.online.roomCode}`,
            title: 'Connecting',
            message: 'Setting up the room stream.',
            action: 'copy-room-code',
            label: 'Copy Code'
        });
        return;
    }

    if (snapshot.status === 'waiting') {
        setOverlay({
            eyebrow: `Room ${app.online.roomCode}`,
            title: 'Waiting for Friend',
            message: 'Share the room code and this page URL so your friend can join.',
            action: 'copy-room-code',
            label: 'Copy Code'
        });
        return;
    }

    if (snapshot.status === 'gameover') {
        const title = snapshot.winner === app.online.side ? 'You Win' : 'Friend Wins';
        setOverlay({
            eyebrow: `Room ${app.online.roomCode}`,
            title,
            message: 'Press rematch to start another first-to-five round.',
            action: 'restart-online',
            label: 'Rematch'
        });
        return;
    }

    hideOverlay();
}

function syncScoreLabels() {
    if (app.mode === 'cpu') {
        leftScoreLabel.textContent = 'YOU';
        rightScoreLabel.textContent = 'CPU';
        return;
    }

    if (app.online.side === 'right') {
        leftScoreLabel.textContent = 'FRIEND';
        rightScoreLabel.textContent = 'YOU';
        return;
    }

    if (app.online.side === 'left') {
        leftScoreLabel.textContent = 'YOU';
        rightScoreLabel.textContent = 'FRIEND';
        return;
    }

    leftScoreLabel.textContent = 'HOST';
    rightScoreLabel.textContent = 'GUEST';
}

function syncUi() {
    const state = getRenderableState();

    syncScoreLabels();
    leftScoreValue.textContent = state.scores.left;
    rightScoreValue.textContent = state.scores.right;
    gameStatus.textContent = state.message || (app.mode === 'cpu' ? app.local.message : app.online.message);

    roomCodeBadge.textContent = app.online.connected ? `Room: ${app.online.roomCode}` : 'Room: none';
    roomRoleBadge.textContent = app.online.connected
        ? `Role: ${app.online.side}`
        : 'Role: offline';
    shareHint.textContent = app.mode === 'online'
        ? 'Share this page URL and the room code with your friend.'
        : 'Local mode works by itself. Online mode needs the Node server running.';

    copyCodeButton.disabled = !app.online.connected;
    leaveRoomButton.disabled = !app.online.connected;
    createRoomButton.disabled = app.online.busy || app.online.connected;
    joinRoomButton.disabled = app.online.busy || app.online.connected;
    roomCodeInput.disabled = app.online.busy || app.online.connected;
}

function populateThemes() {
    themePicker.innerHTML = THEMES.map((theme) => (
        `<button class="theme-chip" data-theme="${theme.id}" type="button">
            <span class="theme-chip-swatch" style="--swatch:${theme.swatch}"></span>
            <span>${theme.label}</span>
        </button>`
    )).join('');
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let message = 'Request failed.';

        try {
            const errorPayload = await response.json();
            message = errorPayload.error || message;
        } catch (error) {
            message = 'Request failed.';
        }

        throw new Error(message);
    }

    return response.json();
}

function attachRoomStream() {
    if (app.online.eventSource) {
        app.online.eventSource.close();
    }

    app.online.eventSource = new EventSource(
        `/api/rooms/${app.online.roomCode}/events?playerId=${encodeURIComponent(app.online.playerId)}`
    );

    app.online.eventSource.onmessage = (event) => {
        const snapshot = JSON.parse(event.data);
        app.online.snapshot = snapshot;
        app.online.message = snapshot.message || app.online.message;

        const controlledPaddle = snapshot.paddles[app.online.side];

        if (controlledPaddle && (app.online.lastSentY === null || Math.abs(app.online.inputY - controlledPaddle.y) > 160)) {
            app.online.inputY = controlledPaddle.y;
        }

        controlsNote.textContent = app.online.side
            ? `You control the ${app.online.side} paddle. Share this page URL and room code with your friend.`
            : controlsNote.textContent;

        syncOnlineOverlay();
        syncUi();
    };

    app.online.eventSource.onerror = () => {
        app.online.message = 'Trying to reconnect to the room...';
        syncUi();
    };
}

async function createRoom() {
    if (app.online.connected || app.online.busy) {
        return;
    }

    app.online.busy = true;
    syncUi();

    try {
        const room = await postJson('/api/rooms/create', {});
        app.online.connected = true;
        app.online.roomCode = room.roomCode;
        app.online.playerId = room.playerId;
        app.online.side = room.side;
        app.online.message = 'Room created. Waiting for your friend.';
        app.online.snapshot = createOnlinePlaceholder(app.online.message);
        app.online.inputY = centerPaddleY;
        app.online.lastSentY = null;
        roomCodeInput.value = room.roomCode;
        attachRoomStream();
        setMode('online');
    } catch (error) {
        app.online.message = error.message;
        syncOnlineOverlay();
    } finally {
        app.online.busy = false;
        syncUi();
    }
}

async function joinRoom() {
    if (app.online.connected || app.online.busy) {
        return;
    }

    const code = roomCodeInput.value.trim().toUpperCase();

    if (!code) {
        app.online.message = 'Enter a room code first.';
        syncUi();
        return;
    }

    app.online.busy = true;
    syncUi();

    try {
        const room = await postJson('/api/rooms/join', { code });
        app.online.connected = true;
        app.online.roomCode = room.roomCode;
        app.online.playerId = room.playerId;
        app.online.side = room.side;
        app.online.message = 'Joined room. Match will start when both players are ready.';
        app.online.snapshot = createOnlinePlaceholder(app.online.message);
        app.online.inputY = centerPaddleY;
        app.online.lastSentY = null;
        roomCodeInput.value = room.roomCode;
        attachRoomStream();
        setMode('online');
    } catch (error) {
        app.online.message = error.message;
        syncOnlineOverlay();
    } finally {
        app.online.busy = false;
        syncUi();
    }
}

async function sendRoomAction(action) {
    if (!app.online.connected) {
        return;
    }

    try {
        await postJson(`/api/rooms/${app.online.roomCode}/action`, {
            playerId: app.online.playerId,
            action
        });
    } catch (error) {
        app.online.message = error.message;
        syncUi();
    }
}

async function leaveRoom() {
    if (!app.online.connected) {
        return;
    }

    const payload = {
        playerId: app.online.playerId
    };

    try {
        await postJson(`/api/rooms/${app.online.roomCode}/leave`, payload);
    } catch (error) {
        app.online.message = error.message;
    }

    if (app.online.eventSource) {
        app.online.eventSource.close();
    }

    app.online = createOnlineState();
    syncOnlineOverlay();
    syncUi();
}

function sendLeaveBeacon() {
    if (!app.online.connected) {
        return;
    }

    const payload = JSON.stringify({
        playerId: app.online.playerId
    });
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(`/api/rooms/${app.online.roomCode}/leave`, blob);
}

async function copyRoomCode() {
    if (!app.online.roomCode) {
        return;
    }

    try {
        await navigator.clipboard.writeText(app.online.roomCode);
        app.online.message = `Copied room code ${app.online.roomCode}.`;
    } catch (error) {
        app.online.message = `Room code: ${app.online.roomCode}`;
    }

    syncUi();
}

function handlePrimaryAction() {
    switch (app.overlayAction) {
        case 'start-cpu':
        case 'restart-cpu':
            startLocalMatch();
            break;
        case 'create-room':
            createRoom();
            break;
        case 'copy-room-code':
            copyRoomCode();
            break;
        case 'restart-online':
            sendRoomAction('restart');
            break;
        default:
            break;
    }
}

function frame(timestamp) {
    if (!app.lastFrameTime) {
        app.lastFrameTime = timestamp;
    }

    const deltaSeconds = Math.min((timestamp - app.lastFrameTime) / 1000, 0.02);
    app.lastFrameTime = timestamp;

    if (app.mode === 'cpu') {
        updateLocalMatch(deltaSeconds, timestamp);
    } else {
        updateOnlineInput(deltaSeconds, timestamp);
    }

    syncUi();
    render();
    requestAnimationFrame(frame);
}

document.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', ' ', 'Spacebar', 'w', 'W', 's', 'S'].includes(event.key)) {
        event.preventDefault();
    }

    keys[event.key] = true;

    if (event.repeat) {
        return;
    }

    if (event.key === ' ' || event.code === 'Space' || event.key === 'Spacebar') {
        handlePrimaryAction();
    }
});

document.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});

canvas.addEventListener('pointerdown', (event) => {
    applyPointerControl(event.clientY);
});

canvas.addEventListener('pointermove', (event) => {
    applyPointerControl(event.clientY);
});

themePicker.addEventListener('click', (event) => {
    const button = event.target.closest('.theme-chip');

    if (!button) {
        return;
    }

    setTheme(button.dataset.theme);
});

cpuModeButton.addEventListener('click', async () => {
    if (app.online.connected) {
        await leaveRoom();
    }

    setMode('cpu');
});

onlineModeButton.addEventListener('click', () => {
    setMode('online');
});

startCpuButton.addEventListener('click', () => {
    startLocalMatch();
});

createRoomButton.addEventListener('click', () => {
    createRoom();
});

joinRoomButton.addEventListener('click', () => {
    joinRoom();
});

copyCodeButton.addEventListener('click', () => {
    copyRoomCode();
});

leaveRoomButton.addEventListener('click', () => {
    leaveRoom();
});

overlayButton.addEventListener('click', () => {
    handlePrimaryAction();
});

roomCodeInput.addEventListener('input', () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});

roomCodeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        joinRoom();
    }
});

window.addEventListener('beforeunload', () => {
    sendLeaveBeacon();

    if (app.online.eventSource) {
        app.online.eventSource.close();
    }
});

populateThemes();
setTheme(app.theme);
setMode('cpu');
syncUi();
render();
requestAnimationFrame(frame);
