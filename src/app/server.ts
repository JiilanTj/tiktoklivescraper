import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Map untuk menyimpan koneksi aktif
const activeConnections = new Map();
// Map untuk menyimpan gift terakhir per user
const lastGiftData = new Map();
// Set untuk menyimpan UUID gift yang sudah diproses
const processedUuids = new Set<string>();

// State untuk menyimpan data user
interface UserActivity {
  username: string;
  userId: string;
  timestamp: Date;
  type: 'chat' | 'like';
}

interface GiftUser {
  username: string;
  userId: string;
  totalDiamonds: number;
  lastGiftTime: Date;
}

// Array untuk menyimpan aktivitas user (chat dan like)
let userActivities: UserActivity[] = [];
// Map untuk menyimpan data gift user
const giftUsers = new Map<string, GiftUser>();

app.use(cors());
app.use(express.json());

// Basic REST endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint untuk mendapatkan data user Baris 2 dan 3 (24 user terakhir yang like dan komen)
app.get('/api/users/activities', (req, res) => {
  // Ambil 24 user terakhir yang like atau komen, urutkan berdasarkan timestamp terbaru
  const latestUsers = userActivities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 24);
  
  res.json(latestUsers);
});

// Endpoint untuk mendapatkan data user Baris 1 (gift givers)
app.get('/api/users/gifts', (req, res) => {
  // Convert Map ke Array dan urutkan berdasarkan total diamonds
  const giftUsersArray = Array.from(giftUsers.values())
    .sort((a, b) => b.totalDiamonds - a.totalDiamonds);
  
  res.json(giftUsersArray);
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('A user connected to Socket.IO');

  socket.on('update-baris2', (data: any) => {
    console.log('Received Baris 2 update:', data);
    // Broadcast to all connected clients
    io.emit('baris2-update', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from Socket.IO');
  });

  socket.on('tiktok-chat', (data: any) => {
    // Tambah ke array aktivitas
    userActivities.push({
      username: data.nickname,
      userId: data.userId,
      timestamp: new Date(),
      type: 'chat'
    });

    // Broadcast ke semua client
    io.emit('tiktok-chat', {
      username: data.nickname,
      message: data.comment,
      userId: data.userId
    });
  });

  socket.on('tiktok-like', (data: any) => {
    // Tambah ke array aktivitas
    userActivities.push({
      username: data.nickname,
      userId: `like_${data.nickname}`, // Unique ID untuk like
      timestamp: new Date(),
      type: 'like'
    });

    // Broadcast ke semua client
    io.emit('tiktok-like', {
      username: data.nickname,
      likes: data.likeCount
    });
  });

  socket.on('tiktok-gift', (data: any) => {
    if (!processedUuids.has(data.uuid)) {
      processedUuids.add(data.uuid);
      
      // Hitung total diamonds untuk gift ini
      const giftValue = data.diamondCount * (data.repeatCount || 1);

      // Update atau tambah gift user
      const existingUser = giftUsers.get(data.userId);
      if (existingUser) {
        existingUser.totalDiamonds += giftValue;
        existingUser.lastGiftTime = new Date();
        giftUsers.set(data.userId, existingUser);
      } else {
        giftUsers.set(data.userId, {
          username: data.nickname,
          userId: data.userId,
          totalDiamonds: giftValue,
          lastGiftTime: new Date()
        });
      }

      // Broadcast gift event
      io.emit('tiktok-gift', {
        username: data.nickname,
        userId: data.userId,
        giftId: data.giftId,
        giftName: data.giftName,
        diamonds: data.diamondCount,
        repeatCount: data.repeatCount || 1,
        timestamp: Date.now(),
        uuid: data.uuid,
        timeSinceLastGift: 0
      });
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}); 