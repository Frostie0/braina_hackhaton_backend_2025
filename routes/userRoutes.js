import express from 'express';
import { getUserController, registerController, loginController } from '../controllers/userControllers.js';


const router = express.Router();

router.post('/register', registerController);

router.post('/login', loginController);

router.get('/getUser/:userId', getUserController);

export default router
