// apps/server/src/index.ts
import * as express from 'express';
import * as http from 'http';
import { Server } from 'socket.io';
import * as cors from 'cors';
import { handleRoomEvents } from './sockets/roomHandler';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*', // Uses environment variable or allows all
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e7, // 10 MB limit to prevent large Base64 canvas frames from dropping
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Delegate room and sync events to our handler
  handleRoomEvents(io, socket);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Socket server running on port ${PORT}`);
});
