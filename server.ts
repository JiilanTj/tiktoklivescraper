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

app.use(cors());
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
        timeout: 10000,  // Increased timeout
        retries: 5      // Increased retries
      }
    });

    // Connect ke live stream
    try {
      await tiktokLiveConnection.connect();
      console.log(`Successfully connected to ${username}'s live stream`);
    } catch (error: unknown) {
      console.error('Connection error:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('User not found')) {
          return res.status(404).json({ 
            error: 'TikTok user not found or username is incorrect' 
          });
        }
        if (error.message.includes('Failed to retrieve the initial room data')) {
          return res.status(400).json({ 
            error: 'User is not currently live streaming or stream is private' 
          });
        }
        if (error.message.includes('timeout')) {
          return res.status(408).json({ 
            error: 'Connection timed out. Please try again.' 
          });
        }
      }
      
      // Generic error response
      return res.status(500).json({ 
        error: 'Failed to connect to TikTok live stream. Please check if the user is live and try again.' 
      });
    }

    // Simpan koneksi di map
    activeConnections.set(username, tiktokLiveConnection);

    // Event handlers untuk TikTok Live events
    tiktokLiveConnection.on('chat', data => {
      console.log('Chat received:', data);
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

  socket.on('disconnect', () => {
    console.log('User disconnected from Socket.IO');
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}); 