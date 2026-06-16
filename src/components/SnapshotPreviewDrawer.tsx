import { useMemo } from 'react';
import type { ReviewSnapshot, MealType, RiskLevel, EvidenceLink } from '@/types';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';
import {
  X,
  Clock,
  User,
  Coffee,
  Sun,
  UtensilsCrossed,
  Cookie,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  ClipboardList,
  ShoppingBag,
  MessageSquareWarning,
  Package,
  Filter,
} from 'lucide-react';

interface SnapshotPreviewDrawerProps {
  snapshot: ReviewSnapshot | null;
  onClose: () => void;
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '点心',
};

const MEAL_ICONS: Record<MealType, React.ReactNode> = {
  breakfast: <Coffee className="h-3.5 w-3.5" />,
  lunch: <Sun className="h-3.5 w-3.5" />,
  dinner: <UtensilsCrossed className="h-3.5 w-3.5" />,
  snack: <Cookie className="h-3.5 w-3.5" />,
};

const RISK_BADGE: Record<RiskLevel, { label: string; cls: string; icon: React.ReactNode }> = {
  high: { label: '高', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40', icon: <ShieldAlert className="h-3 w-3" /> },
  medium: { label: '中', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', icon: <AlertTriangle className="h-3 w-3" /> },
  low: { label: '低', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', icon: <ShieldCheck className="h-3 w-3" /> },
};

const EVIDENCE_LABELS: Record<EvidenceLink['type'], { label: string; icon: React.ReactNode; cls: string }> = {
  menu: { label: '菜单', icon: <ClipboardList className="h-3.5 w-3.5" />, cls: 'text-indigo-300' },
  profile: { label: '过敏档案', icon: <User className="h-3.5 w-3.5" />, cls: 'text-violet-300' },
  pickup: { label: '领餐记录', icon: <ShoppingBag className="h-3.5 w-3.5" />, cls: 'text-teal-300' },
  complaint: { label: '投诉记录', icon: <MessageSquareWarning className="h-3.5 w-3.5" />, cls: 'text-rose-300' },
};

export default function SnapshotPreviewDrawer({ snapshot, onClose }: SnapshotPreviewDrawerProps) {
  const summary = useMemo(() => {
    if (!snapshot) return null;
    const students = new Set<string>();
    const mealTypes = new Set<MealType>();
    const evidenceTypes = new Set<EvidenceLink['type']>();
    for (const e of snapshot.events) {
      for (const name of e.student_names || []) students.add(name);
      if (e.meal_type) mealTypes.add(e.meal_type);
      for (const ev of e.evidence || []) evidenceTypes.add(ev.type);
    }
    return { students, mealTypes, evidenceTypes };
  }, [snapshot]);

  if (!snapshot || !summary) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col',
        'bg-slate-800 border-l border-slate-700 shadow-2xl'
      )}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 flex-none">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100 truncate">快照预览</h2>
            <div className="text-xs text-slate-500 truncate">{snapshot.name}</div>
          </div>
          <button type="button" onClick={onClose} className={cn(
            'flex h-8 w-8 flex-none items-center justify-center rounded-md',
            'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
          )}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-5 py-5">
            <div>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
                <Clock className="h-4 w-4 text-teal-400" />
                <h3 className="text-sm font-semibold text-slate-200">基本信息</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-3 py-1.5">
                  <span className="min-w-[72px] flex-none text-xs text-slate-500 pt-0.5">快照名称</span>
                  <div className="flex-1 text-sm text-slate-200 break-all">{snapshot.name}</div>
                </div>
                <div className="flex items-start gap-3 py-1.5">
                  <span className="min-w-[72px] flex-none text-xs text-slate-500 pt-0.5">创建时间</span>
                  <div className="flex-1 text-sm text-slate-200 font-mono">{formatTime(snapshot.created_at, 'full')}</div>
                </div>
                <div className="flex items-start gap-3 py-1.5">
                  <span className="min-w-[72px] flex-none text-xs text-slate-500 pt-0.5">事件总数</span>
                  <div className="flex-1 text-sm text-slate-200">{snapshot.events.length}</div>
                </div>
                <div className="flex items-start gap-3 py-1.5">
                  <span className="min-w-[72px] flex-none text-xs text-slate-500 pt-0.5">风险分布</span>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {snapshot.risk_stats.high > 0 && (
                      <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', RISK_BADGE.high.cls)}>
                        {RISK_BADGE.high.icon}高 {snapshot.risk_stats.high}
                      </span>
                    )}
                    {snapshot.risk_stats.medium > 0 && (
                      <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', RISK_BADGE.medium.cls)}>
                        {RISK_BADGE.medium.icon}中 {snapshot.risk_stats.medium}
                      </span>
                    )}
                    {snapshot.risk_stats.low > 0 && (
                      <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', RISK_BADGE.low.cls)}>
                        {RISK_BADGE.low.icon}低 {snapshot.risk_stats.low}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
                <Filter className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-200">筛选条件</h3>
              </div>
              <div className="space-y-1.5 rounded-md border border-slate-700 bg-slate-800/40 p-3">
                {snapshot.filters.classes.length > 0 && (
                  <div className="text-xs"><span className="text-slate-500">班级：</span><span className="text-slate-300">{snapshot.filters.classes.join('、')}</span></div>
                )}
                {snapshot.filters.meal_types.length > 0 && (
                  <div className="text-xs"><span className="text-slate-500">餐次：</span><span className="text-slate-300">{snapshot.filters.meal_types.map(m => MEAL_LABELS[m]).join('、')}</span></div>
                )}
                {snapshot.filters.risk_levels.length > 0 && (
                  <div className="text-xs"><span className="text-slate-500">风险：</span><span className="text-slate-300">{snapshot.filters.risk_levels.map(r => RISK_BADGE[r].label).join('、')}</span></div>
                )}
                {snapshot.filters.statuses.length > 0 && (
                  <div className="text-xs"><span className="text-slate-500">状态：</span><span className="text-slate-300">{snapshot.filters.statuses.join('、')}</span></div>
                )}
                {snapshot.filters.search_text && (
                  <div className="text-xs"><span className="text-slate-500">搜索：</span><span className="text-slate-300">{snapshot.filters.search_text}</span></div>
                )}
                {snapshot.filters.classes.length === 0 && snapshot.filters.meal_types.length === 0 && snapshot.filters.risk_levels.length === 0 && snapshot.filters.statuses.length === 0 && !snapshot.filters.search_text && (
                  <div className="text-xs text-slate-500">无筛选条件（封存时为全量数据）</div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
                <User className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-slate-200">涉及学生</h3>
                <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400">{summary.students.size}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(summary.students).sort().map(name => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-300">
                    <User className="h-3 w-3 text-violet-400" />
                    {name}
                  </span>
                ))}
                {summary.students.size === 0 && (
                  <span className="text-xs text-slate-600">无学生数据</span>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
                <Coffee className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-200">涉及餐次</h3>
                <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400">{summary.mealTypes.size}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(summary.mealTypes).sort().map(mt => (
                  <span key={mt} className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-300">
                    {MEAL_ICONS[mt]}
                    {MEAL_LABELS[mt]}
                  </span>
                ))}
                {summary.mealTypes.size === 0 && (
                  <span className="text-xs text-slate-600">无餐次数据</span>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
                <ClipboardList className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-200">证据来源</h3>
                <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400">{summary.evidenceTypes.size}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(summary.evidenceTypes).sort().map(et => {
                  const info = EVIDENCE_LABELS[et];
                  return (
                    <span key={et} className={cn('inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs', info.cls)}>
                      {info.icon}
                      {info.label}
                    </span>
                  );
                })}
                {summary.evidenceTypes.size === 0 && (
                  <span className="text-xs text-slate-600">无证据数据</span>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
                <Package className="h-4 w-4 text-teal-400" />
                <h3 className="text-sm font-semibold text-slate-200">导入批次</h3>
                <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400">{snapshot.import_batches.length}</span>
              </div>
              {snapshot.import_batches.length > 0 && (
                <div className="space-y-1.5">
                  {snapshot.import_batches.map(b => (
                    <div key={b.batch_id} className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-200 truncate">{b.file_name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-0.5 rounded bg-slate-700 px-1 py-0.5 text-[10px]">{b.file_type}</span>
                            <span>{b.record_count} 条</span>
                            <span>{formatTime(b.imported_at, 'datetime')}</span>
                          </div>
                        </div>
                        <div className="font-mono text-[10px] text-slate-600 truncate max-w-[80px]" title={b.batch_id}>{b.batch_id.slice(0, 12)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {snapshot.import_batches.length === 0 && (
                <div className="text-xs text-slate-600">无导入批次记录</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
