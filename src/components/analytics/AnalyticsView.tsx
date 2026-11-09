import React, { useState } from 'react';
import { RevenueTrendsDashboard } from './RevenueTrendsDashboard';
import { BIReportingModule } from './BIReportingModule';
import { TrendingUp, FileText } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TRENDS' | 'REPORTING'>('TRENDS');

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      {/* Top Tab Bar */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('TRENDS')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'TRENDS'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Tren Pendapatan Harian &amp; Bulanan (BI)</span>
            </button>

            <button
              onClick={() => setActiveTab('REPORTING')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'REPORTING'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Laporan Eksekutif &amp; Valuasi Bisnis</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1">
        {activeTab === 'TRENDS' ? <RevenueTrendsDashboard /> : <BIReportingModule />}
      </div>
    </div>
  );
};

export default AnalyticsView;
