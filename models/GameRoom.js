import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['multiple_choice', 'true_false'],
        required: true,
    },
    question: {
        type: String,
        required: true,
    },
    options: {
        type: [String],
        default: [],
    },
    correctAnswer: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    explanation: {
        type: String,
        default: '',
    }
}, { _id: true });

const playerSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    socketId: {
        type: String,
        required: true,
    },
    score: {
        type: Number,
        default: 0,
    },
    isHost: {
        type: Boolean,
        default: false,
    },
    isConnected: {
        type: Boolean,
        default: true,
    },
    answeredQuestions: [{
        questionIndex: Number,
        answer: mongoose.Schema.Types.Mixed,
        isCorrect: Boolean,
        timeSpent: Number,
        timestamp: { type: Date, default: Date.now }
    }]
}, { _id: false });

const gameRoomSchema = new mongoose.Schema({
    gameCode: {
        type: String,
        required: true,
        // unique: true, // Removed to avoid duplicate index
    },
    hostId: {
        type: String,
        required: true,
    },
    players: [playerSchema],
    questions: [questionSchema],
    settings: {
        maxPlayers: {
            type: Number,
            default: 10,
            min: 2,
            max: 10,
        },
        timePerQuestion: {
            type: Number,
            default: 15,
            min: 5,
            max: 60,
        },
        totalQuestions: {
            type: Number,
            default: 10,
            min: 1,
            max: 50,
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard'],
            default: 'medium',
        },
        category: {
            type: String,
            default: 'general',
        }
    },
    gameState: {
        type: String,
        enum: ['waiting', 'playing', 'ended'],
        default: 'waiting',
    },
    currentQuestionIndex: {
        type: Number,
        default: 0,
    },
    startTime: {
        type: Date,
    },
    endTime: {
        type: Date,
    },
    questionStartTime: {
        type: Date,
    },
    finalResults: [{
        userId: String,
        userName: String,
        score: Number,
        correctAnswers: Number,
        totalAnswers: Number,
        averageTime: Number,
        rank: Number,
    }],
}, {
    timestamps: true,
});

// Index pour optimiser les requêtes - Gardé uniquement ici
gameRoomSchema.index({ gameCode: 1 }, { unique: true });
gameRoomSchema.index({ hostId: 1 });
gameRoomSchema.index({ gameState: 1 });
gameRoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 * 24 }); // Expire après 24h

// Méthodes du modèle
gameRoomSchema.methods.addPlayer = function (userId, userName, socketId, isHost = false) {
    const existingPlayer = this.players.find(p => p.userId === userId);

    if (existingPlayer) {
        existingPlayer.socketId = socketId;
        existingPlayer.isConnected = true;
        return existingPlayer;
    }

    if (this.players.length >= this.settings.maxPlayers) {
        throw new Error('La partie est complète');
    }

    const newPlayer = {
        userId,
        userName,
        socketId,
        isHost,
        score: 0,
        isConnected: true,
        answeredQuestions: []
    };

    this.players.push(newPlayer);
    return newPlayer;
};

gameRoomSchema.methods.removePlayer = function (userId) {
    const playerIndex = this.players.findIndex(p => p.userId === userId);
    if (playerIndex !== -1) {
        this.players.splice(playerIndex, 1);
        return true;
    }
    return false;
};

gameRoomSchema.methods.updatePlayerSocket = function (userId, socketId) {
    const player = this.players.find(p => p.userId === userId);
    if (player) {
        player.socketId = socketId;
        player.isConnected = true;
    }
};

gameRoomSchema.methods.disconnectPlayer = function (userId) {
    const player = this.players.find(p => p.userId === userId);
    if (player) {
        player.isConnected = false;
    }
};

gameRoomSchema.methods.getConnectedPlayers = function () {
    return this.players.filter(p => p.isConnected);
};

gameRoomSchema.methods.submitAnswer = function (userId, answer, timeSpent) {
    // Vérification de l'état du jeu AVANT tout
    if (this.gameState !== 'playing') {
        console.warn(`⚠️ Tentative de soumission hors jeu: ${this.gameState}`);
        return {
            isCorrect: false,
            points: 0,
            alreadyAnswered: false,
            gameNotStarted: true
        };
    }

    const player = this.players.find(p => p.userId === userId);
    if (!player) {
        console.error(`❌ Joueur non trouvé: ${userId}`);
        console.log('Joueurs disponibles:', this.players.map(p => ({ userId: p.userId, userName: p.userName })));
        throw new Error('Joueur non trouvé');
    }

    // Vérifier si le joueur est connecté
    if (!player.socketId) {
        console.warn(`⚠️ Joueur déconnecté: ${userId}`);
        return {
            isCorrect: false,
            points: 0,
            alreadyAnswered: false,
            playerDisconnected: true
        };
    }

    const currentQuestion = this.questions[this.currentQuestionIndex];
    if (!currentQuestion) {
        console.error(`❌ Question non trouvée à l'index: ${this.currentQuestionIndex}`);
        throw new Error('Question non trouvée');
    }

    // Vérification simple - si déjà répondu, ignorer silencieusement
    const alreadyAnswered = player.answeredQuestions.find(
        aq => aq.questionIndex === this.currentQuestionIndex
    );

    if (alreadyAnswered) {
        console.log(`🔄 Réponse déjà soumise par ${player.userName}`);
        return {
            isCorrect: alreadyAnswered.isCorrect,
            points: 0,
            alreadyAnswered: true
        };
    }

    // Vérifier la réponse
    const isCorrect = this.checkAnswer(answer, currentQuestion.correctAnswer);

    // Calculer le score
    let points = 0;
    if (isCorrect && answer !== null) { // Pas de points pour les réponses nulles (timeout)
        const basePoints = 100;
        const timeBonus = Math.max(0, this.settings.timePerQuestion - timeSpent) * 2;
        points = basePoints + timeBonus;
    }

    // Enregistrer la réponse
    player.answeredQuestions.push({
        questionIndex: this.currentQuestionIndex,
        answer: answer || '',
        isCorrect,
        timeSpent,
        timestamp: new Date()
    });

    player.score += points;

    console.log(`✅ Réponse soumise: ${player.userName} - Correct: ${isCorrect} - Points: ${points}`);

    return { isCorrect, points, alreadyAnswered: false };
};

gameRoomSchema.methods.checkAnswer = function (userAnswer, correctAnswer) {
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

gameRoomSchema.methods.allPlayersAnswered = function () {
    const connectedPlayers = this.getConnectedPlayers();
    return connectedPlayers.every(player =>
        player.answeredQuestions.some(aq => aq.questionIndex === this.currentQuestionIndex)
    );
};

gameRoomSchema.methods.getQuestionResults = function () {
    const results = this.getConnectedPlayers().map(player => {
        const answer = player.answeredQuestions.find(
            aq => aq.questionIndex === this.currentQuestionIndex
        );

        return {
            userId: player.userId,
            userName: player.userName,
            score: player.score,
            answer: answer ? answer.answer : null,
            isCorrect: answer ? answer.isCorrect : false,
            timeSpent: answer ? answer.timeSpent : this.settings.timePerQuestion,
        };
    });

    return results.sort((a, b) => b.score - a.score);
};

gameRoomSchema.methods.calculateFinalResults = function () {
    const results = this.getConnectedPlayers().map(player => {
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

    // Trier par score décroissant
    results.sort((a, b) => b.score - a.score);

    // Ajouter les rangs
    results.forEach((result, index) => {
        result.rank = index + 1;
    });

    this.finalResults = results;
    return results;
};

gameRoomSchema.methods.nextQuestion = function () {
    if (this.currentQuestionIndex < this.questions.length - 1) {
        this.currentQuestionIndex++;
        this.questionStartTime = new Date();
        return true;
    }
    return false;
};

gameRoomSchema.methods.startGame = function () {
    this.gameState = 'playing';
    this.startTime = new Date();
    this.questionStartTime = new Date();
    this.currentQuestionIndex = 0;
};

gameRoomSchema.methods.endGame = function () {
    this.gameState = 'ended';
    this.endTime = new Date();
    return this.calculateFinalResults();
};

// Méthodes statiques
gameRoomSchema.statics.generateGameCode = function () {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

gameRoomSchema.statics.findByGameCode = function (gameCode) {
    return this.findOne({ gameCode: gameCode.toUpperCase() });
};

const GameRoom = mongoose.model('GameRoom', gameRoomSchema);

export default GameRoom;