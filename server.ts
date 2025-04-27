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

// Pastikan CORS disetup dengan benar
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());

// Basic REST endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint untuk memulai koneksi TikTok Live
app.post('/api/tiktok/connect', async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    console.log(`Attempting to connect to TikTok Live for username: ${username}`);

    // Cek apakah sudah ada koneksi yang aktif untuk username ini
    if (activeConnections.has(username)) {
      console.log(`Connection already exists for username: ${username}`);
      return res.status(400).json({ error: 'Connection already exists for this username' });
    }

    // Buat koneksi baru ke TikTok Live
    const tiktokLiveConnection = new WebcastPushConnection(username, {
      processInitialData: true,
      enableExtendedGiftInfo: true,
      enableWebsocketUpgrade: true,
      fetchRoomInfoOnConnect: true,
      requestOptions: {
        timeout: 5000,
        retries: 3
      }
    });

    // Connect ke live stream
    try {
      await tiktokLiveConnection.connect();
      console.log(`Successfully connected to ${username}'s live stream`);
    } catch (error: any) {
      console.error('Connection error:', error);
      if (error.message?.includes('User not found')) {
        return res.status(404).json({ error: 'TikTok user not found or not currently live streaming' });
      }
      throw error;
    }

    // Simpan koneksi di map
    activeConnections.set(username, tiktokLiveConnection);

    // Event handlers untuk TikTok Live events
    tiktokLiveConnection.on('chat', data => {
      console.log(`Chat from ${data.nickname}: ${data.comment}`);
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

    tiktokLiveConnection.on('gift', data => {
      console.log(`Gift from ${data.nickname}: ${data.giftName}`);
      const now = Date.now();
      const uuid = uuidv4();

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
        timestamp: now,
        uuid: uuid,
        timeSinceLastGift: 0
      });
    });

    tiktokLiveConnection.on('like', data => {
      console.log(`Like from ${data.nickname}`);
      const timestamp = Date.now();
      // Tambah ke array aktivitas dengan unique ID menggunakan timestamp
      userActivities.push({
        username: data.nickname,
        userId: `like_${data.nickname}_${timestamp}`, // Unique ID dengan timestamp
        timestamp: new Date(),
        type: 'like'
      });

      // Broadcast ke semua client
      io.emit('tiktok-like', {
        username: data.nickname,
        likes: data.likeCount
      });
    });

    tiktokLiveConnection.on('member', data => {
      console.log(`Member joined: ${data.nickname}`);
      io.emit('tiktok-member', {
        username: data.nickname,
        memberType: data.memberType
      });
    });

    tiktokLiveConnection.on('error', error => {
      console.error('TikTok connection error:', error);
      io.emit('tiktok-error', { error: error.message });
    });

    tiktokLiveConnection.on('streamEnd', () => {
      console.log(`Stream ended for username: ${username}`);
      io.emit('tiktok-stream-end', { username });
      activeConnections.delete(username);
    });

    res.json({ success: true, message: 'Connected to TikTok live stream' });

  } catch (error: any) {
    console.error('Failed to connect:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to TikTok live stream' });
  }
});

// Endpoint untuk menghentikan koneksi TikTok Live
app.post('/api/tiktok/disconnect', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  console.log(`Attempting to disconnect from ${username}'s live stream`);
  const connection = activeConnections.get(username);
  if (connection) {
    connection.disconnect();
    activeConnections.delete(username);
    console.log(`Successfully disconnected from ${username}'s live stream`);
    res.json({ success: true, message: 'Disconnected from TikTok live stream' });
  } else {
    console.log(`No active connection found for username: ${username}`);
    res.status(404).json({ error: 'No active connection found for this username' });
  }
});

// Endpoint untuk mendapatkan data user Baris 2 dan 3 (24 user terakhir yang like dan komen)
app.get('/api/users/activities', (req, res) => {
  // Ambil 24 user terakhir yang like atau komen, urutkan berdasarkan timestamp terbaru
  const latestUsers = userActivities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 24);
  
  res.json(latestUsers);
});

// Endpoint baru untuk VIP users (di atas panggung, diamonds > 100)
app.get('/api/users/vip', (req, res) => {
  // Convert Map ke Array dan filter users dengan diamonds > 100
  const allVIPUsers = Array.from(giftUsers.values())
    .filter(user => user.totalDiamonds > 100)
    .sort((a, b) => b.totalDiamonds - a.totalDiamonds);

  // Ambil 14 VIP teratas
  const vipUsers = allVIPUsers.slice(0, 14);
  
  res.json(vipUsers);
});

// Endpoint untuk mendapatkan data user Baris 1 (gift givers)
app.get('/api/users/gifts', (req, res) => {
  // Convert Map ke Array
  const allGiftUsers = Array.from(giftUsers.values());
  
  // Filter users dengan diamonds > 100 (potential VIP)
  const vipUsers = allGiftUsers
    .filter(user => user.totalDiamonds > 100)
    .sort((a, b) => b.totalDiamonds - a.totalDiamonds);
    
  // Jika VIP users lebih dari 14, sisanya masuk ke regular gifts
  const regularGiftUsers = allGiftUsers
    .filter(user => user.totalDiamonds <= 100)
    .sort((a, b) => b.totalDiamonds - a.totalDiamonds);
    
  // Jika ada overflow dari VIP (> 14), tambahkan ke regular gifts
  const vipOverflow = vipUsers.slice(14);
  
  // Gabungkan overflow VIP dengan regular gifts dan sort berdasarkan diamonds
  const combinedGiftUsers = [...vipOverflow, ...regularGiftUsers]
    .sort((a, b) => b.totalDiamonds - a.totalDiamonds);
  
  res.json(combinedGiftUsers);
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}); 