import GameRoom from '../models/GameRoom.js';

// Helper functions
const generateGameCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

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

// Controllers

export const createGame = async (req, res) => {
    try {
        const { hostId, settings, questions, quizId } = req.body;
        let gameCode = generateGameCode();

        // Ensure uniqueness (simple check)
        let existing = await GameRoom.findOne({ gameCode });
        while (existing) {
            gameCode = generateGameCode();
            existing = await GameRoom.findOne({ gameCode });
        }

        const newGame = new GameRoom({
            gameCode,
            hostId,
            quizId: quizId || '',
            settings,
            questions,
            gameState: 'waiting',
            players: []
        });

        await newGame.save();
        res.status(201).json(newGame);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const joinGame = async (req, res) => {
    try {
        const { gameCode, userId, userName, socketId, isHost } = req.body;
        const gameRoom = await GameRoom.findOne({ gameCode });

        if (!gameRoom) {
            return res.status(404).json({ error: 'Partie non trouvée' });
        }

        const existingPlayer = gameRoom.players.find(p => p.userId === userId);

        if (existingPlayer) {
            existingPlayer.socketId = socketId;
            existingPlayer.isConnected = true;
            await gameRoom.save();
            return res.json(existingPlayer);
        }

        if (gameRoom.players.length >= gameRoom.settings.maxPlayers) {
            return res.status(400).json({ error: 'La partie est complète' });
        }

        const newPlayer = {
            userId,
            userName,
            socketId,
            isHost: isHost || false,
            score: 0,
            isConnected: true,
            answeredQuestions: []
        };

        gameRoom.players.push(newPlayer);
        await gameRoom.save();
        res.json(newPlayer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const leaveGame = async (req, res) => {
    try {
        const { gameCode, userId } = req.body;
        const gameRoom = await GameRoom.findOne({ gameCode });

        if (!gameRoom) return res.status(404).json({ error: 'Partie non trouvée' });

        const playerIndex = gameRoom.players.findIndex(p => p.userId === userId);
        if (playerIndex !== -1) {
            gameRoom.players.splice(playerIndex, 1);
            await gameRoom.save();
            return res.json({ message: 'Joueur retiré' });
        }
        res.status(400).json({ error: 'Joueur non trouvé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const submitAnswer = async (req, res) => {
    try {
        const { gameCode, userId, answer, timeSpent } = req.body;
        const gameRoom = await GameRoom.findOne({ gameCode });

        if (!gameRoom) return res.status(404).json({ error: 'Partie non trouvée' });

        // Vérification de l'état du jeu
        if (gameRoom.gameState !== 'playing') {
            return res.status(400).json({
                isCorrect: false,
                points: 0,
                alreadyAnswered: false,
                gameNotStarted: true
            });
        }

        const player = gameRoom.players.find(p => p.userId === userId);
        if (!player) {
            return res.status(404).json({ error: 'Joueur non trouvé' });
        }

        // Vérifier si le joueur est connecté
        if (!player.socketId) {
            return res.status(400).json({
                isCorrect: false,
                points: 0,
                alreadyAnswered: false,
                playerDisconnected: true
            });
        }

        const currentQuestion = gameRoom.questions[gameRoom.currentQuestionIndex];
        if (!currentQuestion) {
            return res.status(500).json({ error: 'Question non trouvée' });
        }

        // Vérification simple - si déjà répondu
        const alreadyAnswered = player.answeredQuestions.find(
            aq => aq.questionIndex === gameRoom.currentQuestionIndex
        );

        if (alreadyAnswered) {
            return res.json({
                isCorrect: alreadyAnswered.isCorrect,
                points: 0,
                alreadyAnswered: true
            });
        }

        // Vérifier la réponse
        const isCorrect = checkAnswer(answer, currentQuestion.correctAnswer);

        // Calculer le score
        let points = 0;
        if (isCorrect && answer !== null) {
            const basePoints = 100;
            const timeBonus = Math.max(0, gameRoom.settings.timePerQuestion - timeSpent) * 2;
            points = basePoints + timeBonus;
        }

        // Enregistrer la réponse
        player.answeredQuestions.push({
            questionIndex: gameRoom.currentQuestionIndex,
            answer: answer || '',
            isCorrect,
            timeSpent,
            timestamp: new Date()
        });

        player.score += points;

        await gameRoom.save();

        res.json({ isCorrect, points, alreadyAnswered: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const startGame = async (req, res) => {
    try {
        const { gameCode } = req.body;
        const gameRoom = await GameRoom.findOne({ gameCode });

        if (!gameRoom) return res.status(404).json({ error: 'Partie non trouvée' });

        gameRoom.gameState = 'playing';
        gameRoom.startTime = new Date();
        gameRoom.questionStartTime = new Date();
        gameRoom.currentQuestionIndex = 0;

        await gameRoom.save();
        res.json({ message: 'Partie démarrée', gameRoom });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const nextQuestion = async (req, res) => {
    try {
        const { gameCode } = req.body;
        const gameRoom = await GameRoom.findOne({ gameCode });

        if (!gameRoom) return res.status(404).json({ error: 'Partie non trouvée' });

        if (gameRoom.currentQuestionIndex < gameRoom.questions.length - 1) {
            gameRoom.currentQuestionIndex++;
            gameRoom.questionStartTime = new Date();
            await gameRoom.save();
            return res.json({ message: 'Question suivante', questionIndex: gameRoom.currentQuestionIndex });
        }

        res.json({ message: 'Fin des questions', ended: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const endGame = async (req, res) => {
    try {
        const { gameCode } = req.body;
        const gameRoom = await GameRoom.findOne({ gameCode });

        if (!gameRoom) return res.status(404).json({ error: 'Partie non trouvée' });

        gameRoom.gameState = 'ended';
        gameRoom.endTime = new Date();

        // Calculate results logic inline or helper
        const results = gameRoom.players.filter(p => p.isConnected).map(player => {
            const correctAnswers = player.answeredQuestions.filter(aq => aq.isCorrect).length;
            const totalAnswers = player.answeredQuestions.length;
            const averageTime = totalAnswers > 0
                ? player.answeredQuestions.reduce((sum, aq) => sum + aq.timeSpent, 0) / totalAnswers
                : 0;

            return {
                userId: player.userId,
                userName: player.userName,
                score: player.score,
                correctAnswers,
                totalAnswers,
                averageTime: Math.round(averageTime * 100) / 100,
            };
        });

        results.sort((a, b) => b.score - a.score);
        results.forEach((result, index) => {
            result.rank = index + 1;
        });

        gameRoom.finalResults = results;
        await gameRoom.save();

        res.json({ message: 'Partie terminée', results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getGameStatus = async (req, res) => {
    try {
        const { gameCode } = req.params;
        const gameRoom = await GameRoom.findOne({ gameCode });

        if (!gameRoom) return res.status(404).json({ error: 'Partie non trouvée' });

        res.json(gameRoom);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
