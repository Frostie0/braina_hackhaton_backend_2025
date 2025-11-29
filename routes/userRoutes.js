import express from 'express';
import { getUserController, registerController, loginController, getMeController } from '../controllers/userControllers.js';
import { protect } from '../middleware/authMiddleware.js';


const router = express.Router();

router.post('/register', registerController);

router.post('/login', loginController);

router.get('/me', protect, getMeController);

router.get('/getUser/:userId', getUserController);

export default router
