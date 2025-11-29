import express from 'express';
import { getQuizController } from '../controllers/quizControllers.js';


const router = express.Router();

// router.post('/register', registerController);

// router.post('/login', loginController);

router.get('/getQuiz/:quizId', getQuizController);

export default router
