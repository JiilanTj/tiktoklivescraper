'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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
  timestamp: Date;
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
  totalDiamonds: number;
  lastGiftTime: Date;
}

interface GiftKey {
  username: string;
  giftId: string;
  timestamp: number;
}

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
  const [giftAccumulations, setGiftAccumulations] = useState<GiftAccumulation[]>([]);

  // Refs untuk auto-scroll
  const chatRef = useRef<HTMLDivElement>(null);
  const giftsRef = useRef<HTMLDivElement>(null);
  const likesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize socket connection
    socket = io('http://localhost:5000');

    socket.on('connect', () => {
      setIsConnected(true);
      setError('');
    });

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
    });

    socket.on('tiktok-gift', (data) => {
      // Update gifts list
      const newGift = {
        ...data,
        timestamp: new Date()
      };
      
      setGifts(prev => [...prev, newGift].slice(-50));
      if (giftsRef.current) {
        giftsRef.current.scrollTop = giftsRef.current.scrollHeight;
      }

      // Update gift accumulations
      setGiftAccumulations(prev => {
        const existingUser = prev.find(user => user.username === data.username);
        const giftValue = data.diamonds * (data.repeatCount || 1);
        
        if (existingUser) {
          return prev.map(user => 
            user.username === data.username 
              ? {
                  ...user,
                  totalDiamonds: user.totalDiamonds + giftValue,
                  lastGiftTime: new Date()
                }
              : user
          ).sort((a, b) => b.totalDiamonds - a.totalDiamonds);
        } else {
          return [...prev, {
            username: data.username,
            totalDiamonds: giftValue,
            lastGiftTime: new Date()
          }].sort((a, b) => b.totalDiamonds - a.totalDiamonds);
        }
      });
    });

    socket.on('tiktok-like', (data) => {
      setLikes(prev => [...prev, { ...data, timestamp: new Date() }].slice(-50));
      if (likesRef.current) {
        likesRef.current.scrollTop = likesRef.current.scrollHeight;
      }
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
      setGiftAccumulations([]);
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
      setGiftAccumulations([]);
      setTiktokUsername('');
      setIsLive(false);
      setError('');
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
            {gifts.map((gift, index) => (
              <div key={index} className="mb-2 p-3 bg-navy-700 rounded-lg border border-navy-600 hover:border-pink-500 transition-colors duration-200">
                <div className="font-bold text-pink-400">{gift.username}</div>
                <div className="text-gray-300">
                  Sent {gift.giftName} <span className="text-yellow-500">(×{gift.repeatCount})</span>
                  <span className="ml-2 text-yellow-400">💎 {gift.diamonds}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(gift.timestamp).toLocaleTimeString()}
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
            {giftAccumulations.map((accumulation, index) => (
              <div 
                key={index} 
                className="mb-2 p-3 bg-navy-700 rounded-lg border border-navy-600 hover:border-yellow-500 transition-colors duration-200"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-yellow-400">{accumulation.username}</span>
                  <span className="text-2xl font-bold text-yellow-500">
                    💎 {accumulation.totalDiamonds.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Last gift: {new Date(accumulation.lastGiftTime).toLocaleTimeString()}
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