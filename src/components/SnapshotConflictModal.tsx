import type { ReviewSnapshot, SnapshotConflict, SnapshotImportResolution } from '@/types';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Copy,
  Replace,
  XCircle,
} from 'lucide-react';

interface SnapshotConflictModalProps {
  snapshot: ReviewSnapshot;
  conflict: SnapshotConflict;
  onResolve: (resolution: SnapshotImportResolution) => void;
}

export default function SnapshotConflictModal({ snapshot, conflict, onResolve }: SnapshotConflictModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-lg border border-amber-500/40 bg-slate-800 shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-700 bg-amber-500/10 px-5 py-4">
          <AlertTriangle className="h-5 w-5 flex-none text-amber-400" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-200">导入冲突</h3>
            <p className="mt-1 text-xs text-amber-300/80">
              快照「{snapshot.name}」与现有数据存在冲突，请选择处理方式。
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          {conflict.name_conflict && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 flex-none" />
                <span className="font-medium">名称冲突</span>
              </div>
              <div className="mt-1 text-xs text-amber-300/70">
                已存在同名快照「{snapshot.name}」
              </div>
            </div>
          )}

          {conflict.event_id_conflicts.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 flex-none" />
                <span className="font-medium">事件 ID 冲突</span>
              </div>
              <div className="mt-1 text-xs text-amber-300/70">
                有 <span className="font-semibold">{conflict.event_id_conflicts.length}</span> 条事件 ID 与现有快照重复
              </div>
              <div className="mt-1.5 max-h-20 overflow-y-auto font-mono text-[10px] text-slate-500">
                {conflict.event_id_conflicts.slice(0, 10).map(id => (
                  <div key={id}>{id}</div>
                ))}
                {conflict.event_id_conflicts.length > 10 && (
                  <div className="text-slate-600">...还有 {conflict.event_id_conflicts.length - 10} 条</div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => onResolve('overwrite')}
              className={cn(
                'flex w-full items-center gap-3 rounded-md border px-4 py-3',
                'text-left transition-colors',
                'border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/15'
              )}
            >
              <Replace className="h-4 w-4 flex-none text-rose-400" />
              <div>
                <div className="text-sm font-medium text-rose-300">覆盖当前结果</div>
                <div className="text-xs text-rose-400/70">删除同名快照，用导入数据替换</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onResolve('copy')}
              className={cn(
                'flex w-full items-center gap-3 rounded-md border px-4 py-3',
                'text-left transition-colors',
                'border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/15'
              )}
            >
              <Copy className="h-4 w-4 flex-none text-sky-400" />
              <div>
                <div className="text-sm font-medium text-sky-300">另存副本</div>
                <div className="text-xs text-sky-400/70">自动改名保存，不覆盖现有数据</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onResolve('cancel')}
              className={cn(
                'flex w-full items-center gap-3 rounded-md border px-4 py-3',
                'text-left transition-colors',
                'border-slate-600 bg-slate-800/40 hover:bg-slate-700/60'
              )}
            >
              <XCircle className="h-4 w-4 flex-none text-slate-400" />
              <div>
                <div className="text-sm font-medium text-slate-300">取消</div>
                <div className="text-xs text-slate-500">放弃导入此快照</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
