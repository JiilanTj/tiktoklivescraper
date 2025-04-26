'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Link from 'next/link';

interface ChatMessage {
  username: string;
  message: string;
  userId: string;
  timestamp: Date;
}

interface Gift {
  username: string;
  userId: string;
  giftId: string;
  giftName: string;
  diamonds: number;
  repeatCount: number;
  timestamp: number;
  uuid: string;
  timeSinceLastGift: number;
}

interface Like {
  username: string;
  likes: number;
  timestamp: Date;
}

interface Member {
  username: string;
  memberType: string;
  timestamp: Date;
}

interface GiftAccumulation {
  username: string;
  userId: string;
  totalDiamonds: number;
  lastGiftTime: Date;
  giftCount: number;
}

interface GiftKey {
  username: string;
  giftId: string;
  timestamp: number;
}

interface UserLabel {
  username: string;
  userId: string;
  label: 'Naik ke atas panggung' | 'Baris 1' | 'Baris 2';
  lastActivity: Date;
  totalDiamonds?: number;
  isCommenter?: boolean;
  isLiker?: boolean;
}

type LabelPriority = {
  [K in UserLabel['label']]: number;
};

const MAX_TOP_USERS = 10;

let socket: Socket;

export default function TikTokLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [processedUuids, setProcessedUuids] = useState<Set<string>>(new Set());
  const [giftAccumulations, setGiftAccumulations] = useState<GiftAccumulation[]>([]);
  const [userLabels, setUserLabels] = useState<UserLabel[]>([]);

  // Refs untuk auto-scroll
  const chatRef = useRef<HTMLDivElement>(null);
  const giftsRef = useRef<HTMLDivElement>(null);
  const likesRef = useRef<HTMLDivElement>(null);

  // Definisikan label priority di luar fungsi update
  const labelPriority: LabelPriority = {
    'Naik ke atas panggung': 0,
    'Baris 1': 1,
    'Baris 2': 2
  } as const;

  const updateUserLabels = (prev: UserLabel[], newUser: UserLabel): UserLabel[] => {
    // Gabungkan user baru dengan yang lama
    let updatedUsers = [...prev.filter(u => u.userId !== newUser.userId), newUser];
    
    // Filter semua user yang memiliki total diamonds >= 100
    const eligibleTopUsers = updatedUsers
      .filter(u => (u.totalDiamonds || 0) >= 100)
      .sort((a, b) => (b.totalDiamonds || 0) - (a.totalDiamonds || 0));
    
    // Ambil 10 user teratas untuk "Naik ke atas panggung"
    const topTenUsers = eligibleTopUsers.slice(0, MAX_TOP_USERS).map(user => ({
      ...user,
      label: 'Naik ke atas panggung' as const
    }));
    
    // Sisanya masuk ke "Baris 1"
    const demotedUsers = eligibleTopUsers.slice(MAX_TOP_USERS).map(user => ({
      ...user,
      label: 'Baris 1' as const
    }));
    
    // User lain yang tidak masuk kategori di atas
    const otherUsers = updatedUsers.filter(u => (u.totalDiamonds || 0) < 100);
    
    // Gabungkan semua user dan sort berdasarkan prioritas label
    return [...topTenUsers, ...demotedUsers, ...otherUsers]
      .sort((a, b) => {
        const aPriority = labelPriority[a.label];
        const bPriority = labelPriority[b.label];
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        // Untuk label yang sama, sort berdasarkan diamonds (jika ada) atau waktu
        if (a.totalDiamonds && b.totalDiamonds) {
          return b.totalDiamonds - a.totalDiamonds;
        }
        return b.lastActivity.getTime() - a.lastActivity.getTime();
      });
  };

  useEffect(() => {
    // Initialize socket connection
    socket = io('http://localhost:5000');

    socket.on('connect', () => {
      setIsConnected(true);
      setError('');
    });

    // Emit Baris 2 data whenever userLabels changes
    const baris2Users = userLabels
      .filter(user => user.label === 'Baris 2')
      .slice(0, 28);
    
    if (baris2Users.length > 0) {
      socket.emit('update-baris2', baris2Users);
    }

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsLive(false);
      setError('Disconnected from server');
    });

    // TikTok Live events
    socket.on('tiktok-chat', (data) => {
      setChatMessages(prev => [...prev, { ...data, timestamp: new Date() }].slice(-100));
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }

      // Update user labels for commenters
      setUserLabels(prev => {
        const existingUser = prev.find(user => user.userId === data.userId);
        if (existingUser) {
          return prev.map(user =>
            user.userId === data.userId
              ? { ...user, lastActivity: new Date(), isCommenter: true }
              : user
          );
        } else {
          return [...prev, {
            username: data.username,
            userId: data.userId,
            label: 'Baris 2' as const,
            lastActivity: new Date(),
            isCommenter: true
          }];
        }
      });
    });

    socket.on('tiktok-gift', (data: Gift) => {
      if (!processedUuids.has(data.uuid)) {
        processedUuids.add(data.uuid);
        
        // Update gifts list
        setGifts(prev => [...prev, data].slice(-50));
        if (giftsRef.current) {
          giftsRef.current.scrollTop = giftsRef.current.scrollHeight;
        }

        // Hitung total diamonds untuk gift ini
        const giftValue = data.diamonds * (data.repeatCount || 1);

        // Update gift accumulations
        setGiftAccumulations(prev => {
          const existingUser = prev.find(user => user.userId === data.userId);
          
          if (existingUser) {
            // Update existing user
            const updatedAccumulations = prev.map(user => 
              user.userId === data.userId 
                ? {
                    ...user,
                    totalDiamonds: user.totalDiamonds + giftValue,
                    giftCount: user.giftCount + 1,
                    lastGiftTime: new Date(data.timestamp)
                  }
                : user
            );
            return updatedAccumulations.sort((a, b) => b.totalDiamonds - a.totalDiamonds);
          } else {
            // Add new user
            const newAccumulation = {
              username: data.username,
              userId: data.userId,
              totalDiamonds: giftValue,
              giftCount: 1,
              lastGiftTime: new Date(data.timestamp)
            };
            return [...prev, newAccumulation].sort((a, b) => b.totalDiamonds - a.totalDiamonds);
          }
        });

        // Update user labels
        setUserLabels(prev => {
          const existingUser = prev.find(user => user.userId === data.userId);
          
          let newUser: UserLabel;
          if (existingUser) {
            const totalDiamonds = (existingUser.totalDiamonds || 0) + giftValue;
            newUser = {
              ...existingUser,
              totalDiamonds,
              lastActivity: new Date(data.timestamp),
              label: totalDiamonds >= 100 ? 'Naik ke atas panggung' : 'Baris 1'
            };
          } else {
            newUser = {
              username: data.username,
              userId: data.userId,
              totalDiamonds: giftValue,
              lastActivity: new Date(data.timestamp),
              label: giftValue >= 100 ? 'Naik ke atas panggung' : 'Baris 1'
            };
          }
          
          return updateUserLabels(prev, newUser);
        });
      }
    });

    socket.on('tiktok-like', (data) => {
      setLikes(prev => [...prev, { ...data, timestamp: new Date() }].slice(-50));
      if (likesRef.current) {
        likesRef.current.scrollTop = likesRef.current.scrollHeight;
      }

      // Update user labels for likers
      setUserLabels(prev => {
        const existingUser = prev.find(user => user.username === data.username);
        if (!existingUser) {
          return [...prev, {
            username: data.username,
            userId: `like_${data.username}`,
            label: 'Baris 2' as const,
            lastActivity: new Date(),
            isLiker: true
          }];
        }
        return prev;
      });
    });

    socket.on('tiktok-member', (data) => {
      setMembers(prev => [...prev, { ...data, timestamp: new Date() }].slice(-50));
      if (likesRef.current) {
        likesRef.current.scrollTop = likesRef.current.scrollHeight;
      }
    });

    socket.on('tiktok-error', (data) => {
      setError(data.error);
      setIsLive(false);
      setIsLoading(false);
    });

    socket.on('tiktok-stream-end', () => {
      setError('Live stream ended');
      setIsLive(false);
      setIsLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const connectToTikTok = async () => {
    if (!tiktokUsername) {
      setError('Please enter a TikTok username');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/tiktok/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: tiktokUsername }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      setError('');
      setIsLive(true);
      // Clear previous events
      setChatMessages([]);
      setGifts([]);
      setLikes([]);
      setMembers([]);
      setProcessedUuids(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsLive(false);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectFromTikTok = async () => {
    try {
      await fetch('http://localhost:5000/api/tiktok/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: tiktokUsername }),
      });
      
      // Clear all states
      setChatMessages([]);
      setGifts([]);
      setLikes([]);
      setMembers([]);
      setTiktokUsername('');
      setIsLive(false);
      setError('');
      setUserLabels([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 bg-navy-800 rounded-lg shadow-lg p-6 border border-navy-600">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={tiktokUsername}
            onChange={(e) => setTiktokUsername(e.target.value)}
            placeholder="Enter TikTok username"
            className="flex-1 p-2 rounded bg-navy-900 border border-navy-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading || isLive}
          />
          <button
            onClick={connectToTikTok}
            disabled={isLoading || isLive}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-navy-700 disabled:text-gray-400 transition-colors duration-200"
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </button>
          <button
            onClick={disconnectFromTikTok}
            disabled={!isLive}
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-navy-700 disabled:text-gray-400 transition-colors duration-200"
          >
            Disconnect
          </button>
          <Link 
            href="/animate"
            className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 transition-colors duration-200 flex items-center gap-2"
          >
            <span>🎮</span>
            Visualisasi
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} shadow-glow`}></div>
          <span className="text-sm text-gray-300">
            {isConnected ? 'Connected to server' : 'Disconnected from server'}
          </span>
          {isLive && (
            <>
              <div className="w-3 h-3 rounded-full bg-red-400 animate-pulse ml-4 shadow-glow"></div>
              <span className="text-sm text-gray-300">Live</span>
            </>
          )}
        </div>
        {error && (
          <div className="mt-2 text-red-400">{error}</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chat Messages */}
        <div className="bg-navy-800 rounded-lg shadow-lg p-6 border border-navy-600">
          <h2 className="text-xl font-bold mb-4 text-white flex items-center">
            <span className="mr-2">💬</span>
            Chat Messages
          </h2>
          <div 
            ref={chatRef} 
            className="h-[400px] overflow-y-auto custom-scrollbar"
          >
            {chatMessages.map((msg, index) => (
              <div key={index} className="mb-2 p-3 bg-navy-700 rounded-lg border border-navy-600 hover:border-blue-500 transition-colors duration-200">
                <span className="font-bold text-blue-400">{msg.username}:</span>
                <span className="text-gray-300 ml-2">{msg.message}</span>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gifts */}
        <div className="bg-navy-800 rounded-lg shadow-lg p-6 border border-navy-600">
          <h2 className="text-xl font-bold mb-4 text-white flex items-center">
            <span className="mr-2">🎁</span>
            Gifts
          </h2>
          <div 
            ref={giftsRef} 
            className="h-[400px] overflow-y-auto custom-scrollbar"
          >
            {gifts.map((gift) => (
              <div key={gift.uuid} className="mb-2 p-3 bg-navy-700 rounded-lg border border-navy-600 hover:border-pink-500 transition-colors duration-200">
                <div className="font-bold text-pink-400">{gift.username}</div>
                <div className="text-gray-300">
                  Sent {gift.giftName} <span className="text-yellow-500">(×{gift.repeatCount})</span>
                  <span className="ml-2 text-yellow-400">💎 {gift.diamonds}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(gift.timestamp).toLocaleTimeString()}
                </div>
                <div className="text-xs font-mono text-gray-500 mt-1 border-t border-navy-600 pt-1">
                  UUID: <span className="text-blue-400">{gift.uuid}</span>
                </div>
                <div className="text-xs font-mono text-gray-500">
                  Time since last: <span className="text-blue-400">{gift.timeSinceLastGift}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Akumulasi Gift */}
        <div className="bg-navy-800 rounded-lg shadow-lg p-6 border border-navy-600">
          <h2 className="text-xl font-bold mb-4 text-white flex items-center">
            <span className="mr-2">💎</span>
            Akumulasi Gift
          </h2>
          <div className="h-[400px] overflow-y-auto custom-scrollbar">
            {giftAccumulations.map((accumulation) => (
              <div 
                key={accumulation.userId}
                className="mb-2 p-3 bg-navy-700 rounded-lg border border-navy-600 hover:border-yellow-500 transition-colors duration-200"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-yellow-400">{accumulation.username}</span>
                    <div className="text-xs text-gray-400">
                      Total Gifts: {accumulation.giftCount}
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-yellow-500">
                    💎 {accumulation.totalDiamonds.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Last gift: {accumulation.lastGiftTime.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Likes & Members */}
        <div className="bg-navy-800 rounded-lg shadow-lg p-6 border border-navy-600">
          <h2 className="text-xl font-bold mb-4 text-white flex items-center">
            <span className="mr-2">❤️</span>
            Likes & Members
          </h2>
          <div 
            ref={likesRef} 
            className="h-[400px] overflow-y-auto custom-scrollbar"
          >
            {[...likes, ...members]
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .map((event, index) => (
                <div key={index} className="mb-2 p-3 bg-navy-700 rounded-lg border border-navy-600 hover:border-blue-500 transition-colors duration-200">
                  {'likes' in event ? (
                    <>
                      <span className="font-bold text-blue-400">{event.username}</span>
                      <span className="text-gray-300 ml-2">sent {event.likes} likes ❤️</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-blue-400">{event.username}</span>
                      <span className="text-gray-300 ml-2">joined as {event.memberType} 👋</span>
                    </>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Label Panel */}
      <div className="bg-navy-800 rounded-lg shadow-lg p-6 border border-navy-600 mt-6">
        <h2 className="text-xl font-bold mb-4 text-white flex items-center">
          <span className="mr-2">🏷️</span>
          Label Penonton
        </h2>
        <div className="space-y-4">
          {/* Naik ke atas panggung */}
          <div className="bg-navy-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-pink-400 mb-2">🎭 Naik ke atas panggung</h3>
            <div className="space-y-2">
              {userLabels
                .filter(user => user.label === 'Naik ke atas panggung')
                .map(user => (
                  <div key={user.userId} className="flex items-center justify-between bg-navy-600 p-2 rounded">
                    <span className="text-white">{user.username}</span>
                    <span className="text-yellow-400">💎 {user.totalDiamonds}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Baris 1 */}
          <div className="bg-navy-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-400 mb-2">1️⃣ Baris 1</h3>
            <div className="space-y-2">
              {userLabels
                .filter(user => user.label === 'Baris 1')
                .map(user => (
                  <div key={user.userId} className="flex items-center justify-between bg-navy-600 p-2 rounded">
                    <span className="text-white">{user.username}</span>
                    {user.totalDiamonds && (
                      <span className="text-yellow-400">💎 {user.totalDiamonds}</span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Baris 2 - Like dan Komen */}
          <div className="bg-navy-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-400 mb-2">2️⃣ Like dan Komen</h3>
            <div className="space-y-2">
              {userLabels
                .filter(user => user.label === 'Baris 2')
                .map(user => (
                  <div key={user.userId} className="flex items-center justify-between bg-navy-600 p-2 rounded">
                    <span className="text-white">{user.username}</span>
                    <span className="text-gray-400">
                      {user.isCommenter && '💬'}
                      {user.isLiker && '❤️'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1f2e;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2d3748;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4a5568;
        }

        .shadow-glow {
          box-shadow: 0 0 8px currentColor;
        }
      `}</style>
    </div>
  );
} 