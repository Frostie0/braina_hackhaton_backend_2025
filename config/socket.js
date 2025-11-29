import { Server } from 'socket.io';
import GameRoom from '../models/GameRoom.js';

// Etat en mémoire pour TicTacToe
const tttRooms = new Map();

const initTttRoom = (gameCode) => {
    const state = {
        grid: Array(9).fill(null), // 'X' | 'O' | null
        symbols: {}, // userId -> 'X' | 'O'
        hearts: {}, // userId -> number
        currentTurn: 'X',
        winner: null, // { userId, symbol } | 'Draw' | null
        turnStart: Date.now(),
    };
    tttRooms.set(gameCode, state);
    return state;
};

const emitTttState = (io, gameCode) => {
    const s = tttRooms.get(gameCode);
    if (!s) return;
    io.to(gameCode).emit('ttt_state', {
        grid: s.grid,
        currentTurn: s.currentTurn,
        hearts: s.hearts,
        symbols: s.symbols,
        winner: s.winner,
        turnStart: s.turnStart,
    });
};

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
    console.log('\n🎮 ========================================');
    console.log('📥 JOIN_GAME EVENT RECEIVED');
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Game Code: ${gameCode}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   User Name: ${userName}`);
    console.log(`   Is Host: ${isHost}`);
    console.log('========================================\n');

    try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
            console.error(`❌ Game room not found: ${gameCode}`);
            socket.emit('error', { message: 'Partie non trouvée' });
            return;
        }

        console.log(`✅ Game room found: ${gameCode}`);
        console.log(`   Current state: ${gameRoom.gameState}`);
        console.log(`   Current players: ${gameRoom.players.length}/${gameRoom.settings.maxPlayers}`);

        socket.join(gameCode);
        console.log(`✅ Socket ${socket.id} joined room ${gameCode}`);

        const existingPlayer = gameRoom.players.find(p => p.userId === userId);
        if (existingPlayer) {
            console.log(`🔄 Existing player reconnecting: ${userName}`);
            existingPlayer.socketId = socket.id;
            existingPlayer.isConnected = true;
        } else {
            if (gameRoom.players.length >= gameRoom.settings.maxPlayers) {
                console.error(`❌ Room is full: ${gameRoom.players.length}/${gameRoom.settings.maxPlayers}`);
                socket.emit('error', { message: 'La partie est complète' });
                return;
            }
            console.log(`➕ Adding new player: ${userName}`);
            gameRoom.players.push({
                userId,
                userName,
                socketId: socket.id,
                isHost: isHost || false,
                score: 0,
                isConnected: true,
                answeredQuestions: []
            });

        // TicTacToe: timeout de tour (aucune case choisie dans le temps imparti)
        socket.on('ttt_turn_timeout', (data) => {
            try {
                const { gameCode } = data || {};
                const s = tttRooms.get(gameCode);
                if (!s || s.winner) return;
                // Trouver le joueur courant par symbole
                const currentSymbol = s.currentTurn; // 'X' ou 'O'
                const currentUserId = Object.keys(s.symbols).find(uid => s.symbols[uid] === currentSymbol);
                if (!currentUserId) return;
                // Perdre un coeur
                s.hearts[currentUserId] = Math.max(0, (s.hearts[currentUserId] || 5) - 1);
                if (s.hearts[currentUserId] === 0) {
                    const opponentSymbol = currentSymbol === 'X' ? 'O' : 'X';
                    const opponentId = Object.keys(s.symbols).find(uid => s.symbols[uid] === opponentSymbol);
                    if (opponentId) s.winner = { userId: opponentId, symbol: opponentSymbol };
                    emitTttState(io, gameCode);
                    io.to(gameCode).emit('ttt_gameover', { winner: s.winner });
                    return;
                }
                // Sinon, passer le tour
                s.currentTurn = currentSymbol === 'X' ? 'O' : 'X';
                s.turnStart = Date.now();
                emitTttState(io, gameCode);
            } catch (e) {
                console.error('❌ Error in ttt_turn_timeout:', e);
            }
        });
        }

        await gameRoom.save();
        console.log(`💾 Game room saved`);

        const connectedPlayers = gameRoom.players.filter(p => p.isConnected);
        console.log(`👥 Connected players (${connectedPlayers.length}):`);
        connectedPlayers.forEach(p => {
            console.log(`   - ${p.userName} (${p.userId}) ${p.isHost ? '👑 HOST' : ''}`);
        });

        // Emit to everyone in the room that a player joined/updated
        io.to(gameCode).emit('player_joined', {
            players: connectedPlayers
        });
        console.log(`📤 Emitted 'player_joined' to room ${gameCode}`);

        // Send current game state to the joining player
        socket.emit('game_state', gameRoom);
        console.log(`📤 Emitted 'game_state' to ${userName}`);

    } catch (error) {
        console.error('❌ Error in join_game:', error);
        socket.emit('error', { message: 'Erreur lors de la connexion à la partie' });
    }
};

const handleStartGame = async (io, socket, { gameCode }) => {
    console.log('\n🚀 ========================================');
    console.log('📥 START_GAME EVENT RECEIVED');
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Game Code: ${gameCode}`);
    console.log('========================================\n');

    try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
            console.error(`❌ Game room not found: ${gameCode}`);
            return;
        }

        console.log(`✅ Game room found: ${gameCode}`);
        console.log(`   Players ready: ${gameRoom.players.filter(p => p.isConnected).length}`);
        console.log(`   Total questions: ${gameRoom.questions.length}`);

        gameRoom.gameState = 'playing';
        gameRoom.startTime = new Date();
        gameRoom.questionStartTime = new Date();
        gameRoom.currentQuestionIndex = 0;

        await gameRoom.save();
        console.log(`💾 Game started and saved`);
        console.log(`   Start time: ${gameRoom.startTime}`);
        console.log(`   First question index: ${gameRoom.currentQuestionIndex}`);

        io.to(gameCode).emit('game_started', {
            startTime: gameRoom.startTime,
            questionIndex: 0
        });
        console.log(`📤 Emitted 'game_started' to all players in ${gameCode}`);

        // Initialiser l'état TicTacToe pour cette room
        const state = initTttRoom(gameCode);
        try {
            // Assigner symboles de base: premier connecté (host) 'X', deuxième 'O'
            const connected = gameRoom.players.filter(p => p.isConnected);
            if (connected.length > 0) state.symbols[connected[0].userId] = 'X';
            if (connected.length > 1) state.symbols[connected[1].userId] = 'O';
            // Coeurs initiaux
            connected.forEach(p => state.hearts[p.userId] = 5);
            state.currentTurn = 'X';
            state.turnStart = Date.now();
        } catch {}
        emitTttState(io, gameCode);

    } catch (error) {
        console.error('❌ Error in start_game:', error);
    }
};

const handleSubmitAnswer = async (io, socket, { gameCode, userId, answer, timeSpent }) => {
    console.log('\n📝 ========================================');
    console.log('📥 SUBMIT_ANSWER EVENT RECEIVED');
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Game Code: ${gameCode}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Answer: ${answer}`);
    console.log(`   Time Spent: ${timeSpent}s`);
    console.log('========================================\n');

    try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
            console.error(`❌ Game room not found: ${gameCode}`);
            return;
        }
        if (gameRoom.gameState !== 'playing') {
            console.warn(`⚠️ Game not in playing state: ${gameRoom.gameState}`);
            return;
        }

        const player = gameRoom.players.find(p => p.userId === userId);
        if (!player) {
            console.error(`❌ Player not found: ${userId}`);
            return;
        }

        console.log(`✅ Player found: ${player.userName}`);

        // Check if already answered
        const alreadyAnswered = player.answeredQuestions.find(
            aq => aq.questionIndex === gameRoom.currentQuestionIndex
        );
        if (alreadyAnswered) {
            console.warn(`⚠️ Player ${player.userName} already answered question ${gameRoom.currentQuestionIndex}`);
            return;
        }

        const currentQuestion = gameRoom.questions[gameRoom.currentQuestionIndex];
        const isCorrect = checkAnswer(answer, currentQuestion.correctAnswer);

        let points = 0;
        if (isCorrect && answer !== null) {
            const basePoints = 100;
            const timeBonus = Math.max(0, gameRoom.settings.timePerQuestion - timeSpent) * 2;
            points = basePoints + timeBonus;
        }

        console.log(`${isCorrect ? '✅' : '❌'} Answer is ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`   Points earned: ${points}`);
        console.log(`   Previous score: ${player.score}`);
        console.log(`   New score: ${player.score + points}`);

        player.answeredQuestions.push({
            questionIndex: gameRoom.currentQuestionIndex,
            answer: answer || '',
            isCorrect,
            timeSpent,
            timestamp: new Date()
        });
        player.score += points;

        await gameRoom.save();
        console.log(`💾 Answer saved for ${player.userName}`);

        // Notify that this player answered
        io.to(gameCode).emit('player_answered', {
            userId,
            hasAnswered: true
        });
        console.log(`📤 Emitted 'player_answered' for ${player.userName}`);

        // Check if all players answered
        const connectedPlayers = gameRoom.players.filter(p => p.isConnected);
        const answeredCount = connectedPlayers.filter(p =>
            p.answeredQuestions.some(aq => aq.questionIndex === gameRoom.currentQuestionIndex)
        ).length;

        console.log(`📊 Answer progress: ${answeredCount}/${connectedPlayers.length} players answered`);

        const allAnswered = answeredCount === connectedPlayers.length;

        if (allAnswered) {
            console.log(`✅ All players have answered question ${gameRoom.currentQuestionIndex}`);
            io.to(gameCode).emit('all_answered', {
                questionIndex: gameRoom.currentQuestionIndex
            });
            console.log(`📤 Emitted 'all_answered'`);
        }

    } catch (error) {
        console.error('❌ Error in submit_answer:', error);
    }
};

const handleNextQuestion = async (io, socket, { gameCode }) => {
    console.log('\n⏭️ ========================================');
    console.log('📥 NEXT_QUESTION EVENT RECEIVED');
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Game Code: ${gameCode}`);
    console.log('========================================\n');

    try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
            console.error(`❌ Game room not found: ${gameCode}`);
            return;
        }

        console.log(`✅ Game room found: ${gameCode}`);
        console.log(`   Current question: ${gameRoom.currentQuestionIndex + 1}/${gameRoom.questions.length}`);

        if (gameRoom.currentQuestionIndex < gameRoom.questions.length - 1) {
            gameRoom.currentQuestionIndex++;
            gameRoom.questionStartTime = new Date();
            await gameRoom.save();

            console.log(`➡️ Moving to next question: ${gameRoom.currentQuestionIndex + 1}/${gameRoom.questions.length}`);
            console.log(`   Question start time: ${gameRoom.questionStartTime}`);

            io.to(gameCode).emit('new_question', {
                questionIndex: gameRoom.currentQuestionIndex,
                startTime: gameRoom.questionStartTime
            });
            console.log(`📤 Emitted 'new_question' to all players`);

        } else {
            console.log(`🏁 Last question reached - ending game`);

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

            console.log(`📊 Final Results:`);
            results.forEach(r => {
                console.log(`   ${r.rank}. ${r.userName} - ${r.score} points (${r.correctAnswers}/${r.totalAnswers} correct)`);
            });

            io.to(gameCode).emit('game_ended', { results });
            console.log(`📤 Emitted 'game_ended' with final results`);
        }
    } catch (error) {
        console.error('❌ Error in next_question:', error);
    }
};

const handleDisconnect = async (socket) => {
    console.log('\n🔌 ========================================');
    console.log('❌ CLIENT DISCONNECTED');
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log('========================================\n');
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

    console.log('\n🌐 ========================================');
    console.log('✅ SOCKET.IO SERVER INITIALIZED');
    console.log('   CORS: Enabled for all origins');
    console.log('   Methods: GET, POST');
    console.log('========================================\n');

    io.on('connection', (socket) => {
        console.log('\n🔌 ========================================');
        console.log('✅ NEW CLIENT CONNECTED');
        console.log(`   Socket ID: ${socket.id}`);
        console.log(`   Time: ${new Date().toISOString()}`);
        console.log('========================================\n');

        socket.on('join_game', (data) => {
            handleJoinGame(io, socket, data);
            // Assigner un symbole si non attribué et si la room existe déjà
            try {
                const { gameCode, userId } = data || {};
                if (!gameCode || !userId) return;
                const s = tttRooms.get(gameCode);
                if (s) {
                    if (!s.symbols[userId]) {
                        const used = Object.values(s.symbols);
                        s.symbols[userId] = used.includes('X') ? 'O' : 'X';
                        if (!s.hearts[userId]) s.hearts[userId] = 5;
                        emitTttState(io, gameCode);
                    }
                }
            } catch {}
        });
        socket.on('start_game', (data) => handleStartGame(io, socket, data));
        socket.on('submit_answer', (data) => handleSubmitAnswer(io, socket, data));
        socket.on('next_question', (data) => handleNextQuestion(io, socket, data));
        // TicTacToe: réponse validée côté client -> serveur arbitre et diffuse
        socket.on('tictactoe_answer', (data) => {
            try {
                const { gameCode, userId, index, correct } = data || {};
                if (!gameCode || !userId || typeof index !== 'number') return;
                const s = tttRooms.get(gameCode);
                if (!s || s.winner) return;
                const userSymbol = s.symbols[userId];
                if (!userSymbol) return;
                // Tour strict
                if (s.currentTurn !== userSymbol) return;
                // Case déjà prise
                if (s.grid[index]) return;

                if (correct) {
                    s.grid[index] = userSymbol;
                    // Check win
                    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
                    const win = lines.some(([a,b,c]) => s.grid[a]===userSymbol && s.grid[b]===userSymbol && s.grid[c]===userSymbol);
                    if (win) {
                        s.winner = { userId, symbol: userSymbol };
                        emitTttState(io, gameCode);
                        io.to(gameCode).emit('ttt_gameover', { winner: s.winner });
                        return;
                    }
                    // Match nul
                    if (s.grid.every(cell => cell)) {
                        s.winner = 'Draw';
                        emitTttState(io, gameCode);
                        io.to(gameCode).emit('ttt_gameover', { winner: 'Draw' });
                        return;
                    }
                    // Tour suivant
                    s.currentTurn = (userSymbol === 'X') ? 'O' : 'X';
                    s.turnStart = Date.now();
                    emitTttState(io, gameCode);
                } else {
                    // Mauvaise réponse: perdre un coeur
                    s.hearts[userId] = Math.max(0, (s.hearts[userId] || 5) - 1);
                    // Si plus de coeur, l'autre gagne
                    if (s.hearts[userId] === 0) {
                        const opponentSymbol = userSymbol === 'X' ? 'O' : 'X';
                        const opponentId = Object.keys(s.symbols).find(uid => s.symbols[uid] === opponentSymbol);
                        if (opponentId) s.winner = { userId: opponentId, symbol: opponentSymbol };
                        emitTttState(io, gameCode);
                        io.to(gameCode).emit('ttt_gameover', { winner: s.winner });
                        return;
                    }
                    // Sinon, tour suivant
                    s.currentTurn = (userSymbol === 'X') ? 'O' : 'X';
                    s.turnStart = Date.now();
                    emitTttState(io, gameCode);
                }
            } catch (e) {
                console.error('❌ Error in tictactoe_answer:', e);
            }
        });
        socket.on('disconnect', () => handleDisconnect(socket));
    });

    return io;
};

export default initSocket;
