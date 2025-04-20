import TikTokLive from './components/TikTokLive';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900">
      <div className="py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-white">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
            TikTok Live Panel
          </span>
        </h1>
        <TikTokLive />
      </div>
    </div>
  );
}
