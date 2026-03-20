// Pong Game Logic

class Paddle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = 10;
    }

    move(up) {
        if (up) {
            this.y -= this.speed;
        } else {
            this.y += this.speed;
        }
    }

    draw(ctx) {
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Ball {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speedX = 5;
        this.speedY = 5;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.paddleWidth = 10;
        this.paddleHeight = 100;
        this.playerPaddle = new Paddle(0, canvas.height / 2 - this.paddleHeight / 2, this.paddleWidth, this.paddleHeight);
        this.aiPaddle = new Paddle(canvas.width - this.paddleWidth, canvas.height / 2 - this.paddleHeight / 2, this.paddleWidth, this.paddleHeight);
        this.ball = new Ball(canvas.width / 2, canvas.height / 2, 10);
        this.score = { player: 0, ai: 0 };
        this.setupControls();
        this.loop();
    }

    setupControls() {
        window.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseY = event.clientY - rect.top;
            this.playerPaddle.y = mouseY - this.paddleHeight / 2;
        });
    }

    updateAI() {
        if (this.ball.y < this.aiPaddle.y) {
            this.aiPaddle.move(true);
        } else {
            this.aiPaddle.move(false);
        }
    }

    checkCollisions() {
        // Ball and paddle collisions
        if (this.ball.x - this.ball.radius < this.playerPaddle.x + this.playerPaddle.width &&
            this.ball.y > this.playerPaddle.y && this.ball.y < this.playerPaddle.y + this.paddleHeight) {
            this.ball.speedX = -this.ball.speedX;
        }

        if (this.ball.x + this.ball.radius > this.aiPaddle.x &&
            this.ball.y > this.aiPaddle.y && this.ball.y < this.aiPaddle.y + this.paddleHeight) {
            this.ball.speedX = -this.ball.speedX;
        }

        // Check for scoring
        if (this.ball.x - this.ball.radius < 0) {
            this.score.ai++;
            this.resetBall();
        } else if (this.ball.x + this.ball.radius > this.canvas.width) {
            this.score.player++;
            this.resetBall();
        }
    }

    resetBall() {
        this.ball = new Ball(this.canvas.width / 2, this.canvas.height / 2, 10);
    }

    drawScore() {
        this.ctx.fillStyle = 'black';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Player: ${this.score.player}`, 10, 20);
        this.ctx.fillText(`AI: ${this.score.ai}`, this.canvas.width - 60, 20);
    }

    loop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ball.update();
        this.updateAI();
        this.checkCollisions();
        this.ball.draw(this.ctx);
        this.playerPaddle.draw(this.ctx);
        this.aiPaddle.draw(this.ctx);
        this.drawScore();
        requestAnimationFrame(() => this.loop());
    }
}

window.onload = () => {
    const canvas = document.getElementById('pong');
    const game = new Game(canvas);
};