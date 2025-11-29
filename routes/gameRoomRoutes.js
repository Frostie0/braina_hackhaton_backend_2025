import express from 'express';
import {
    createGame,
    joinGame,
    leaveGame,
    submitAnswer,
    startGame,
    nextQuestion,
    endGame,
    getGameStatus
} from '../controllers/gameRoomController.js';

const router = express.Router();

router.post('/create', createGame);
router.post('/join', joinGame);
router.post('/leave', leaveGame);
router.post('/submit', submitAnswer);
router.post('/start', startGame);
router.post('/next', nextQuestion);
router.post('/end', endGame);
router.get('/:gameCode', getGameStatus);

export default router;
