import { Server } from 'socket.io';

// Etat minimal en mémoire pour TicTacToe
const rooms = new Map();

function getRoom(gameCode) {
    if (!rooms.has(gameCode)) {
        rooms.set(gameCode, {
            grid: Array(9).fill(null), // 'X' | 'O' | null
            symbols: {}, // userId -> 'X' | 'O'
            currentTurn: 'X',
            winner: null, // { userId, symbol } | 'Draw' | null
            turnStart: Date.now(),
            turnDuration: 15, // secondes par tour (par défaut)
            timer: null, // interval handle
            users: {}, // userId -> { userName, socketId, isHost, isConnected }
            gameState: 'waiting', // 'waiting' | 'playing' | 'ended'
        });
    }
    return rooms.get(gameCode);
}

function emitState(io, gameCode) {
    const s = rooms.get(gameCode);
    if (!s) return;
    io.to(gameCode).emit('ttt_state', {
        grid: s.grid,
        currentTurn: s.currentTurn,
        symbols: s.symbols,
        winner: s.winner,
        turnStart: s.turnStart,
        turnDuration: s.turnDuration,
    });
}

function emitWaiting(io, gameCode) {
    const s = rooms.get(gameCode);
    if (!s) return;
    const players = Object.keys(s.users).map((uid) => ({
        userId: uid,
        userName: s.users[uid]?.userName,
        socketId: s.users[uid]?.socketId,
        isHost: !!s.users[uid]?.isHost,
        isConnected: !!s.users[uid]?.isConnected,
    }));
    io.to(gameCode).emit('player_joined', { players });
    io.to(gameCode).emit('game_state', { gameState: s.gameState, players });
}

function checkWin(grid, sym) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];
    return lines.some(([a, b, c]) => grid[a] === sym && grid[b] === sym && grid[c] === sym);
}

const initSocket = (server) => {
    const io = new Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    io.on('connection', (socket) => {
        const startTurnTimer = (gameCode) => {
            const s = rooms.get(gameCode);
            if (!s) return;
            // Nettoyer un timer existant
            if (s.timer) {
                clearInterval(s.timer);
                s.timer = null;
            }
            // Redémarrer le timer à partir de maintenant
            s.turnStart = Date.now();
            s.timer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - s.turnStart) / 1000);
                if (s.winner) {
                    clearInterval(s.timer);
                    s.timer = null;
                    return;
                }
                if (elapsed >= s.turnDuration) {
                    // Temps écoulé -> passer le tour
                    s.currentTurn = s.currentTurn === 'X' ? 'O' : 'X';
                    s.turnStart = Date.now();
                    emitState(io, gameCode);
                }
            }, 1000);
        };

        const stopTurnTimer = (gameCode) => {
            const s = rooms.get(gameCode);
            if (s && s.timer) {
                clearInterval(s.timer);
                s.timer = null;
            }
        };

        // Un joueur rejoint une room et reçoit/partage l'état
        socket.on('join_game', ({ gameCode, userId, userName, timePerTurn, isHost }) => {
            if (!gameCode || !userId) return;

            console.log(`🔵 [JOIN_GAME] User ${userId} (${userName}) joining room ${gameCode} (isHost: ${isHost})`);

            const room = getRoom(gameCode);
            socket.join(gameCode);

            // Vérifier que le socket a bien rejoint la room
            const socketRooms = Array.from(socket.rooms);
            console.log(`🔵 [JOIN_GAME] Socket ${socket.id} rooms:`, socketRooms);

            // Attribuer un symbole si disponible
            if (!room.symbols[userId]) {
                const used = Object.values(room.symbols);
                if (!used.includes('X')) room.symbols[userId] = 'X';
                else if (!used.includes('O')) room.symbols[userId] = 'O';
                // sinon: spectateur (pas de symbole)
                console.log(`🔵 [JOIN_GAME] Assigned symbol ${room.symbols[userId]} to ${userId}`);
            } else {
                console.log(`🔵 [JOIN_GAME] User ${userId} already has symbol ${room.symbols[userId]}`);
            }

            // Configurer la durée de tour si fournie
            if (typeof timePerTurn === 'number' && timePerTurn > 0 && timePerTurn < 600) {
                room.turnDuration = Math.floor(timePerTurn);
            }

            // Mettre à jour les utilisateurs de la salle (waiting room)
            room.users[userId] = {
                userName: userName || userId,
                socketId: socket.id,
                isHost: !!isHost,
                isConnected: true,
            };

            console.log(`🔵 [JOIN_GAME] Room ${gameCode} now has ${Object.keys(room.users).length} users:`, Object.keys(room.users));

            emitState(io, gameCode);
            // Démarrer ou redémarrer le timer à l'arrivée d'un joueur
            startTurnTimer(gameCode);
            // Notifier la salle d'attente
            emitWaiting(io, gameCode);
        });

        // L'hôte démarre la partie
        socket.on('start_game', ({ gameCode }) => {
            if (!gameCode) return;
            const s = rooms.get(gameCode);
            if (!s) return;

            s.gameState = 'playing';
            io.to(gameCode).emit('game_started');
            emitWaiting(io, gameCode);
        });

        // Un joueur demande l'état courant (utile après navigation)
        socket.on('request_state', ({ gameCode }) => {
            if (!gameCode) return;
            const s = rooms.get(gameCode);
            if (!s) return;
            socket.emit('ttt_state', {
                grid: s.grid,
                currentTurn: s.currentTurn,
                symbols: s.symbols,
                winner: s.winner,
                turnStart: s.turnStart,
                turnDuration: s.turnDuration,
            });
            // Renvoyer aussi l'état d'attente pour compatibilité
            const players = Object.keys(s.users || {}).map((uid) => ({
                userId: uid,
                userName: s.users[uid]?.userName,
                socketId: s.users[uid]?.socketId,
                isHost: !!s.users[uid]?.isHost,
                isConnected: !!s.users[uid]?.isConnected,
            }));
            socket.emit('game_state', { gameState: s.gameState, players });
        });

        // Un joueur joue un coup
        socket.on('make_move', ({ gameCode, userId, index }) => {
            if (!gameCode || !userId || typeof index !== 'number') return;
            const s = rooms.get(gameCode);
            if (!s || s.winner) return;
            if (index < 0 || index > 8) return;
            if (s.grid[index]) return; // case déjà occupée

            const sym = s.symbols[userId];
            if (!sym) return; // spectateur
            if (sym !== s.currentTurn) return; // pas ton tour

            // Appliquer le coup
            s.grid[index] = sym;

            // Vérifier victoire
            if (checkWin(s.grid, sym)) {
                s.winner = { userId, symbol: sym };
                emitState(io, gameCode);
                io.to(gameCode).emit('ttt_gameover', { winner: s.winner });
                stopTurnTimer(gameCode);
                return;
            }

            // Vérifier match nul
            if (s.grid.every((c) => c)) {
                s.winner = 'Draw';
                emitState(io, gameCode);
                io.to(gameCode).emit('ttt_gameover', { winner: 'Draw' });
                stopTurnTimer(gameCode);
                return;
            }

            // Changer de tour
            s.currentTurn = sym === 'X' ? 'O' : 'X';
            s.turnStart = Date.now();
            emitState(io, gameCode);
            // Redémarrer le timer sur nouveau tour
            startTurnTimer(gameCode);
        });

        // Réponse incorrecte/temps écoulé -> passer immédiatement le tour
        socket.on('answer_fail', ({ gameCode, userId }) => {
            if (!gameCode || !userId) return;
            const s = rooms.get(gameCode);
            if (!s || s.winner) return;
            const sym = s.symbols[userId];
            if (!sym) return; // spectateur
            if (sym !== s.currentTurn) return; // seulement le joueur courant peut faire échouer son tour

            // Passer le tour sans jouer
            s.currentTurn = sym === 'X' ? 'O' : 'X';
            s.turnStart = Date.now();
            emitState(io, gameCode);
            startTurnTimer(gameCode);
        });

        // Un joueur quitte explicitement une room
        socket.on('leave_game', ({ gameCode, userId }) => {
            if (!gameCode || !userId) return;
            console.log(`🔴 [LEAVE_GAME] User ${userId} leaving room ${gameCode}`);
            const s = rooms.get(gameCode);
            if (!s) return;

            if (s.users[userId]) {
                s.users[userId].isConnected = false;
                emitWaiting(io, gameCode);
            }

            socket.leave(gameCode);
        });

        // Gestion de la déconnexion du socket
        socket.on('disconnect', () => {
            console.log(`🔴 [DISCONNECT] Socket ${socket.id} disconnected`);

            // Trouver toutes les rooms auxquelles ce socket appartenait
            rooms.forEach((room, gameCode) => {
                // Trouver l'userId correspondant à ce socketId
                const userId = Object.keys(room.users).find(
                    uid => room.users[uid].socketId === socket.id
                );

                if (userId && room.users[userId]) {
                    console.log(`🔴 [DISCONNECT] Marking user ${userId} as disconnected in room ${gameCode}`);
                    room.users[userId].isConnected = false;
                    emitWaiting(io, gameCode);
                }
            });
        });
    });

    return io;
};

export default initSocket;
