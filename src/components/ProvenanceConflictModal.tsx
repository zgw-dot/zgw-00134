import { useState } from 'react';
import type {
  ProvenanceExportPackage,
  ProvenanceImportConflict,
  ProvenanceImportResolution,
} from '@/types';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/store';
import {
  X,
  AlertTriangle,
  Copy,
  Replace,
  ShieldCheck,
  XCircle,
  Layers,
  FileText,
  FileCheck,
  GitBranch,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

interface ProvenanceConflictModalProps {
  pkg: ProvenanceExportPackage;
  conflict: ProvenanceImportConflict;
  onResolve: (
    resolution: ProvenanceImportResolution,
    targetProvenanceId?: string
  ) => void;
}

export default function ProvenanceConflictModal({
  pkg,
  conflict,
  onResolve,
}: ProvenanceConflictModalProps) {
  const getProvenanceById = useBoardStore((s) => s.getProvenanceById);
  const getProvenanceSummaries = useBoardStore((s) => s.getProvenanceSummaries);

  const [selectedResolution, setSelectedResolution] = useState<ProvenanceImportResolution | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [showTargetSelect, setShowTargetSelect] = useState(false);

  const existingSummaries = getProvenanceSummaries();
  const existingTargetOptions = existingSummaries.filter(
    (s) => s.entity_type === (pkg.snapshots.length > 0 ? 'snapshot' : 'conclusion')
  );

  const sampleRecord = pkg.provenance_records[0];
  const sampleSnap = pkg.snapshots[0];
  const sampleConc = pkg.conclusions[0];

  const handleConfirm = () => {
    if (!selectedResolution) return;
    if (selectedResolution === 'overwrite_target' && !selectedTargetId) return;
    onResolve(selectedResolution, selectedTargetId || undefined);
  };

  const identityConflictDetails = conflict.identity_conflicts.slice(0, 3).map((ic) => {
    const existing = getProvenanceById(ic.existing_provenance_id);
    return {
      incoming_signature: ic.incoming_signature,
      existing_name: existing?.current_name || '未知',
      existing_id: ic.existing_provenance_id,
    };
  });

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={cn(
          'flex w-full max-w-xl flex-col rounded-md shadow-2xl',
          'bg-slate-800 border border-slate-700'
        )}>
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">导回冲突</h2>
                <p className="text-xs text-slate-500">检测到名字或身份碰撞，请选择处理方式</p>
              </div>
            </div>
            <button type="button" onClick={() => onResolve('cancel')} className={cn(
              'flex h-8 w-8 flex-none items-center justify-center rounded-md',
              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
            )}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 flex-none mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-amber-300">冲突详情</div>
                  <div className="text-xs text-amber-200/80">
                    即将导入 {pkg.provenance_records.length} 条来历记录，包含 {pkg.snapshots.length} 份快照，{pkg.conclusions.length} 条结论
                  </div>
                  <div className="space-y-1 text-xs text-amber-200/70 mt-2">
                    {conflict.name_conflicts.length > 0 && (
                      <div>• {conflict.name_conflicts.length} 个名称冲突：{conflict.name_conflicts.slice(0, 2).join('、')}{conflict.name_conflicts.length > 2 ? '...' : ''}</div>
                    )}
                    {conflict.provenance_id_conflicts.length > 0 && (
                      <div>• {conflict.provenance_id_conflicts.length} 个来历ID已存在</div>
                    )}
                    {conflict.entity_id_conflicts.length > 0 && (
                      <div>• {conflict.entity_id_conflicts.length} 个实体ID已存在</div>
                    )}
                    {conflict.identity_conflicts.length > 0 && (
                      <div>• {conflict.identity_conflicts.length} 个身份签名匹配（内容相同）</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {identityConflictDetails.length > 0 && (
              <div className="rounded-md border border-slate-700 bg-slate-800/40 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-medium text-slate-200">身份匹配项</span>
                </div>
                <div className="space-y-2">
                  {identityConflictDetails.map((detail, i) => (
                    <div key={i} className="text-xs bg-slate-700/30 rounded p-2">
                      <div className="flex items-center gap-2 text-slate-300">
                        <ChevronRight className="h-3 w-3 text-violet-400" />
                        <span>现有: {detail.existing_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 ml-5">
                        签名: {detail.incoming_signature.slice(0, 16)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border border-slate-700 bg-slate-800/40 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                {pkg.snapshots.length > 0 ? <FileText className="h-4 w-4 text-sky-400" /> : <FileCheck className="h-4 w-4 text-amber-400" />}
                <span className="text-sm font-medium text-slate-200">即将导入内容</span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div className="font-medium text-slate-300">
                  {sampleRecord?.current_name || sampleSnap?.name || sampleConc?.snapshot_name}
                </div>
                <div className="text-slate-500 pl-5">
                  事件数: {sampleSnap?.events.length || sampleConc ? 1 : 0} 条
                </div>
                <div className="text-slate-500 pl-5">
                  导出时间: {new Date(pkg.exported_at).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              请选择处理方式：
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedResolution('keep_existing');
                  setShowTargetSelect(false);
                  setSelectedTargetId(null);
                }}
                className={cn(
                  'flex items-center gap-3 w-full rounded-md border px-4 py-3 text-left transition-colors',
                  selectedResolution === 'keep_existing'
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-600 bg-slate-700/30 hover:bg-slate-700/50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-md flex-none',
                  selectedResolution === 'keep_existing' ? 'bg-emerald-500/20' : 'bg-slate-600/50'
                )}>
                  <ShieldCheck className={cn(
                    'h-4 w-4',
                    selectedResolution === 'keep_existing' ? 'text-emerald-400' : 'text-slate-400'
                  )} />
                </div>
                <div className="flex-1">
                  <div className={cn(
                    'text-sm font-medium',
                    selectedResolution === 'keep_existing' ? 'text-emerald-300' : 'text-slate-200'
                  )}>
                    保留现有
                  </div>
                  <div className={cn(
                    'text-xs',
                    selectedResolution === 'keep_existing' ? 'text-emerald-300/70' : 'text-slate-400'
                  )}>
                    不做任何修改，保持当前数据不变
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedResolution('branch');
                  setShowTargetSelect(false);
                  setSelectedTargetId(null);
                }}
                className={cn(
                  'flex items-center gap-3 w-full rounded-md border px-4 py-3 text-left transition-colors',
                  selectedResolution === 'branch'
                    ? 'border-violet-500/50 bg-violet-500/10'
                    : 'border-slate-600 bg-slate-700/30 hover:bg-slate-700/50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-md flex-none',
                  selectedResolution === 'branch' ? 'bg-violet-500/20' : 'bg-slate-600/50'
                )}>
                  <GitBranch className={cn(
                    'h-4 w-4',
                    selectedResolution === 'branch' ? 'text-violet-400' : 'text-slate-400'
                  )} />
                </div>
                <div className="flex-1">
                  <div className={cn(
                    'text-sm font-medium',
                    selectedResolution === 'branch' ? 'text-violet-300' : 'text-slate-200'
                  )}>
                    另开分支
                  </div>
                  <div className={cn(
                    'text-xs',
                    selectedResolution === 'branch' ? 'text-violet-300/70' : 'text-slate-400'
                  )}>
                    保留原有数据，新数据自动重命名作为独立分支
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedResolution('overwrite_target');
                  setShowTargetSelect(true);
                }}
                className={cn(
                  'flex items-center gap-3 w-full rounded-md border px-4 py-3 text-left transition-colors',
                  selectedResolution === 'overwrite_target'
                    ? 'border-rose-500/50 bg-rose-500/10'
                    : 'border-slate-600 bg-slate-700/30 hover:bg-slate-700/50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-md flex-none',
                  selectedResolution === 'overwrite_target' ? 'bg-rose-500/20' : 'bg-slate-600/50'
                )}>
                  <Replace className={cn(
                    'h-4 w-4',
                    selectedResolution === 'overwrite_target' ? 'text-rose-400' : 'text-slate-400'
                  )} />
                </div>
                <div className="flex-1">
                  <div className={cn(
                    'text-sm font-medium',
                    selectedResolution === 'overwrite_target' ? 'text-rose-300' : 'text-slate-200'
                  )}>
                    按指定目标替换
                  </div>
                  <div className={cn(
                    'text-xs',
                    selectedResolution === 'overwrite_target' ? 'text-rose-300/70' : 'text-slate-400'
                  )}>
                    选择一个现有记录，用导入数据覆盖它
                  </div>
                </div>
              </button>

              {showTargetSelect && (
                <div className="pl-11 space-y-2 animate-in fade-in slide-in-from-left-2 duration-200">
                  <div className="text-xs text-slate-400">选择要替换的目标：</div>
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-slate-600 bg-slate-900/50 p-2">
                    {existingTargetOptions.map((opt) => (
                      <button
                        key={opt.provenance_id}
                        type="button"
                        onClick={() => setSelectedTargetId(opt.provenance_id)}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded text-xs transition-colors',
                          selectedTargetId === opt.provenance_id
                            ? 'bg-rose-500/15 text-rose-300'
                            : 'text-slate-300 hover:bg-slate-700/50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {opt.entity_type === 'snapshot'
                            ? <FileText className="h-3 w-3 text-sky-400" />
                            : <FileCheck className="h-3 w-3 text-amber-400" />}
                          <span className="font-medium">{opt.current_name}</span>
                          {opt.is_original && <span className="text-[10px] text-teal-400">·原件</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 pl-5 mt-0.5">
                          {opt.event_count} 条事件 · 分支深度 {opt.branch_depth}
                        </div>
                      </button>
                    ))}
                    {existingTargetOptions.length === 0 && (
                      <div className="text-xs text-slate-500 py-2 text-center">
                        没有可选的目标记录
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-5 py-3">
            <button
              type="button"
              onClick={() => onResolve('cancel')}
              className={cn(
                'flex items-center gap-1.5 rounded-md border border-slate-600',
                'px-4 py-2 text-sm font-medium text-slate-300',
                'hover:bg-slate-700 hover:text-slate-100 transition-colors'
              )}
            >
              <XCircle className="h-4 w-4" />
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedResolution || (selectedResolution === 'overwrite_target' && !selectedTargetId)}
              className={cn(
                'flex items-center gap-1.5 rounded-md',
                'px-4 py-2 text-sm font-medium text-white transition-colors',
                (!selectedResolution || (selectedResolution === 'overwrite_target' && !selectedTargetId))
                  ? 'bg-slate-600 cursor-not-allowed'
                  : selectedResolution === 'keep_existing'
                    ? 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700'
                    : selectedResolution === 'branch'
                      ? 'bg-violet-500 hover:bg-violet-600 active:bg-violet-700'
                      : 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700'
              )}
            >
              {selectedResolution === 'keep_existing' ? <ShieldCheck className="h-4 w-4" /> :
               selectedResolution === 'branch' ? <GitBranch className="h-4 w-4" /> :
               <Replace className="h-4 w-4" />}
              确认
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
