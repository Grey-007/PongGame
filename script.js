const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game objects
const game = {
    width: 800,
    height: 400
};

// Player paddle
const paddle = {
    x: 10,
    y: game.height / 2 - 50,
    width: 10,
    height: 100,
    speed: 6,
    dy: 0
};

// Computer paddle
const computerPaddle = {
    x: game.width - 20,
    y: game.height / 2 - 50,
    width: 10,
    height: 100,
    speed: 5.5,
    dy: 0
};

// Ball
const ball = {
    x: game.width / 2,
    y: game.height / 2,
    radius: 8,
    speedX: 5,
    speedY: 5,
    maxSpeed: 8
};

// Score
let playerScore = 0;
let computerScore = 0;

// Input
const keys = {};

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    if (mouseY - paddle.height / 2 > 0 && mouseY + paddle.height / 2 < game.height) {
        paddle.y = mouseY - paddle.height / 2;
    }
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

function draw() {
    // Clear canvas
    ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
    ctx.fillRect(0, 0, game.width, game.height);

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(game.width / 2, 0);
    ctx.lineTo(game.width / 2, game.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    drawRect(paddle.x, paddle.y, paddle.width, paddle.height, '#00D4FF');
    drawRect(computerPaddle.x, computerPaddle.y, computerPaddle.width, computerPaddle.height, '#FF006E');

    // Draw ball
    drawCircle(ball.x, ball.y, ball.radius, '#FFD60A');
}

// Update logic
function update() {
    // Player paddle
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        if (paddle.y > 0) {
            paddle.y -= paddle.speed;
        }
    }
    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        if (paddle.y + paddle.height < game.height) {
            paddle.y += paddle.speed;
        }
    }

    // Keep paddle in bounds
    paddle.y = Math.max(0, Math.min(paddle.y, game.height - paddle.height));

    // Ball movement
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    // Ball collision with top and bottom
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > game.height) {
        ball.speedY = -ball.speedY;
        ball.y = Math.max(ball.radius, Math.min(ball.y, game.height - ball.radius));
    }

    // Ball collision with player paddle
    if (
        ball.x - ball.radius < paddle.x + paddle.width &&
        ball.y > paddle.y &&
        ball.y < paddle.y + paddle.height
    ) {
        ball.speedX = -ball.speedX;
        ball.x = paddle.x + paddle.width + ball.radius;

        // Add spin
        let deltaY = ball.y - (paddle.y + paddle.height / 2);
        ball.speedY = (deltaY / (paddle.height / 2)) * ball.maxSpeed;
    }

    // Ball collision with computer paddle
    if (
        ball.x + ball.radius > computerPaddle.x &&
        ball.y > computerPaddle.y &&
        ball.y < computerPaddle.y + computerPaddle.height
    ) {
        ball.speedX = -ball.speedX;
        ball.x = computerPaddle.x - ball.radius;

        // Add spin
        let deltaY = ball.y - (computerPaddle.y + computerPaddle.height / 2);
        ball.speedY = (deltaY / (computerPaddle.height / 2)) * ball.maxSpeed;
    }

    // Scoring
    if (ball.x - ball.radius < 0) {
        computerScore++;
        resetBall();
        document.getElementById('computerScore').textContent = computerScore;
    } else if (ball.x + ball.radius > game.width) {
        playerScore++;
        resetBall();
        document.getElementById('playerScore').textContent = playerScore;
    }

    // Computer AI
    const computerCenter = computerPaddle.y + computerPaddle.height / 2;
    if (computerCenter < ball.y - 30) {
        if (computerPaddle.y + computerPaddle.height < game.height) {
            computerPaddle.y += computerPaddle.speed;
        }
    } else if (computerCenter > ball.y + 30) {
        if (computerPaddle.y > 0) {
            computerPaddle.y -= computerPaddle.speed;
        }
    }

    // Keep computer paddle in bounds
    computerPaddle.y = Math.max(0, Math.min(computerPaddle.y, game.height - computerPaddle.height));
}

// Reset ball
function resetBall() {
    ball.x = game.width / 2;
    ball.y = game.height / 2;
    ball.speedX = (Math.random() > 0.5 ? 1 : -1) * 5;
    ball.speedY = (Math.random() * 2 - 1) * 5;
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
