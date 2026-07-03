import { Suspense } from 'react';
import MarketOverview from '../../components/terminal/MarketOverview';
import TradingChart from '../../components/terminal/TradingChart';
import NewsPanel from '../../components/terminal/NewsPanel';
import WatchList from '../../components/terminal/WatchList';
import TerminalHeader from '../../components/terminal/TerminalHeader';
import TopMoversMarquee from '../../components/terminal/TopMoversMarquee';

export default function TerminalDashboard() {
  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      <TerminalHeader />
      <TopMoversMarquee />
      <div className="grid grid-cols-12 gap-2 p-2">
        <div className="col-span-12 bg-gray-900 border border-green-400 rounded">
          <Suspense fallback={<div className="p-4">Loading market data...</div>}>
            <MarketOverview />
          </Suspense>
        </div>
        <div className="col-span-8">
          <div className="bg-gray-900 border border-green-400 rounded">
            <TradingChart />
          </div>
        </div>
        <div className="col-span-4 space-y-2">
          <div className="bg-gray-900 border border-green-400 rounded h-[15%]">
            <NewsPanel />
          </div>
          <div className="bg-gray-900 border border-green-400 rounded">
            <WatchList />
          </div>
        </div>
      </div>
    </div>
  );
}