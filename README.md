# Pong Game Documentation

## Features  
- Classic Pong gameplay.  
- Single and multiplayer modes available.  
- Customizable ball and paddle speeds.  
- Score tracking and display.

## How to Play  
1. Start the game by launching `main.py`.  
2. Use the following controls:  
   - **Player 1:** W (up), S (down)  
   - **Player 2:** Up Arrow (up), Down Arrow (down)  
3. The objective is to score against the opponent by getting the ball past their paddle.  

## Project Structure  
```
PongGame/
├── main.py       # Main game loop  
├── paddle.py     # Paddle class and methods  
├── ball.py       # Ball class and methods  
├── game.py       # Game management and mechanics  
├── settings.py   # Configuration settings (speed, colors, etc.)  
└── README.md     # Documentation file
```

## Game Mechanics  
- **Paddles:** Move vertically to intercept the ball. 
- **Ball:** Bounces off the walls and paddles. 
- **Scoring:** Points are awarded when the ball passes a paddle.

## Technical Details  
- Built using Python with Pygame library.  
- Optimized for performance to run smoothly on low-end devices.

## Customization Guide  
- Modify `settings.py` to change game speed, paddle size, and colors.  
- Implement new features by extending classes in `paddle.py` and `ball.py`.  
- For multiplayer options, adjust the keyboard controls in `main.py`.  

## License  
This project is licensed under the MIT License.