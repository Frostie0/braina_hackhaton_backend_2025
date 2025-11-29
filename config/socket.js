import { Server } from 'socket.io';
import GameRoom from '../models/GameRoom.js';

// Helper Functions
const checkAnswer = (userAnswer, correctAnswer) => {
    if (!userAnswer || !correctAnswer) return false;

    if (typeof correctAnswer === 'boolean') {
        return userAnswer === correctAnswer;
    }

    if (typeof correctAnswer === 'string') {
        return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    }

    if (Array.isArray(correctAnswer)) {
        return correctAnswer.includes(userAnswer);
    }

    return userAnswer === correctAnswer;
};

// Event Handlers
const handleJoinGame = async (io, socket, { gameCode, userId, userName, isHost }) => {
    try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
            socket.emit('error', { message: 'Partie non trouvée' });
            return;
        }

        socket.join(gameCode);

        const existingPlayer = gameRoom.players.find(p => p.userId === userId);
        if (existingPlayer) {
            existingPlayer.socketId = socket.id;
            existingPlayer.isConnected = true;
        } else {
            if (gameRoom.players.length >= gameRoom.settings.maxPlayers) {
                socket.emit('error', { message: 'La partie est complète' });
                return;
            }
            gameRoom.players.push({
                userId,
                userName,
                socketId: socket.id,
                isHost: isHost || false,
                score: 0,
                isConnected: true,
                answeredQuestions: []
            });
        }

        await gameRoom.save();

        // Emit to everyone in the room that a player joined/updated
        io.to(gameCode).emit('player_joined', {
            players: gameRoom.players.filter(p => p.isConnected)
        });

        // Send current game state to the joining player
        socket.emit('game_state', gameRoom);

    } catch (error) {
        console.error('Error in join_game:', error);
        socket.emit('error', { message: 'Erreur lors de la connexion à la partie' });
    }
};

const handleStartGame = async (io, socket, { gameCode }) => {
    try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) return;

        gameRoom.gameState = 'playing';
        gameRoom.startTime = new Date();
        gameRoom.questionStartTime = new Date();
        gameRoom.currentQuestionIndex = 0;

        await gameRoom.save();

        io.to(gameCode).emit('game_started', {
            startTime: gameRoom.startTime,
            questionIndex: 0
        });
    } catch (error) {
        console.error('Error in start_game:', error);
    }
};

const handleSubmitAnswer = async (io, socket, { gameCode, userId, answer, timeSpent }) => {
    try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom || gameRoom.gameState !== 'playing') return;

        const player = gameRoom.players.find(p => p.userId === userId);
        if (!player) return;

        // Check if already answered
        const alreadyAnswered = player.answeredQuestions.find(
            aq => aq.questionIndex === gameRoom.currentQuestionIndex
        );
        if (alreadyAnswered) return;

        const currentQuestion = gameRoom.questions[gameRoom.currentQuestionIndex];
        const isCorrect = checkAnswer(answer, currentQuestion.correctAnswer);

        let points = 0;
        if (isCorrect && answer !== null) {
            const basePoints = 100;
            const timeBonus = Math.max(0, gameRoom.settings.timePerQuestion - timeSpent) * 2;
            points = basePoints + timeBonus;
        }

        player.answeredQuestions.push({
            questionIndex: gameRoom.currentQuestionIndex,
            answer: answer || '',
            isCorrect,
            timeSpent,
            timestamp: new Date()
        });
        player.score += points;

        await gameRoom.save();

        // Notify that this player answered
        io.to(gameCode).emit('player_answered', {
            userId,
            hasAnswered: true
        });

        // Check if all players answered
        const connectedPlayers = gameRoom.players.filter(p => p.isConnected);
        const allAnswered = connectedPlayers.every(p =>
            p.answeredQuestions.some(aq => aq.questionIndex === gameRoom.currentQuestionIndex)
        );

        if (allAnswered) {
            io.to(gameCode).emit('all_answered', {
                questionIndex: gameRoom.currentQuestionIndex
            });
        }

    } catch (error) {
        console.error('Error in submit_answer:', error);
    }
};

const handleNextQuestion = async (io, socket, { gameCode }) => {
    try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) return;

        if (gameRoom.currentQuestionIndex < gameRoom.questions.length - 1) {
            gameRoom.currentQuestionIndex++;
            gameRoom.questionStartTime = new Date();
            await gameRoom.save();

            io.to(gameCode).emit('new_question', {
                questionIndex: gameRoom.currentQuestionIndex,
                startTime: gameRoom.questionStartTime
            });
        } else {
            // End game
            gameRoom.gameState = 'ended';
            gameRoom.endTime = new Date();

            // Calculate results
            const results = gameRoom.players.filter(p => p.isConnected).map(player => {
                const correctAnswers = player.answeredQuestions.filter(aq => aq.isCorrect).length;
                const totalAnswers = player.answeredQuestions.length;
                return {
                    userId: player.userId,
                    userName: player.userName,
                    score: player.score,
                    correctAnswers,
                    totalAnswers
                };
            });
            results.sort((a, b) => b.score - a.score);
            results.forEach((r, i) => r.rank = i + 1);

            gameRoom.finalResults = results;
            await gameRoom.save();

            io.to(gameCode).emit('game_ended', { results });
        }
    } catch (error) {
        console.error('Error in next_question:', error);
    }
};

const handleDisconnect = async (socket) => {
    console.log(`Client disconnected: ${socket.id}`);
    // Optional: Handle cleanup or notify room
};

// Socket Initialization
const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        socket.on('join_game', (data) => handleJoinGame(io, socket, data));
        socket.on('start_game', (data) => handleStartGame(io, socket, data));
        socket.on('submit_answer', (data) => handleSubmitAnswer(io, socket, data));
        socket.on('next_question', (data) => handleNextQuestion(io, socket, data));
        socket.on('disconnect', () => handleDisconnect(socket));
    });

    return io;
};

export default initSocket;
