import { useMemo, useState } from 'react';
import type { SealedEventConclusion, RiskEvent, RiskLevel, EventStatus, SnapshotSource } from '@/types';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';
import { useBoardStore } from '@/store';
import {
  X,
  Clock,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Archive,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Undo2,
  SplitSquareVertical,
  User,
  FileText,
  AlertCircle,
} from 'lucide-react';

function getSourceDisplayName(item: { source?: SnapshotSource; name?: string; snapshot_name?: string }): string {
  return item.source?.current_name || item.name || item.snapshot_name || '';
}

function getSourceOriginalName(item: { source?: SnapshotSource; name?: string; snapshot_name?: string }): string | undefined {
  return item.source?.original_name;
}

interface SealedConclusionDetailDrawerProps {
  conclusion: SealedEventConclusion | null;
  onClose: () => void;
}

const RISK_LABELS: Record<RiskLevel, { label: string; cls: string; icon: React.ReactNode }> = {
  high: { label: '高风险', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  medium: { label: '中风险', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/40', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  low: { label: '低风险', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
};

const STATUS_LABELS: Record<EventStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: '待复核', cls: 'text-sky-300 bg-sky-500/15 border-sky-500/40', icon: <Clock className="h-3.5 w-3.5" /> },
  confirmed: { label: '已确认', cls: 'text-teal-300 bg-teal-500/15 border-teal-500/40', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  false_alarm: { label: '误报', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40', icon: <XCircle className="h-3.5 w-3.5" /> },
  closed: { label: '已关闭', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40', icon: <Archive className="h-3.5 w-3.5" /> },
};

interface DiffFieldProps {
  label: string;
  sealedValue: React.ReactNode;
  currentValue: React.ReactNode;
  hasDiff: boolean;
  sealedBadge?: React.ReactNode;
  currentBadge?: React.ReactNode;
}

function DiffField({ label, sealedValue, currentValue, hasDiff, sealedBadge, currentBadge }: DiffFieldProps) {
  return (
    <div className={cn(
      'grid grid-cols-2 gap-4 py-3 border-b border-slate-700/40',
      hasDiff && 'bg-rose-500/5'
    )}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{label}</span>
          {hasDiff && <AlertCircle className="h-3 w-3 text-rose-400" />}
        </div>
        <div className="flex items-center gap-2">
          {sealedBadge || <span className="text-sm text-slate-200">{sealedValue}</span>}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{label}</span>
          {hasDiff && <AlertCircle className="h-3 w-3 text-rose-400" />}
        </div>
        <div className="flex items-center gap-2">
          {currentBadge || <span className={cn('text-sm', hasDiff ? 'text-rose-300' : 'text-slate-200')}>{currentValue}</span>}
        </div>
      </div>
    </div>
  );
}

export default function SealedConclusionDetailDrawer({ conclusion, onClose }: SealedConclusionDetailDrawerProps) {
  const events = useBoardStore((s) => s.events);
  const restoreSealedConclusion = useBoardStore((s) => s.restoreSealedConclusion);
  const canUndoSealedConclusionRestore = useBoardStore((s) => s.canUndoSealedConclusionRestore);
  const undoSealedConclusionRestore = useBoardStore((s) => s.undoSealedConclusionRestore);

  const [showFullDiff, setShowFullDiff] = useState(false);

  const currentEvent = useMemo<RiskEvent | undefined>(() => {
    if (!conclusion) return undefined;
    return events.find(e => e.event_id === conclusion.event_id);
  }, [conclusion, events]);

  const diffs = useMemo(() => {
    if (!conclusion || !currentEvent) return { risk: false, status: false, note: false, any: false };
    const riskDiff = conclusion.risk_level !== currentEvent.risk_level;
    const statusDiff = conclusion.status !== currentEvent.status;
    const noteDiff = conclusion.latest_note !== (currentEvent.latest_note || '');
    return {
      risk: riskDiff,
      status: statusDiff,
      note: noteDiff,
      any: riskDiff || statusDiff || noteDiff,
    };
  }, [conclusion, currentEvent]);

  if (!conclusion) return null;

  const handleRestore = () => {
    if (conclusion) {
      restoreSealedConclusion(conclusion.conclusion_id);
    }
  };

  const handleUndoRestore = () => {
    undoSealedConclusionRestore();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'fixed right-0 top-0 z-50 flex h-full w-full max-w-[720px] flex-col',
        'bg-slate-800 border-l border-slate-700 shadow-2xl'
      )}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 flex-none">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SplitSquareVertical className="h-4 w-4 text-teal-400" />
              <h2 className="text-base font-semibold text-slate-100">结论对照</h2>
              {diffs.any && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 border border-rose-500/40 px-2 py-0.5 text-[11px] text-rose-300">
                  <AlertCircle className="h-3 w-3" />
                  存在差异
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              快照: {getSourceDisplayName(conclusion)} · 事件: {conclusion.event_id.slice(0, 16)}...
            </div>
          </div>
          <button type="button" onClick={onClose} className={cn(
            'flex h-8 w-8 flex-none items-center justify-center rounded-md',
            'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
          )}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-slate-700 px-5 py-3 flex-none bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-teal-400" />
            <span className="text-xs font-medium text-teal-300">封存那一刻</span>
            <span className="text-[10px] text-slate-500 font-mono">{formatTime(conclusion.sealed_at, 'datetime')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">现在这条事件</span>
            {currentEvent && (
              <span className="text-[10px] text-slate-500 font-mono">{formatTime(currentEvent.updated_at, 'datetime')}</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-md border border-slate-700 bg-slate-800/40 overflow-hidden">
              <DiffField
                label="风险等级"
                sealedValue={RISK_LABELS[conclusion.risk_level].label}
                currentValue={currentEvent ? RISK_LABELS[currentEvent.risk_level].label : '事件不存在'}
                hasDiff={diffs.risk}
                sealedBadge={
                  <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', RISK_LABELS[conclusion.risk_level].cls)}>
                    {RISK_LABELS[conclusion.risk_level].icon}
                    {RISK_LABELS[conclusion.risk_level].label}
                  </span>
                }
                currentBadge={currentEvent ? (
                  <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', RISK_LABELS[currentEvent.risk_level].cls)}>
                    {RISK_LABELS[currentEvent.risk_level].icon}
                    {RISK_LABELS[currentEvent.risk_level].label}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">事件不存在</span>
                )}
              />
              <DiffField
                label="处理状态"
                sealedValue={STATUS_LABELS[conclusion.status].label}
                currentValue={currentEvent ? STATUS_LABELS[currentEvent.status].label : '事件不存在'}
                hasDiff={diffs.status}
                sealedBadge={
                  <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', STATUS_LABELS[conclusion.status].cls)}>
                    {STATUS_LABELS[conclusion.status].icon}
                    {STATUS_LABELS[conclusion.status].label}
                  </span>
                }
                currentBadge={currentEvent ? (
                  <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', STATUS_LABELS[currentEvent.status].cls)}>
                    {STATUS_LABELS[currentEvent.status].icon}
                    {STATUS_LABELS[currentEvent.status].label}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">事件不存在</span>
                )}
              />
              <DiffField
                label="备注"
                sealedValue={conclusion.latest_note || '无备注'}
                currentValue={currentEvent ? (currentEvent.latest_note || '无备注') : '事件不存在'}
                hasDiff={diffs.note}
              />
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
                <FileText className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-200">封存时的筛选条件</h3>
              </div>
              <div className="space-y-1.5 rounded-md border border-slate-700 bg-slate-800/40 p-3">
                {conclusion.filters_at_seal.classes.length > 0 && (
                  <div className="text-xs"><span className="text-slate-500">班级：</span><span className="text-slate-300">{conclusion.filters_at_seal.classes.join('、')}</span></div>
                )}
                {conclusion.filters_at_seal.risk_levels.length > 0 && (
                  <div className="text-xs"><span className="text-slate-500">风险：</span><span className="text-slate-300">{conclusion.filters_at_seal.risk_levels.join('、')}</span></div>
                )}
                {conclusion.filters_at_seal.statuses.length > 0 && (
                  <div className="text-xs"><span className="text-slate-500">状态：</span><span className="text-slate-300">{conclusion.filters_at_seal.statuses.join('、')}</span></div>
                )}
                {conclusion.filters_at_seal.search_text && (
                  <div className="text-xs"><span className="text-slate-500">搜索：</span><span className="text-slate-300">{conclusion.filters_at_seal.search_text}</span></div>
                )}
                {conclusion.filters_at_seal.classes.length === 0 &&
                 conclusion.filters_at_seal.risk_levels.length === 0 &&
                 conclusion.filters_at_seal.statuses.length === 0 &&
                 !conclusion.filters_at_seal.search_text && (
                  <div className="text-xs text-slate-500">无筛选条件（封存时为全量数据）</div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
                <User className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-slate-200">证据摘要</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3">
                  <div className="text-xs text-slate-500 mb-1">证据总数</div>
                  <div className="text-lg font-semibold text-slate-200">{conclusion.evidence_summary.total_evidence}</div>
                </div>
                <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3">
                  <div className="text-xs text-slate-500 mb-1">涉及学生</div>
                  <div className="text-lg font-semibold text-slate-200">{conclusion.evidence_summary.student_count} 人</div>
                </div>
                <div className="col-span-2 rounded-md border border-slate-700 bg-slate-800/40 p-3">
                  <div className="text-xs text-slate-500 mb-1">证据类型</div>
                  <div className="flex flex-wrap gap-1.5">
                    {conclusion.evidence_summary.evidence_types.length > 0 ? (
                      conclusion.evidence_summary.evidence_types.map(type => (
                        <span key={type} className="inline-flex items-center rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-300">
                          {type}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">无证据类型</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowFullDiff(!showFullDiff)}
                className={cn(
                  'w-full flex items-center justify-between rounded-md border border-slate-700 px-3 py-2',
                  'text-xs font-medium text-slate-400 hover:bg-slate-700/50 transition-colors'
                )}
              >
                <span className="flex items-center gap-2">
                  <SplitSquareVertical className="h-3.5 w-3.5" />
                  {showFullDiff ? '收起完整事件对比' : '展开完整事件对比'}
                </span>
                <span className="text-slate-500">{showFullDiff ? '↑' : '↓'}</span>
              </button>

              {showFullDiff && (
                <div className="mt-3 rounded-md border border-slate-700 bg-slate-900/40 p-3 font-mono text-[11px] max-h-96 overflow-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-teal-400 mb-2 text-xs font-sans">封存时事件</div>
                      <pre className="text-slate-400 whitespace-pre-wrap break-words">
                        {JSON.stringify(conclusion.event_snapshot, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-amber-400 mb-2 text-xs font-sans">当前事件</div>
                      <pre className="text-slate-400 whitespace-pre-wrap break-words">
                        {currentEvent ? JSON.stringify(currentEvent, null, 2) : '// 事件不存在'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 px-5 py-3 flex-none space-y-2">
          {canUndoSealedConclusionRestore() && (
            <button
              type="button"
              onClick={handleUndoRestore}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 rounded-md',
                'bg-indigo-500 px-3 py-2 text-sm font-medium text-white',
                'hover:bg-indigo-600 active:bg-indigo-700 transition-colors'
              )}
            >
              <Undo2 className="h-4 w-4" />
              撤销上一次回放
            </button>
          )}
          {currentEvent ? (
            <button
              type="button"
              onClick={handleRestore}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 rounded-md',
                'bg-teal-500 px-3 py-2 text-sm font-medium text-white',
                'hover:bg-teal-600 active:bg-teal-700 transition-colors'
              )}
            >
              <RotateCcw className="h-4 w-4" />
              回放封存版到工作台
            </button>
          ) : (
            <div className="text-center text-xs text-rose-400 py-2">
              当前事件不存在，无法回放
            </div>
          )}
        </div>
      </div>
    </>
  );
}
