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

const SUPABASE_MODULE_URL = 'https://esm.sh/@supabase/supabase-js@2';
const ONLINE_BROADCAST_INTERVAL = 1000 / 30;

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
    local: createMatchState('menu', 'Start a local match or switch to online 1v1.'),
    online: createOnlineState()
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function generateId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `player-${Math.random().toString(36).slice(2, 10)}`;
}

function generateRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    for (let index = 0; index < 6; index += 1) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return code;
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

function makePlayers(leftConnected = false, rightConnected = false) {
    return {
        left: { connected: leftConnected },
        right: { connected: rightConnected }
    };
}

function createMatchState(status, message, leftConnected = false, rightConnected = false) {
    return {
        status,
        message,
        winner: null,
        scores: { left: 0, right: 0 },
        paddles: makePaddles(),
        ball: makeBall(),
        serveDirection: 1,
        serveReadyAt: 0,
        players: makePlayers(leftConnected, rightConnected)
    };
}

function createOnlineState() {
    return {
        configured: false,
        configChecked: false,
        configError: '',
        client: null,
        channel: null,
        connected: false,
        busy: false,
        roomCode: '',
        playerId: '',
        side: null,
        isHost: false,
        snapshot: createMatchState('idle', 'Online mode is loading.'),
        authoritative: null,
        message: 'Create a room or join one with a code.',
        inputY: centerPaddleY,
        remoteInputY: centerPaddleY,
        lastStateBroadcastAt: 0,
        presence: {
            left: false,
            right: false
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
    app.local = createMatchState('serving', 'Local match starting.');
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

function updateBallPhysics(state, onScore, now) {
    state.ball.x += state.ball.vx * now.deltaSeconds;
    state.ball.y += state.ball.vy * now.deltaSeconds;

    if (state.ball.y - state.ball.radius <= 0) {
        state.ball.y = state.ball.radius;
        state.ball.vy = Math.abs(state.ball.vy);
    } else if (state.ball.y + state.ball.radius >= GAME.height) {
        state.ball.y = GAME.height - state.ball.radius;
        state.ball.vy = -Math.abs(state.ball.vy);
    }

    const leftX = 24;
    const hitsLeft =
        state.ball.vx < 0 &&
        state.ball.x - state.ball.radius <= leftX &&
        state.ball.y + state.ball.radius >= state.paddles.left.y &&
        state.ball.y - state.ball.radius <= state.paddles.left.y + GAME.paddle.height;

    if (hitsLeft) {
        state.ball.x = leftX + state.ball.radius;
        bounceBall(state, 'left');
    }

    const rightX = GAME.width - 24;
    const hitsRight =
        state.ball.vx > 0 &&
        state.ball.x + state.ball.radius >= rightX &&
        state.ball.y + state.ball.radius >= state.paddles.right.y &&
        state.ball.y - state.ball.radius <= state.paddles.right.y + GAME.paddle.height;

    if (hitsRight) {
        state.ball.x = rightX - state.ball.radius;
        bounceBall(state, 'right');
    }

    if (state.ball.x + state.ball.radius < 0) {
        onScore('right');
    } else if (state.ball.x - state.ball.radius > GAME.width) {
        onScore('left');
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
        updateBallPhysics(app.local, (side) => scoreLocal(side, now), { deltaSeconds });
    }
}

function cloneMatchState(state) {
    return {
        status: state.status,
        message: state.message,
        winner: state.winner,
        scores: {
            left: state.scores.left,
            right: state.scores.right
        },
        paddles: {
            left: { y: state.paddles.left.y },
            right: { y: state.paddles.right.y }
        },
        ball: {
            x: state.ball.x,
            y: state.ball.y,
            radius: state.ball.radius,
            vx: state.ball.vx,
            vy: state.ball.vy
        },
        serveDirection: state.serveDirection,
        serveReadyAt: state.serveReadyAt,
        players: {
            left: { connected: state.players.left.connected },
            right: { connected: state.players.right.connected }
        }
    };
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

        if (!app.online.isHost) {
            broadcastOnlineInput();
        }
    }
}

function updateOnlineInput(deltaSeconds) {
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

    if (!app.online.isHost) {
        broadcastOnlineInput();
    }
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

function getRenderableState() {
    if (app.mode === 'online') {
        return app.online.snapshot;
    }

    return app.local;
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
    gameStatus.textContent = app.mode === 'online' ? app.online.message : app.local.message;

    roomCodeBadge.textContent = app.online.connected ? `Room: ${app.online.roomCode}` : 'Room: none';
    roomRoleBadge.textContent = app.online.connected
        ? `Role: ${app.online.side}`
        : 'Role: offline';
    shareHint.textContent = app.mode === 'online'
        ? 'Share this page URL and the room code with your friend.'
        : 'Local mode works by itself. Online mode uses hosted realtime.';

    copyCodeButton.disabled = !app.online.connected;
    leaveRoomButton.disabled = !app.online.connected;
    createRoomButton.disabled = app.online.busy;
    joinRoomButton.disabled = app.online.busy;
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

async function ensureRealtimeClient() {
    if (app.online.configChecked) {
        return app.online.configured;
    }

    app.online.configChecked = true;

    try {
        const response = await fetch('/api/realtime-config', { cache: 'no-store' });

        if (!response.ok) {
            throw new Error('Realtime config endpoint failed.');
        }

        const config = await response.json();

        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error('Online mode is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.');
        }

        const { createClient } = await import(SUPABASE_MODULE_URL);
        app.online.client = createClient(config.supabaseUrl, config.supabaseAnonKey);
        app.online.configured = true;
        app.online.configError = '';
        app.online.message = 'Create a room or join one with a code.';
        return true;
    } catch (error) {
        app.online.configured = false;
        app.online.configError = error.message;
        app.online.message = error.message;
        return false;
    }
}

function updatePresenceFromChannel() {
    if (!app.online.channel) {
        return;
    }

    const presenceState = app.online.channel.presenceState();
    const presence = {
        left: false,
        right: false
    };

    Object.values(presenceState).forEach((entries) => {
        entries.forEach((entry) => {
            if (entry.side === 'left') {
                presence.left = true;
            }

            if (entry.side === 'right') {
                presence.right = true;
            }
        });
    });

    app.online.presence = presence;

    if (!app.online.snapshot) {
        app.online.snapshot = createMatchState('waiting', 'Waiting for players.');
    }

    app.online.snapshot.players = makePlayers(presence.left, presence.right);

    if (app.online.isHost) {
        if (presence.left && presence.right) {
            if (!app.online.authoritative || app.online.authoritative.status === 'waiting') {
                startHostedMatch();
            }
        } else if (app.online.authoritative) {
            app.online.authoritative = createMatchState(
                'waiting',
                presence.left ? 'Waiting for your friend to join.' : 'Waiting for host.',
                presence.left,
                presence.right
            );
            app.online.snapshot = cloneMatchState(app.online.authoritative);
            broadcastOnlineState(true);
        }
    } else if (!presence.left) {
        app.online.snapshot = createMatchState('waiting', 'Waiting for host to connect.', presence.left, presence.right);
    } else if (!presence.right) {
        app.online.snapshot = createMatchState('waiting', 'Waiting for another player.', presence.left, presence.right);
    }

    syncOnlineOverlay();
    syncUi();
}

function startHostedMatch() {
    app.online.authoritative = createMatchState('serving', 'Match starting.', true, true);
    resetPaddles(app.online.authoritative);
    app.online.inputY = centerPaddleY;
    app.online.remoteInputY = centerPaddleY;
    scheduleServe(
        app.online.authoritative,
        Math.random() > 0.5 ? 1 : -1,
        'Match starting.',
        performance.now()
    );
    app.online.snapshot = cloneMatchState(app.online.authoritative);
    app.online.message = app.online.snapshot.message;
    broadcastOnlineState(true);
}

function finishHostedMatch(winner) {
    app.online.authoritative.status = 'gameover';
    app.online.authoritative.winner = winner;
    centerBall(app.online.authoritative, winner === 'left' ? -1 : 1);
    app.online.authoritative.message = winner === 'left'
        ? 'Left player won the match.'
        : 'Right player won the match.';
}

function scoreHosted(side, now) {
    app.online.authoritative.scores[side] += 1;

    if (app.online.authoritative.scores[side] >= GAME.winningScore) {
        finishHostedMatch(side);
        return;
    }

    const direction = side === 'left' ? 1 : -1;
    const baseMessage = side === 'left' ? 'Left player scored.' : 'Right player scored.';
    scheduleServe(app.online.authoritative, direction, `${baseMessage} Next serve in a moment.`, now);
}

function updateHostedMatch(deltaSeconds, now) {
    if (!app.online.isHost || !app.online.authoritative) {
        return;
    }

    app.online.authoritative.players = makePlayers(app.online.presence.left, app.online.presence.right);
    app.online.authoritative.message = app.online.authoritative.message;
    app.online.authoritative.paddles.left.y = clamp(app.online.inputY, 0, GAME.height - GAME.paddle.height);

    const remoteDelta = app.online.remoteInputY - app.online.authoritative.paddles.right.y;
    const remoteStep = GAME.paddle.speed * deltaSeconds;

    if (Math.abs(remoteDelta) <= remoteStep) {
        app.online.authoritative.paddles.right.y = app.online.remoteInputY;
    } else {
        app.online.authoritative.paddles.right.y += Math.sign(remoteDelta) * remoteStep;
    }

    if (app.online.authoritative.status === 'waiting' || !app.online.presence.left || !app.online.presence.right) {
        app.online.snapshot = cloneMatchState(app.online.authoritative);
        app.online.message = app.online.snapshot.message;
        return;
    }

    if (app.online.authoritative.status === 'serving' && now >= app.online.authoritative.serveReadyAt) {
        launchBall(app.online.authoritative);
    }

    if (app.online.authoritative.status === 'playing') {
        updateBallPhysics(app.online.authoritative, (side) => scoreHosted(side, now), { deltaSeconds });
    }

    app.online.snapshot = cloneMatchState(app.online.authoritative);
    app.online.message = app.online.snapshot.message;
    broadcastOnlineState();
}

async function broadcastOnlineInput() {
    if (!app.online.channel || app.online.isHost || !app.online.connected) {
        return;
    }

    try {
        await app.online.channel.send({
            type: 'broadcast',
            event: 'input',
            payload: {
                playerId: app.online.playerId,
                paddleY: Math.round(app.online.inputY * 100) / 100
            }
        });
    } catch (error) {
        app.online.message = 'Unable to send paddle movement.';
        syncUi();
    }
}

async function broadcastOnlineState(force = false) {
    if (!app.online.channel || !app.online.isHost || !app.online.authoritative) {
        return;
    }

    const now = performance.now();

    if (!force && now - app.online.lastStateBroadcastAt < ONLINE_BROADCAST_INTERVAL) {
        return;
    }

    app.online.lastStateBroadcastAt = now;
    app.online.snapshot = cloneMatchState(app.online.authoritative);
    app.online.message = app.online.snapshot.message;

    try {
        await app.online.channel.send({
            type: 'broadcast',
            event: 'state',
            payload: {
                state: app.online.snapshot
            }
        });
    } catch (error) {
        app.online.message = 'Unable to broadcast room state.';
        syncUi();
    }
}

async function broadcastOnlineControl(action) {
    if (!app.online.channel || !app.online.connected) {
        return;
    }

    try {
        await app.online.channel.send({
            type: 'broadcast',
            event: 'control',
            payload: {
                playerId: app.online.playerId,
                action
            }
        });
    } catch (error) {
        app.online.message = 'Unable to send room action.';
        syncUi();
    }
}

async function leaveRealtimeRoom() {
    if (app.online.channel) {
        try {
            await app.online.channel.untrack();
        } catch (error) {
            // Ignore cleanup errors here.
        }

        try {
            await app.online.channel.unsubscribe();
        } catch (error) {
            // Ignore cleanup errors here too.
        }

        if (app.online.client) {
            app.online.client.removeChannel(app.online.channel);
        }
    }

    const client = app.online.client;
    const configured = app.online.configured;
    const configChecked = app.online.configChecked;
    const configError = app.online.configError;

    app.online = createOnlineState();
    app.online.client = client;
    app.online.configured = configured;
    app.online.configChecked = configChecked;
    app.online.configError = configError;
    app.online.message = configured
        ? 'Create a room or join one with a code.'
        : (configError || 'Online mode is not configured.');
}

async function connectToRealtimeRoom(roomCode, side) {
    const ready = await ensureRealtimeClient();

    if (!ready) {
        syncOnlineOverlay();
        syncUi();
        return;
    }

    app.online.busy = true;
    syncUi();

    try {
        if (app.online.connected || app.online.channel) {
            await leaveRealtimeRoom();
        }

        app.online.playerId = generateId();
        app.online.roomCode = roomCode;
        app.online.side = side;
        app.online.isHost = side === 'left';
        app.online.connected = false;
        app.online.inputY = centerPaddleY;
        app.online.remoteInputY = centerPaddleY;
        app.online.snapshot = createMatchState('waiting', 'Connecting to room...');
        app.online.message = 'Connecting to room...';

        const channel = app.online.client.channel(`pong-room:${roomCode}`, {
            config: {
                presence: {
                    key: app.online.playerId
                }
            }
        });

        app.online.channel = channel;

        channel.on('presence', { event: 'sync' }, () => {
            updatePresenceFromChannel();
        });

        channel.on('broadcast', { event: 'input' }, ({ payload }) => {
            if (app.online.isHost && payload.playerId !== app.online.playerId) {
                app.online.remoteInputY = clamp(payload.paddleY, 0, GAME.height - GAME.paddle.height);
            }
        });

        channel.on('broadcast', { event: 'state' }, ({ payload }) => {
            if (app.online.isHost) {
                return;
            }

            app.online.snapshot = payload.state;
            app.online.message = payload.state.message;
            syncOnlineOverlay();
            syncUi();
        });

        channel.on('broadcast', { event: 'control' }, ({ payload }) => {
            if (!app.online.isHost) {
                return;
            }

            if (payload.action === 'restart' && app.online.presence.left && app.online.presence.right) {
                startHostedMatch();
            }
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timed out connecting to realtime room.'));
            }, 10000);

            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timeout);

                    try {
                        await channel.track({
                            playerId: app.online.playerId,
                            side
                        });
                        app.online.connected = true;
                        app.online.message = side === 'left'
                            ? 'Room created. Waiting for your friend.'
                            : 'Joined room. Waiting for host to start.';
                        resolve();
                    } catch (error) {
                        reject(new Error('Failed to join room presence.'));
                    }
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    clearTimeout(timeout);
                    reject(new Error('Unable to connect to realtime room.'));
                }
            });
        });

        roomCodeInput.value = roomCode;
        setMode('online');
        updatePresenceFromChannel();
        syncOnlineOverlay();
    } catch (error) {
        app.online.message = error.message;
        await leaveRealtimeRoom();
        syncOnlineOverlay();
    } finally {
        app.online.busy = false;
        syncUi();
    }
}

async function createRoom() {
    if (app.online.busy) {
        return;
    }

    await connectToRealtimeRoom(generateRoomCode(), 'left');
}

async function joinRoom() {
    if (app.online.busy) {
        return;
    }

    const code = roomCodeInput.value.trim().toUpperCase();

    if (!code) {
        app.online.message = 'Enter a room code first.';
        syncUi();
        return;
    }

    await connectToRealtimeRoom(code, 'right');
}

async function leaveRoom() {
    await leaveRealtimeRoom();
    syncOnlineOverlay();
    syncUi();
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
    if (!app.online.configured && app.online.configChecked) {
        setOverlay({
            eyebrow: 'Online 1v1',
            title: 'Realtime Needs Setup',
            message: app.online.configError,
            action: 'none',
            label: ''
        });
        return;
    }

    const snapshot = app.online.snapshot;

    if (!app.online.connected) {
        setOverlay({
            eyebrow: 'Online 1v1',
            title: 'Create or Join a Room',
            message: 'Realtime rooms use Supabase. Create a room, share the code, and play live.',
            action: 'create-room',
            label: 'Create Room'
        });
        return;
    }

    if (snapshot.status === 'waiting' || snapshot.status === 'idle') {
        setOverlay({
            eyebrow: `Room ${app.online.roomCode}`,
            title: 'Waiting for Players',
            message: snapshot.message,
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
            message: 'Start another first-to-five rally when you are ready.',
            action: 'restart-online',
            label: 'Rematch'
        });
        return;
    }

    hideOverlay();
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
            if (app.online.isHost) {
                startHostedMatch();
            } else {
                broadcastOnlineControl('restart');
            }
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
        updateOnlineInput(deltaSeconds);
        updateHostedMatch(deltaSeconds, timestamp);
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

onlineModeButton.addEventListener('click', async () => {
    setMode('online');

    if (!app.online.configChecked) {
        await ensureRealtimeClient();
        syncOnlineOverlay();
        syncUi();
    }
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
    if (app.online.channel) {
        app.online.channel.untrack();
        app.online.channel.unsubscribe();
    }
});

populateThemes();
setTheme(app.theme);
setMode('cpu');
syncUi();
render();
requestAnimationFrame(frame);
