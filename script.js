const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playerScoreEl = document.getElementById('playerScore');
const computerScoreEl = document.getElementById('computerScore');
const gameStatusEl = document.getElementById('gameStatus');
const overlayEl = document.getElementById('gameOverlay');
const overlayKickerEl = document.getElementById('overlayKicker');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayMessageEl = document.getElementById('overlayMessage');
const overlayButtonEl = document.getElementById('overlayButton');

// Game objects
const game = {
    width: 800,
    height: 400,
    winningScore: 5,
    serveDelay: 900,
    state: 'menu',
    previousState: null,
    serveReadyAt: 0,
    lastFrameTime: 0
};

// Player paddle
const paddle = {
    x: 16,
    y: game.height / 2 - 50,
    width: 12,
    height: 100,
    speed: 460
};

// Computer paddle
const computerPaddle = {
    x: game.width - 28,
    y: game.height / 2 - 50,
    width: 12,
    height: 100,
    speed: 380
};

// Ball
const ball = {
    x: game.width / 2,
    y: game.height / 2,
    radius: 8,
    vx: 0,
    vy: 0,
    baseSpeed: 380,
    maxSpeed: 780,
    speedStep: 28,
    serveDirection: 1
};

// Score
let playerScore = 0;
let computerScore = 0;

// Input
const keys = {};

// Event listeners
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', ' ', 'Spacebar', 'p', 'P', 'w', 'W', 's', 'S'].includes(e.key)) {
        e.preventDefault();
    }

    keys[e.key] = true;

    if (e.repeat) {
        return;
    }

    if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar') {
        handlePrimaryAction();
    }

    if (e.key === 'p' || e.key === 'P') {
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function movePlayerToClientY(clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaledY = ((clientY - rect.top) / rect.height) * game.height;
    paddle.y = clamp(scaledY - paddle.height / 2, 0, game.height - paddle.height);
}

canvas.addEventListener('pointerdown', (e) => {
    movePlayerToClientY(e.clientY);
});

canvas.addEventListener('pointermove', (e) => {
    movePlayerToClientY(e.clientY);
});

overlayButtonEl.addEventListener('click', () => {
    handlePrimaryAction();
});

// Draw functions
function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
}

function drawCourt() {
    ctx.fillStyle = 'rgba(13, 25, 54, 0.95)';
    ctx.fillRect(0, 0, game.width, game.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 0, game.width, 12);
    ctx.fillRect(0, game.height - 12, game.width, 12);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(game.width / 2, 18);
    ctx.lineTo(game.width / 2, game.height - 18);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(game.width / 2, game.height / 2, 55, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function draw() {
    drawCourt();

    // Draw paddles
    drawRect(paddle.x, paddle.y, paddle.width, paddle.height, '#42D9FF');
    drawRect(computerPaddle.x, computerPaddle.y, computerPaddle.width, computerPaddle.height, '#FF6B6B');

    // Draw ball
    drawCircle(ball.x, ball.y, ball.radius, '#FFD166');
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function setStatus(message) {
    gameStatusEl.textContent = message;
}

function showOverlay(kicker, title, message, buttonLabel) {
    overlayKickerEl.textContent = kicker;
    overlayTitleEl.textContent = title;
    overlayMessageEl.textContent = message;
    overlayButtonEl.textContent = buttonLabel;
    overlayEl.classList.remove('is-hidden');
}

function hideOverlay() {
    overlayEl.classList.add('is-hidden');
}

function syncScores() {
    playerScoreEl.textContent = playerScore;
    computerScoreEl.textContent = computerScore;
}

function centerBall(direction) {
    ball.x = game.width / 2;
    ball.y = game.height / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.serveDirection = direction;
}

function resetPaddles() {
    paddle.y = game.height / 2 - paddle.height / 2;
    computerPaddle.y = game.height / 2 - computerPaddle.height / 2;
}

function scheduleServe(direction, message) {
    centerBall(direction);
    game.state = 'serving';
    game.serveReadyAt = performance.now() + game.serveDelay;
    hideOverlay();
    setStatus(message);
}

function launchBall() {
    if (game.state !== 'serving') {
        return;
    }

    const angle = (Math.random() - 0.5) * (Math.PI / 2.6);
    const verticalSign = Math.random() > 0.5 ? 1 : -1;

    ball.vx = Math.cos(angle) * ball.baseSpeed * ball.serveDirection;
    ball.vy = Math.sin(angle) * ball.baseSpeed;

    if (Math.abs(ball.vy) < 130) {
        ball.vy = 130 * verticalSign;
    }

    game.state = 'playing';
    setStatus('Rally live. First to 5 wins.');
}

function startMatch() {
    playerScore = 0;
    computerScore = 0;
    syncScores();
    resetPaddles();
    scheduleServe(Math.random() > 0.5 ? 1 : -1, 'Match starting. Press Space to serve or wait.');
}

function endMatch(winner) {
    game.state = 'gameover';
    centerBall(winner === 'player' ? -1 : 1);

    if (winner === 'player') {
        setStatus('You won the match. Press Space to play again.');
        showOverlay(
            'Match Point',
            'You Win',
            'Great rallying. Start a new first-to-five match any time.',
            'Play Again'
        );
        return;
    }

    setStatus('The computer won the match. Press Space to try again.');
    showOverlay(
        'Match Point',
        'Computer Wins',
        'The AI got to five first. Jump back in for a rematch.',
        'Play Again'
    );
}

function scorePoint(side) {
    if (side === 'player') {
        playerScore += 1;
    } else {
        computerScore += 1;
    }

    syncScores();

    if (playerScore >= game.winningScore) {
        endMatch('player');
        return;
    }

    if (computerScore >= game.winningScore) {
        endMatch('computer');
        return;
    }

    const direction = side === 'player' ? 1 : -1;
    const message = side === 'player'
        ? 'You scored. Press Space to serve or wait.'
        : 'Computer scored. Press Space to serve or wait.';

    scheduleServe(direction, message);
}

function handlePrimaryAction() {
    if (game.state === 'menu' || game.state === 'gameover') {
        startMatch();
        return;
    }

    if (game.state === 'paused') {
        game.state = game.previousState || 'serving';
        if (game.state === 'serving') {
            game.serveReadyAt = performance.now() + 400;
            setStatus('Back in play. Press Space to serve or wait.');
        } else {
            setStatus('Rally live. First to 5 wins.');
        }
        hideOverlay();
        return;
    }

    if (game.state === 'serving') {
        launchBall();
    }
}

function togglePause() {
    if (game.state === 'menu' || game.state === 'gameover') {
        return;
    }

    if (game.state === 'paused') {
        handlePrimaryAction();
        return;
    }

    game.previousState = game.state;
    game.state = 'paused';
    setStatus('Paused. Press P or Space to resume.');
    showOverlay(
        'Match Paused',
        'Take a Breath',
        'Press P, Space, or the button below when you want to continue the rally.',
        'Resume Match'
    );
}

function updatePlayer(deltaSeconds) {
    let direction = 0;

    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        direction -= 1;
    }

    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        direction += 1;
    }

    paddle.y += direction * paddle.speed * deltaSeconds;
    paddle.y = clamp(paddle.y, 0, game.height - paddle.height);
}

function updateComputer(deltaSeconds) {
    let targetY = game.height / 2;

    if (game.state === 'playing' && ball.vx > 0) {
        targetY = ball.y + ball.vy * 0.08;
    } else if (game.state === 'playing') {
        targetY = game.height / 2 + (ball.y - game.height / 2) * 0.25;
    }

    const computerCenter = computerPaddle.y + computerPaddle.height / 2;
    const difference = targetY - computerCenter;
    const deadZone = 16;

    if (Math.abs(difference) > deadZone) {
        computerPaddle.y += Math.sign(difference) * computerPaddle.speed * deltaSeconds;
    }

    computerPaddle.y = clamp(computerPaddle.y, 0, game.height - computerPaddle.height);
}

function bounceFromPaddle(activePaddle, direction) {
    const impact = clamp(
        (ball.y - (activePaddle.y + activePaddle.height / 2)) / (activePaddle.height / 2),
        -1,
        1
    );
    const bounceAngle = impact * (Math.PI / 3);
    const nextSpeed = clamp(Math.hypot(ball.vx, ball.vy) + ball.speedStep, ball.baseSpeed, ball.maxSpeed);

    ball.vx = Math.cos(bounceAngle) * nextSpeed * direction;
    ball.vy = Math.sin(bounceAngle) * nextSpeed;
}

function updateBall(deltaSeconds) {
    ball.x += ball.vx * deltaSeconds;
    ball.y += ball.vy * deltaSeconds;

    if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
    } else if (ball.y + ball.radius >= game.height) {
        ball.y = game.height - ball.radius;
        ball.vy = -Math.abs(ball.vy);
    }

    const hitsPlayerPaddle =
        ball.vx < 0 &&
        ball.x - ball.radius <= paddle.x + paddle.width &&
        ball.x > paddle.x &&
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height;

    if (hitsPlayerPaddle) {
        ball.x = paddle.x + paddle.width + ball.radius;
        bounceFromPaddle(paddle, 1);
    }

    const hitsComputerPaddle =
        ball.vx > 0 &&
        ball.x + ball.radius >= computerPaddle.x &&
        ball.x < computerPaddle.x + computerPaddle.width &&
        ball.y + ball.radius >= computerPaddle.y &&
        ball.y - ball.radius <= computerPaddle.y + computerPaddle.height;

    if (hitsComputerPaddle) {
        ball.x = computerPaddle.x - ball.radius;
        bounceFromPaddle(computerPaddle, -1);
    }

    if (ball.x + ball.radius < 0) {
        scorePoint('computer');
    } else if (ball.x - ball.radius > game.width) {
        scorePoint('player');
    }
}

function update(deltaSeconds, timestamp) {
    if (game.state === 'menu' || game.state === 'paused' || game.state === 'gameover') {
        return;
    }

    updatePlayer(deltaSeconds);
    updateComputer(deltaSeconds);

    if (game.state === 'serving' && timestamp >= game.serveReadyAt) {
        launchBall();
    }

    if (game.state === 'playing') {
        updateBall(deltaSeconds);
    }
}

// Game loop
function gameLoop(timestamp) {
    if (!game.lastFrameTime) {
        game.lastFrameTime = timestamp;
    }

    const deltaSeconds = Math.min((timestamp - game.lastFrameTime) / 1000, 0.02);
    game.lastFrameTime = timestamp;

    update(deltaSeconds, timestamp);
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
showOverlay(
    'Classic Arcade Rally',
    'Press Space to Start',
    'Play against the computer with mouse, touch, W/S, or Up/Down. First to 5 points wins.',
    'Start Match'
);
setStatus('Press Space or click Start Match.');
syncScores();
centerBall(1);
draw();
requestAnimationFrame(gameLoop);
