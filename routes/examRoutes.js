import express from 'express';
import { createExamController, getExamController, getUserExamsController, correctExamController, deleteExamController } from '../controllers/examController.js';

const router = express.Router();

router.post('/create', createExamController);
router.post('/correct', correctExamController);
router.get('/user/:userId', getUserExamsController);
router.get('/:examId', getExamController);
router.delete('/:examId', deleteExamController);

export default router;
