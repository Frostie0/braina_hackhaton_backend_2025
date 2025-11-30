import express from 'express';
import { getQuizController, getAllQuizUserController, createQuizController, deleteQuizController, incrementPlayedCountController } from '../controllers/quizControllers.js';


const router = express.Router();

// router.post('/register', registerController);

// router.post('/login', loginController);

router.get('/getQuiz/:quizId', getQuizController);

router.get('/getAllQuizByUser/:userId', getAllQuizUserController);

router.post('/create', createQuizController);

router.delete('/delete/:quizId', deleteQuizController);

router.post('/incrementPlayed', incrementPlayedCountController);

export default router
