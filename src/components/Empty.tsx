import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface EmptyProps {
  text?: string;
  className?: string;
}

export default function Empty({
  text = '暂无数据',
  className = '',
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 via-slate-500/10 to-amber-500/20 blur-3xl rounded-full scale-150" />
        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 shadow-xl flex items-center justify-center">
          <svg
            viewBox="0 0 120 120"
            className="w-16 h-16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="emptyGrad" x1="0" y1="0" x2="120" y2="120">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="50%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <path
              d="M24 40c0-8.837 7.163-16 16-16h40c8.837 0 16 7.163 16 16v40c0 8.837-7.163 16-16 16H40c-8.837 0-16-7.163-16-16V40z"
              stroke="url(#emptyGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity="0.9"
            />
            <path
              d="M36 52h48M36 68h32M36 84h24"
              stroke="url(#emptyGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.6"
            />
            <circle cx="88" cy="84" r="10" fill="url(#emptyGrad)" opacity="0.25" />
            <path
              d="M84 84l2.5 2.5L92 81"
              stroke="url(#emptyGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-400/80 animate-pulse" />
        <Sparkles className="absolute -bottom-1 -left-1 w-4 h-4 text-teal-400/70 animate-pulse [animation-delay:0.7s]" />
      </div>

      <div className="relative space-y-2">
        <h3 className="text-lg font-semibold bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 bg-clip-text text-transparent">
          {text}
        </h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          导入相关数据后即可在此处查看内容
        </p>
      </div>

      <div className="mt-6 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500/60 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500/50 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-bounce" />
      </div>
    </div>
  );
}
