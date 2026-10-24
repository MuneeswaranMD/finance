import React from 'react';
import {
  Home,
  CreditCard,
  TrendingUp,
  Percent,
  Plus
} from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openQuickAdd: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  openQuickAdd
}) => {
  return (
    <nav className="mobile-nav-dock">
      {/* 1. Home (Screen 1 Dashboard) */}
      <div
        className={`dock-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
        title="Dashboard"
      >
        <Home size={21} />
        {activeTab === 'dashboard' && <span className="dock-active-dot" />}
      </div>

      {/* 2. Wallet / Ledger */}
      <div
        className={`dock-item ${activeTab === 'transactions' ? 'active' : ''}`}
        onClick={() => setActiveTab('transactions')}
        title="Cash Ledger"
      >
        <CreditCard size={21} />
        {activeTab === 'transactions' && <span className="dock-active-dot" />}
      </div>

      {/* Center Floating Quick-Add Action */}
      <div
        onClick={openQuickAdd}
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: 'var(--primary-lime)',
          color: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-lime)',
          transition: 'transform 0.15s ease',
          margin: '0 4px'
        }}
        title="Add Transaction / Quick Action"
      >
        <Plus size={22} strokeWidth={3} />
      </div>

      {/* 3. Expense Activities (Screen 2 Donut) */}
      <div
        className={`dock-item ${activeTab === 'activities' ? 'active' : ''}`}
        onClick={() => setActiveTab('activities')}
        title="Activities (Expense Donut)"
      >
        <TrendingUp size={21} />
        {activeTab === 'activities' && <span className="dock-active-dot" />}
      </div>

      {/* 4. Financial Statistics (Screen 3 Bar Chart) */}
      <div
        className={`dock-item ${activeTab === 'insights' ? 'active' : ''}`}
        onClick={() => setActiveTab('insights')}
        title="Financial Insights"
      >
        <Percent size={21} />
        {activeTab === 'insights' && <span className="dock-active-dot" />}
      </div>
    </nav>
  );
};
