'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Komponen yang hanya dirender di client side
const GameComponent = dynamic(() => import('./GameComponent'), {
  ssr: false
});

export default function AnimatePage() {
  return (
    <>
      <style jsx global>{`
        body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000000;
        }
        #phaser-container {
          width: 100vw;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
        }
        canvas {
          width: 100vw !important;
          height: 100vh !important;
        }
      `}</style>
      <div className="fixed inset-0 w-screen h-screen">
        <GameComponent />
        <Link 
          href="/"
          className="absolute top-4 left-4 z-50 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full shadow-lg transition-colors duration-200 flex items-center gap-2"
        >
          <span>←</span>
          Kembali
        </Link>
      </div>
    </>
  );
} 