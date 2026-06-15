import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Archive,
  AlertTriangle,
  Gauge,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { BoardStats } from '@/types';

interface StatsBarProps {
  stats: BoardStats;
}

export default function StatsBar({ stats }: StatsBarProps) {
  const cards = [
    {
      label: '风险事件总数',
      value: stats.total,
      icon: <Gauge className="w-4 h-4" />,
      color: 'text-slate-300',
      bg: 'bg-slate-700/30',
      border: 'border-slate-600/50',
    },
    {
      label: '待处理',
      value: stats.pending,
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
    },
    {
      label: '已确认',
      value: stats.confirmed,
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
    },
    {
      label: '误报',
      value: stats.false_alarm,
      icon: <XCircle className="w-4 h-4" />,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
    },
    {
      label: '已关闭',
      value: stats.closed,
      icon: <Archive className="w-4 h-4" />,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/30',
    },
  ];

  const riskCards = [
    {
      label: '高风险',
      value: stats.high_risk,
      icon: <ShieldAlert className="w-4 h-4" />,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
    },
    {
      label: '中风险',
      value: stats.medium_risk,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
    },
    {
      label: '低风险',
      value: stats.low_risk,
      icon: <ShieldCheck className="w-4 h-4" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`card p-3 ${c.bg} ${c.border}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={c.color}>{c.icon}</span>
              <span className="text-xs text-slate-400">{c.label}</span>
            </div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {riskCards.map((c) => (
          <div
            key={c.label}
            className={`card p-3 ${c.bg} ${c.border}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={c.color}>{c.icon}</span>
              <span className="text-xs text-slate-400">{c.label}</span>
            </div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
