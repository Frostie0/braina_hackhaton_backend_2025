import { Server } from 'socket.io';

const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*", // Configure this based on your frontend URL in production
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // Handle custom events here
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });

        // Example: Echo message event
        socket.on('message', (data) => {
            console.log('Message received:', data);
            socket.emit('message', { msg: 'Message received', data });
        });
    });

    return io;
};

export default initSocket;
