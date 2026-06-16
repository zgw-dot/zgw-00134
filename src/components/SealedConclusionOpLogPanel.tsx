import { useBoardStore } from '@/store';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';
import type { SealedConclusionOpType } from '@/types';
import {
  X,
  ScrollText,
  FileCheck,
  Upload,
  Replace,
  RotateCcw,
  Undo2,
  Copy,
  SkipForward,
  XCircle,
} from 'lucide-react';

interface SealedConclusionOpLogPanelProps {
  open: boolean;
  onClose: () => void;
}

const OP_LABELS: Record<SealedConclusionOpType, { label: string; icon: React.ReactNode; cls: string }> = {
  seal: { label: '封存', icon: <FileCheck className="h-3.5 w-3.5" />, cls: 'text-teal-300 bg-teal-500/15 border-teal-500/40' },
  import: { label: '导入', icon: <Upload className="h-3.5 w-3.5" />, cls: 'text-sky-300 bg-sky-500/15 border-sky-500/40' },
  overwrite: { label: '覆盖', icon: <Replace className="h-3.5 w-3.5" />, cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40' },
  copy: { label: '另存', icon: <Copy className="h-3.5 w-3.5" />, cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40' },
  restore: { label: '回放', icon: <RotateCcw className="h-3.5 w-3.5" />, cls: 'text-amber-300 bg-amber-500/15 border-amber-500/40' },
  undo_restore: { label: '撤销回放', icon: <Undo2 className="h-3.5 w-3.5" />, cls: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/40' },
  cancel_import: { label: '取消导入', icon: <XCircle className="h-3.5 w-3.5" />, cls: 'text-slate-300 bg-slate-500/15 border-slate-500/40' },
  skip: { label: '跳过', icon: <SkipForward className="h-3.5 w-3.5" />, cls: 'text-slate-400 bg-slate-600/15 border-slate-500/40' },
};

export default function SealedConclusionOpLogPanel({ open, onClose }: SealedConclusionOpLogPanelProps) {
  const getSealedConclusionOpLogs = useBoardStore((s) => s.getSealedConclusionOpLogs);
  const logs = getSealedConclusionOpLogs();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={cn(
          'flex w-full max-w-lg flex-col rounded-md shadow-2xl',
          'bg-slate-800 border border-slate-700 max-h-[70vh]'
        )}>
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 flex-none">
            <div className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-slate-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">封存结论操作日志</h2>
                <p className="text-xs text-slate-500">封存、导入、覆盖、回放、撤销记录</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className={cn(
              'flex h-8 w-8 flex-none items-center justify-center rounded-md',
              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
            )}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {logs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <ScrollText className="h-8 w-8 mb-2" />
                <div className="text-sm">暂无操作日志</div>
              </div>
            )}
            {logs.length > 0 && (
              <div className="divide-y divide-slate-700/60">
                {logs.map(log => {
                  const info = OP_LABELS[log.op];
                  return (
                    <div key={log.id} className="px-5 py-3 hover:bg-slate-700/20 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium', info?.cls || 'text-slate-400 bg-slate-700/40 border-slate-600')}>
                          {info?.icon || <ScrollText className="h-3.5 w-3.5" />}
                          {info?.label || log.op}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">{formatTime(log.timestamp, 'full')}</span>
                      </div>
                      <div className="text-sm text-slate-300">{log.detail}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        <span>快照: <span className="text-slate-500">{log.snapshot_name}</span></span>
                        {log.conclusion_id && (
                          <>
                            <span className="mx-1">·</span>
                            <span>结论: <span className="font-mono text-slate-600">{log.conclusion_id.slice(0, 12)}</span></span>
                          </>
                        )}
                        {log.event_id && (
                          <>
                            <span className="mx-1">·</span>
                            <span>事件: <span className="font-mono text-slate-600">{log.event_id.slice(0, 12)}</span></span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-5 py-3 flex-none">
            <div className="text-xs text-slate-500">
              共 {logs.length} 条日志
            </div>
            <button type="button" onClick={onClose} className={cn(
              'flex items-center gap-1.5 rounded-md border border-slate-600',
              'px-4 py-2 text-sm font-medium text-slate-300',
              'hover:bg-slate-700 hover:text-slate-100 transition-colors'
            )}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
