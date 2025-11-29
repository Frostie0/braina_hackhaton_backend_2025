// Import des dépendances
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import { Server } from 'socket.io';
import http from 'http';


import initSocket from './config/socket.js';


// Configurer dotenv et la connexion à la base de données
dotenv.config();
connectDB();

// Initialiser l'application Express
const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(cors());
app.use(cookieParser());

// Import des routes
import userRoutes from './routes/userRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import gameRoomRoutes from './routes/gameRoomRoutes.js';

//home
app.get("/", (req, res) => {
    res.status(200).send({
        "msg": "Node Server Running"
    })
})

//ping
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Routes API
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/quiz", quizRoutes);
app.use("/api/v1/game", gameRoomRoutes);

// Créer un serveur HTTP à partir de l'application Express
const server = http.createServer(app);

const io = initSocket(server);

// Définir le port
const PORT = process.env.PORT || 8000;

// Démarrer le serveur (API + WebSocket sur le même port)
server.listen(PORT, () => {
    console.log(`Le serveur fonctionne sur le port ${PORT}`);
});
