var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
app.post('/api/tiktok/connect', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            yield tiktokLiveConnection.connect();
            console.log(`Successfully connected to ${username}'s live stream`);
        }
        catch (error) {
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
        tiktokLiveConnection.on('error', (error) => {
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
    }
    catch (error) {
        console.error('Failed to connect:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect to TikTok live stream';
        res.status(500).json({ error: errorMessage });
    }
}));
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
    }
    else {
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
