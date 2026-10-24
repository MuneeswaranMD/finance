import React from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Landmark,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import { formatINR } from '../../services/financialCalculations';

interface MetricCardsProps {
  cashBalance: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  accountsReceivable: number;
  loanLiability: number;
  nextEMI: number;
  onNavigateTab: (tab: string) => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  cashBalance,
  monthlyInflow,
  monthlyOutflow,
  accountsReceivable,
  loanLiability,
  nextEMI,
  onNavigateTab
}) => {
  const netSavings = monthlyInflow - monthlyOutflow;

  return (
    <div className="grid-metrics">
      {/* 1. Cash Balance Card */}
      <div className="metric-card" style={{ borderLeft: '4px solid #10b981' }}>
        <div className="metric-card-header">
          <span className="metric-title">Available Cash In Hand</span>
          <div className="metric-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Wallet size={18} />
          </div>
        </div>
        <div className="metric-value" style={{ color: '#10b981' }}>
          {formatINR(cashBalance)}
        </div>
        <div className="metric-subtitle">
          Bank accounts, UPI & liquid cash reserves
        </div>
      </div>

      {/* 2. Monthly Cash Inflow */}
      <div className="metric-card" style={{ borderLeft: '4px solid #06b6d4' }}>
        <div className="metric-card-header">
          <span className="metric-title">Cash Inflow (This Month)</span>
          <div className="metric-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
            <TrendingUp size={18} />
          </div>
        </div>
        <div className="metric-value">
          {formatINR(monthlyInflow)}
        </div>
        <div className="metric-subtitle">
          Realized income & received invoice payments
        </div>
      </div>

      {/* 3. Monthly Cash Outflow */}
      <div className="metric-card" style={{ borderLeft: '4px solid #f43f5e' }}>
        <div className="metric-card-header">
          <span className="metric-title">Cash Outflow (This Month)</span>
          <div className="metric-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
            <TrendingDown size={18} />
          </div>
        </div>
        <div className="metric-value" style={{ color: '#e11d48' }}>
          {formatINR(monthlyOutflow)}
        </div>
        <div className="metric-subtitle">
          Net monthly delta: <span style={{ color: netSavings >= 0 ? '#10b981' : '#e11d48', fontWeight: 700 }}>{formatINR(netSavings)}</span>
        </div>
      </div>

      {/* 4. Accounts Receivable (Accrual Distinction!) */}
      <div
        className="metric-card"
        style={{ borderLeft: '4px solid #f59e0b', cursor: 'pointer' }}
        onClick={() => onNavigateTab('invoices')}
        title="View pending invoices"
      >
        <div className="metric-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="metric-title">Accounts Receivable (Invoices)</span>
            <ArrowUpRight size={14} color="#f59e0b" />
          </div>
          <div className="metric-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Clock size={18} />
          </div>
        </div>
        <div className="metric-value" style={{ color: '#d97706' }}>
          {formatINR(accountsReceivable)}
        </div>
        <div className="metric-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldAlert size={12} color="#d97706" />
          <span>Accrual revenue awaiting cash collection</span>
        </div>
      </div>

      {/* 5. Loan Debt & Liabilities */}
      <div
        className="metric-card"
        style={{ borderLeft: '4px solid #6366f1', cursor: 'pointer' }}
        onClick={() => onNavigateTab('loans')}
        title="View loan schedules & EMI tracker"
      >
        <div className="metric-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="metric-title">Total Loan Principal Debt</span>
            <ArrowUpRight size={14} color="#6366f1" />
          </div>
          <div className="metric-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
            <Landmark size={18} />
          </div>
        </div>
        <div className="metric-value">
          {formatINR(loanLiability)}
        </div>
        <div className="metric-subtitle">
          Next upcoming EMI: <strong style={{ color: 'var(--text-main)' }}>{formatINR(nextEMI)}</strong>
        </div>
      </div>
    </div>
  );
};
