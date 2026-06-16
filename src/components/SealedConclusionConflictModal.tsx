import type { SealedEventConclusion, SealedConclusionConflict, SealedConclusionImportResolution, SnapshotSource } from '@/types';
import { cn } from '@/lib/utils';
import {
  X,
  AlertTriangle,
  Copy,
  Replace,
  SkipForward,
  XCircle,
  ShieldAlert,
  FileCheck,
  Clock,
} from 'lucide-react';

function getSourceDisplayName(item: { source?: SnapshotSource; name?: string; snapshot_name?: string }): string {
  return item.source?.current_name || item.name || item.snapshot_name || '';
}

function getSourceOriginalName(item: { source?: SnapshotSource; name?: string; snapshot_name?: string }): string | undefined {
  return item.source?.original_name;
}

interface SealedConclusionConflictModalProps {
  conclusions: SealedEventConclusion[];
  conflict: SealedConclusionConflict;
  onResolve: (resolution: SealedConclusionImportResolution) => void;
}

export default function SealedConclusionConflictModal({ conclusions, conflict, onResolve }: SealedConclusionConflictModalProps) {
  const sampleConclusion = conclusions[0];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={cn(
          'flex w-full max-w-lg flex-col rounded-md shadow-2xl',
          'bg-slate-800 border border-slate-700'
        )}>
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">导入冲突</h2>
                <p className="text-xs text-slate-500">检测到同名快照或重复事件结论</p>
              </div>
            </div>
            <button type="button" onClick={() => onResolve('cancel')} className={cn(
              'flex h-8 w-8 flex-none items-center justify-center rounded-md',
              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
            )}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400 flex-none mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-amber-300">冲突详情</div>
                  <div className="text-xs text-amber-200/80">
                    即将导入 {conclusions.length} 条封存结论
                  </div>
                  <div className="space-y-1 text-xs text-amber-200/70 mt-2">
                    {conflict.snapshot_name_conflict && (
                      <div>• 存在同名快照：{getSourceDisplayName(sampleConclusion)}</div>
                    )}
                    {conflict.event_id_conflicts.length > 0 && (
                      <div>• {conflict.event_id_conflicts.length} 个事件已存在结论副本</div>
                    )}
                    {conflict.conclusion_id_conflicts.length > 0 && (
                      <div>• {conflict.conclusion_id_conflicts.length} 个结论ID已存在</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-700 bg-slate-800/40 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-4 w-4 text-teal-400" />
                <span className="text-sm font-medium text-slate-200">即将导入</span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>快照: {getSourceDisplayName(sampleConclusion)}</span>
                </div>
                <div className="text-slate-500 pl-5">事件数: {conclusions.length} 条</div>
                <div className="text-slate-500 pl-5">封存时间: {sampleConclusion && new Date(sampleConclusion.sealed_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              请选择处理方式：
            </div>
          </div>

          <div className="flex flex-col gap-2 px-5 py-4 border-t border-slate-700">
            <button
              type="button"
              onClick={() => onResolve('overwrite')}
              className={cn(
                'flex items-center gap-2 w-full rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/20 transition-colors'
              )}
            >
              <Replace className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">覆盖现有</div>
                <div className="text-[11px text-rose-300/70">用新数据替换已存在的结论</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onResolve('copy')}
              className={cn(
                'flex items-center gap-2 w-full rounded-md border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-sm text-teal-300 hover:bg-teal-500/20 transition-colors'
              )}
            >
              <Copy className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">另存副本</div>
                <div className="text-[11px text-teal-300/70">保留原有数据，新数据自动重命名</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onResolve('skip')}
              className={cn(
                'flex items-center gap-2 w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors'
              )}
            >
              <SkipForward className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">跳过冲突</div>
                <div className="text-[11px text-slate-400">仅导入无冲突的结论</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onResolve('cancel')}
              className={cn(
                'flex items-center gap-2 w-full rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 transition-colors'
              )}
            >
              <XCircle className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">取消导入</div>
                <div className="text-[11px text-slate-500">放弃本次导入操作</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
