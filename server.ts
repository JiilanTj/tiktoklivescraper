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
    } catch (error: unknown) {
      console.error('Connection error:', error);
      if (error instanceof Error && error.message.includes('User not found')) {
        return res.status(404).json({ error: 'TikTok user not found or not currently live streaming' });
      }
      throw error;
    }

    // Simpan koneksi di map
    activeConnections.set(username, tiktokLiveConnection);

    // Event handlers untuk TikTok Live events
    tiktokLiveConnection.on('chat', data => {
      console.log('Chat received:', data);
      // Tambah ke array aktivitas
      userActivities.push({
        username: data.nickname,
        userId: data.userId,
        timestamp: new Date(),
        type: 'chat'
      });

      // Batasi array ke 100 item terakhir untuk manajemen memori
      if (userActivities.length > 100) {
        userActivities = userActivities.slice(-100);
      }

      // Broadcast ke semua client
      io.emit('tiktok-chat', {
        username: data.nickname,
        message: data.comment,
        userId: data.userId
      });
    });

    tiktokLiveConnection.on('gift', data => {
      const now = Date.now();
      
      // Buat key unik untuk gift ini
      const giftKey = `${data.userId}_${data.giftId}_${data.giftName}`;
      const lastGift = lastGiftData.get(giftKey);
      
      // Cek apakah ini gift yang sama dalam interval 5 detik
      if (lastGift && (now - lastGift.timestamp) < 5000) {
        console.log('Skipping duplicate gift:', {
          nickname: data.nickname,
          giftName: data.giftName,
          timeSinceLastGift: now - lastGift.timestamp
        });
        return;
      }

      // Update data gift terakhir
      lastGiftData.set(giftKey, {
        timestamp: now,
        data: data
      });

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

      console.log('Processing gift:', {
        nickname: data.nickname,
        giftName: data.giftName,
        diamonds: data.diamondCount,
        repeatCount: data.repeatCount
      });
      
      io.emit('tiktok-gift', {
        username: data.nickname,
        userId: data.userId,
        giftId: data.giftId,
        giftName: data.giftName,
        diamonds: data.diamondCount,
        repeatCount: data.repeatCount || 1,
        timestamp: now,
        uuid: uuidv4(),
        timeSinceLastGift: lastGift ? now - lastGift.timestamp : 0
      });
    });

    tiktokLiveConnection.on('like', data => {
      console.log('Like received:', data);
      const timestamp = Date.now();
      // Tambah ke array aktivitas
      userActivities.push({
        username: data.nickname,
        userId: `like_${data.nickname}_${timestamp}`, // Tambahkan timestamp untuk unique ID
        timestamp: new Date(),
        type: 'like'
      });

      // Batasi array ke 100 item terakhir untuk manajemen memori
      if (userActivities.length > 100) {
        userActivities = userActivities.slice(-100);
      }

      io.emit('tiktok-like', {
        username: data.nickname,
        likes: data.likeCount
      });
    });

    tiktokLiveConnection.on('member', data => {
      console.log('Member joined:', data);
      io.emit('tiktok-member', {
        username: data.nickname,
        memberType: data.memberType
      });
    });

    tiktokLiveConnection.on('error', (error: Error) => {
      console.error('TikTok connection error:', error);
      io.emit('tiktok-error', { error: error.message });
    });

    // Cleanup untuk lastGiftData setiap 5 menit
    const cleanupInterval = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      for (const [key, data] of lastGiftData.entries()) {
        if (data.timestamp < fiveMinutesAgo) {
          lastGiftData.delete(key);
        }
      }
    }, 5 * 60 * 1000);

    tiktokLiveConnection.on('streamEnd', () => {
      console.log(`Stream ended for username: ${username}`);
      io.emit('tiktok-stream-end', { username });
      activeConnections.delete(username);
      // Clear gift data for this stream
      lastGiftData.clear();
      clearInterval(cleanupInterval);
    });

    res.json({ success: true, message: 'Connected to TikTok live stream' });

  } catch (error: unknown) {
    console.error('Failed to connect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect to TikTok live stream';
    res.status(500).json({ error: errorMessage });
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

// Socket.IO events
io.on('connection', (socket) => {
  console.log('A user connected to Socket.IO');

  socket.on('update-baris2', (data) => {
    console.log('Received Baris 2 update:', data);
    // Broadcast to all connected clients
    io.emit('baris2-update', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from Socket.IO');
  });

  socket.on('tiktok-chat', (data) => {
    // Tambah ke array aktivitas
    userActivities.push({
      username: data.nickname,
      userId: data.userId,
      timestamp: new Date(),
      type: 'chat'
    });

    // Batasi array ke 100 item terakhir untuk manajemen memori
    if (userActivities.length > 100) {
      userActivities = userActivities.slice(-100);
    }

    // Broadcast ke semua client
    io.emit('tiktok-chat', {
      username: data.nickname,
      message: data.comment,
      userId: data.userId
    });
  });

  socket.on('tiktok-like', (data) => {
    // Tambah ke array aktivitas
    userActivities.push({
      username: data.nickname,
      userId: `like_${data.nickname}`, // Unique ID untuk like
      timestamp: new Date(),
      type: 'like'
    });

    // Batasi array ke 100 item terakhir untuk manajemen memori
    if (userActivities.length > 100) {
      userActivities = userActivities.slice(-100);
    }

    // Broadcast ke semua client
    io.emit('tiktok-like', {
      username: data.nickname,
      likes: data.likeCount
    });
  });

  socket.on('tiktok-gift', (data) => {
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
        timeSinceLastGift: 0 // Ini bisa dihitung jika diperlukan
      });
    }
  });
});

// Cleanup data setiap 5 menit
setInterval(() => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  // Cleanup user activities
  userActivities = userActivities.filter(activity => 
    activity.timestamp > fiveMinutesAgo
  );
  
  // Cleanup gift users yang tidak aktif
  for (const [userId, userData] of giftUsers.entries()) {
    if (userData.lastGiftTime < fiveMinutesAgo) {
      giftUsers.delete(userId);
    }
  }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}); 