import { useState, useMemo, useRef, useCallback } from 'react';
import { useBoardStore } from '@/store';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';
import { downloadBlob } from '@/utils/exporters';
import type {
  ProvenanceSummary,
  ProvenanceTimelineNode,
  ProvenanceExportPackage,
  ProvenanceImportConflict,
  ProvenanceImportResolution,
  ProvenanceGenerationMethod,
} from '@/types';
import {
  X,
  GitBranch,
  Download,
  Upload,
  Eye,
  Clock,
  Search,
  ArrowUpDown,
  History,
  Trash2,
  Play,
  Undo2,
  ChevronRight,
  ChevronDown,
  FileText,
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  SplitSquareVertical,
  Save,
  AlertCircle,
  Copy,
  Replace,
  SkipForward,
  XCircle,
  Layers,
} from 'lucide-react';

type SortKey = 'original_name' | 'current_name' | 'created_at' | 'event_count' | 'branch_depth';
type SortDir = 'asc' | 'desc';

interface ProvenancePanelProps {
  open: boolean;
  onClose: () => void;
  onConflict: (
    pkg: ProvenanceExportPackage,
    conflict: ProvenanceImportConflict
  ) => void;
}

const METHOD_LABELS: Record<ProvenanceGenerationMethod, { label: string; cls: string; icon: React.ReactNode }> = {
  seal: { label: '原始封存', cls: 'text-teal-300 bg-teal-500/15 border-teal-500/40', icon: <FileCheck className="h-3 w-3" /> },
  import_copy: { label: '导入副本', cls: 'text-sky-300 bg-sky-500/15 border-sky-500/40', icon: <Copy className="h-3 w-3" /> },
  import_overwrite: { label: '导入覆盖', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40', icon: <Replace className="h-3 w-3" /> },
  import_skip: { label: '导入跳过', cls: 'text-slate-300 bg-slate-500/15 border-slate-500/40', icon: <SkipForward className="h-3 w-3" /> },
  branch: { label: '分支派生', cls: 'text-violet-300 bg-violet-500/15 border-violet-500/40', icon: <GitBranch className="h-3 w-3" /> },
  overwrite: { label: '覆盖替换', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40', icon: <Replace className="h-3 w-3" /> },
  copy: { label: '复制副本', cls: 'text-sky-300 bg-sky-500/15 border-sky-500/40', icon: <Copy className="h-3 w-3" /> },
  restore: { label: '正式恢复', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40', icon: <Play className="h-3 w-3" /> },
  undo_restore: { label: '撤销恢复', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/40', icon: <Undo2 className="h-3 w-3" /> },
  temp_restore: { label: '临时恢复', cls: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/40', icon: <Eye className="h-3 w-3" /> },
  temp_restore_discard: { label: '丢弃临时', cls: 'text-slate-300 bg-slate-500/15 border-slate-500/40', icon: <XCircle className="h-3 w-3" /> },
};

function TimelineNode({
  node,
  depth,
  onRestore,
  onBranch,
  onSelect,
  selectedId,
}: {
  node: ProvenanceTimelineNode;
  depth: number;
  onRestore: (id: string) => void;
  onBranch: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const methodInfo = METHOD_LABELS[node.provenance.generation_method];
  const isSelected = selectedId === node.provenance.provenance_id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
          isSelected ? 'bg-teal-500/15 border border-teal-500/40' : 'hover:bg-slate-700/30 border border-transparent'
        )}
        style={{ marginLeft: `${depth * 24}px` }}
        onClick={() => onSelect(node.provenance.provenance_id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-4 h-4" />
        )}
        
        <div className="w-1 h-1 rounded-full bg-slate-500" />
        
        <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium', methodInfo.cls)}>
          {methodInfo.icon}
          {methodInfo.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">
            {node.provenance.current_name}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {formatTime(node.provenance.created_at, 'datetime')}
            {node.provenance.is_original && <span className="text-teal-400 ml-2">· 原件</span>}
          </div>
        </div>

        <div className="text-xs text-slate-400">
          {node.provenance.event_count} 条事件
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRestore(node.provenance.provenance_id); }}
            title="临时恢复到工作台比对"
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-md',
              'text-cyan-400 hover:bg-cyan-500/15 transition-colors'
            )}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onBranch(node.provenance.provenance_id); }}
            title="创建分支"
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-md',
              'text-violet-400 hover:bg-violet-500/15 transition-colors'
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="border-l border-slate-700 ml-4">
          {node.children.map((child) => (
            <TimelineNode
              key={child.provenance.provenance_id}
              node={child}
              depth={depth + 1}
              onRestore={onRestore}
              onBranch={onBranch}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BranchModal({
  open,
  currentName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  currentName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(`${currentName} - 分支`);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={cn(
          'flex w-full max-w-md flex-col rounded-md shadow-2xl',
          'bg-slate-800 border border-slate-700'
        )}>
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-violet-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">创建分支</h2>
                <p className="text-xs text-slate-500">基于当前版本创建新的分支副本</p>
              </div>
            </div>
            <button type="button" onClick={onCancel} className={cn(
              'flex h-8 w-8 flex-none items-center justify-center rounded-md',
              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
            )}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">原名称</label>
              <div className="text-sm text-slate-200 bg-slate-700/50 rounded-md px-3 py-2">
                {currentName}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">新分支名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(name); }}
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-5 py-3">
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                'flex items-center gap-1.5 rounded-md border border-slate-600',
                'px-4 py-2 text-sm font-medium text-slate-300',
                'hover:bg-slate-700 hover:text-slate-100 transition-colors'
              )}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => onConfirm(name)}
              disabled={!name.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-md',
                'px-4 py-2 text-sm font-medium text-white',
                name.trim()
                  ? 'bg-violet-500 hover:bg-violet-600 active:bg-violet-700'
                  : 'bg-slate-600 cursor-not-allowed',
                'transition-colors'
              )}
            >
              <GitBranch className="h-4 w-4" />
              创建分支
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailPanel({
  provenanceId,
  onClose,
}: {
  provenanceId: string | null;
  onClose: () => void;
}) {
  const getProvenanceById = useBoardStore((s) => s.getProvenanceById);
  const getProvenanceTimeline = useBoardStore((s) => s.getProvenanceTimeline);
  const getProvenanceChildren = useBoardStore((s) => s.getProvenanceChildren);
  const temporaryRestore = useBoardStore((s) => s.temporaryRestore);
  const branchProvenance = useBoardStore((s) => s.branchProvenance);
  const canDiscardTemporaryRestore = useBoardStore((s) => s.canDiscardTemporaryRestore);
  const discardTemporaryRestore = useBoardStore((s) => s.discardTemporaryRestore);
  const hasActiveTemporaryRestore = useBoardStore((s) => s.hasActiveTemporaryRestore);

  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchTargetId, setBranchTargetId] = useState<string | null>(null);

  if (!provenanceId) return null;

  const provenance = getProvenanceById(provenanceId);
  if (!provenance) return null;

  const timeline = getProvenanceTimeline(provenance.root_provenance_id);
  const children = getProvenanceChildren(provenanceId);
  const methodInfo = METHOD_LABELS[provenance.generation_method];

  const handleRestore = () => {
    temporaryRestore(provenanceId);
  };

  const handleBranch = () => {
    setBranchTargetId(provenanceId);
    setBranchModalOpen(true);
  };

  const handleConfirmBranch = (newName: string) => {
    if (branchTargetId) {
      branchProvenance(branchTargetId, newName);
    }
    setBranchModalOpen(false);
    setBranchTargetId(null);
  };

  return (
    <>
      <div className="border-l border-slate-700 w-80 flex flex-col bg-slate-800/50">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-200">来历详情</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium', methodInfo.cls)}>
                {methodInfo.icon}
                {methodInfo.label}
              </span>
              {provenance.is_original && (
                <span className="inline-flex items-center gap-1 rounded border border-teal-500/40 bg-teal-500/15 px-2 py-1 text-xs font-medium text-teal-300">
                  <FileCheck className="h-3 w-3" />
                  原件
                </span>
              )}
            </div>

            <div className="text-lg font-semibold text-slate-100">
              {provenance.current_name}
            </div>

            {provenance.original_name !== provenance.current_name && (
              <div className="text-xs text-slate-500">
                原名: {provenance.original_name}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-500 mb-1">事件数</div>
              <div className="text-lg font-semibold text-slate-200">{provenance.event_count}</div>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-500 mb-1">分支深度</div>
              <div className="text-lg font-semibold text-slate-200">{provenance.branch_depth}</div>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-500 mb-1">冲突决策</div>
              <div className="text-lg font-semibold text-slate-200">{provenance.conflict_decisions.length}</div>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-500 mb-1">子节点</div>
              <div className="text-lg font-semibold text-slate-200">{children.length}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-400">时间信息</div>
            <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">创建时间</span>
                <span className="text-slate-300 font-mono">{formatTime(provenance.created_at, 'datetime')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">更新时间</span>
                <span className="text-slate-300 font-mono">{formatTime(provenance.updated_at, 'datetime')}</span>
              </div>
              {provenance.last_playback_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">最近回放</span>
                  <span className="text-cyan-300 font-mono">{formatTime(provenance.last_playback_at, 'datetime')}</span>
                </div>
              )}
            </div>
          </div>

          {provenance.parent_provenance_id && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400">父级来历</div>
              <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3 text-xs">
                <div className="text-slate-500 font-mono text-[10px]">{provenance.parent_provenance_id}</div>
              </div>
            </div>
          )}

          {provenance.import_batch_name && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400">导入批次</div>
              <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3 text-xs">
                <div className="text-slate-300">{provenance.import_batch_name}</div>
                <div className="text-slate-500 font-mono text-[10px] mt-1">{provenance.import_batch_id}</div>
              </div>
            </div>
          )}

          {provenance.conflict_decisions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400">冲突决策历史</div>
              <div className="space-y-1.5">
                {provenance.conflict_decisions.map((dec, i) => (
                  <div key={i} className="rounded-md border border-slate-700 bg-slate-800/40 p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                        dec.resolution === 'overwrite' ? 'text-rose-300 bg-rose-500/15' :
                        dec.resolution === 'branch' ? 'text-violet-300 bg-violet-500/15' :
                        dec.resolution === 'keep_existing' ? 'text-emerald-300 bg-emerald-500/15' :
                        'text-slate-300 bg-slate-500/15'
                      )}>
                        {dec.resolution === 'overwrite' ? '覆盖' :
                         dec.resolution === 'branch' ? '分支' :
                         dec.resolution === 'keep_existing' ? '保留' : '跳过'}
                      </span>
                      <span className="text-slate-500">{dec.type}</span>
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      现有: {dec.existing_name}
                    </div>
                    <div className="text-slate-500 text-[10px] font-mono mt-0.5">
                      {formatTime(dec.resolved_at, 'datetime')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-400">身份签名</div>
            <div className="rounded-md border border-slate-700 bg-slate-900/40 p-2 font-mono text-[10px] text-slate-400 break-all">
              {provenance.identity_signature}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 p-3 space-y-2">
          {canDiscardTemporaryRestore() && (
            <button
              type="button"
              onClick={discardTemporaryRestore}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 rounded-md',
                'bg-amber-500 px-3 py-2 text-sm font-medium text-white',
                'hover:bg-amber-600 active:bg-amber-700 transition-colors'
              )}
            >
              <Undo2 className="h-4 w-4" />
              丢弃临时恢复
            </button>
          )}
          {!hasActiveTemporaryRestore() && (
            <button
              type="button"
              onClick={handleRestore}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 rounded-md',
                'bg-cyan-500 px-3 py-2 text-sm font-medium text-white',
                'hover:bg-cyan-600 active:bg-cyan-700 transition-colors'
              )}
            >
              <Eye className="h-4 w-4" />
              临时恢复到工作台
            </button>
          )}
          <button
            type="button"
            onClick={handleBranch}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 rounded-md',
              'bg-violet-500 px-3 py-2 text-sm font-medium text-white',
              'hover:bg-violet-600 active:bg-violet-700 transition-colors'
            )}
          >
            <GitBranch className="h-4 w-4" />
            创建分支
          </button>
        </div>
      </div>

      <BranchModal
        open={branchModalOpen}
        currentName={provenance.current_name}
        onConfirm={handleConfirmBranch}
        onCancel={() => { setBranchModalOpen(false); setBranchTargetId(null); }}
      />
    </>
  );
}

export default function ProvenancePanel({ open, onClose, onConflict }: ProvenancePanelProps) {
  const provenanceRecords = useBoardStore((s) => s.provenanceRecords);
  const temporaryRestoreSession = useBoardStore((s) => s.temporaryRestoreSession);
  const getProvenanceSummaries = useBoardStore((s) => s.getProvenanceSummaries);
  const getProvenanceTimeline = useBoardStore((s) => s.getProvenanceTimeline);
  const checkProvenanceImportConflict = useBoardStore((s) => s.checkProvenanceImportConflict);
  const importProvenancePackage = useBoardStore((s) => s.importProvenancePackage);
  const exportProvenancePackage = useBoardStore((s) => s.exportProvenancePackage);
  const temporaryRestore = useBoardStore((s) => s.temporaryRestore);
  const branchProvenance = useBoardStore((s) => s.branchProvenance);
  const canDiscardTemporaryRestore = useBoardStore((s) => s.canDiscardTemporaryRestore);
  const discardTemporaryRestore = useBoardStore((s) => s.discardTemporaryRestore);
  const hasActiveTemporaryRestore = useBoardStore((s) => s.hasActiveTemporaryRestore);

  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'snapshot' | 'conclusion'>('all');
  const [filterMethod, setFilterMethod] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedTimelineRoot, setExpandedTimelineRoot] = useState<string | null>(null);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchTargetId, setBranchTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const summaries = useMemo(() => {
    let list = getProvenanceSummaries();
    
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(s =>
        s.original_name.toLowerCase().includes(q) ||
        s.current_name.toLowerCase().includes(q)
      );
    }
    
    if (filterType !== 'all') {
      list = list.filter(s => s.entity_type === filterType);
    }
    
    if (filterMethod) {
      list = list.filter(s => s.generation_method === filterMethod);
    }

    list.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'original_name':
          va = a.original_name;
          vb = b.original_name;
          break;
        case 'current_name':
          va = a.current_name;
          vb = b.current_name;
          break;
        case 'created_at':
          va = a.created_at;
          vb = b.created_at;
          break;
        case 'event_count':
          va = a.event_count;
          vb = b.event_count;
          break;
        case 'branch_depth':
          va = a.branch_depth;
          vb = b.branch_depth;
          break;
        default:
          va = a.created_at;
          vb = b.created_at;
      }
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    return list;
  }, [provenanceRecords, getProvenanceSummaries, sortKey, sortDir, searchText, filterType, filterMethod]);

  const timelineRoots = useMemo(() => {
    const roots = new Map<string, ProvenanceSummary>();
    for (const s of summaries) {
      if (!roots.has(s.provenance_id) && s.is_original) {
        roots.set(s.provenance_id, s);
      }
    }
    return Array.from(roots.values());
  }, [summaries]);

  const handleExportOne = (id: string) => {
    const json = exportProvenancePackage([id]);
    const summary = summaries.find(s => s.provenance_id === id);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `provenance-${summary?.current_name || id}.json`);
  };

  const handleExportAll = () => {
    const ids = summaries.map(s => s.provenance_id);
    const json = exportProvenancePackage(ids);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(blob, `provenance-ledger-${ts}.json`);
  };

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let pkg: ProvenanceExportPackage;

      if (parsed && parsed._type === 'provenance-package') {
        pkg = parsed;
      } else if (parsed && parsed._type === 'review-snapshot-package') {
        return;
      } else if (parsed && parsed._type === 'sealed-conclusion-package') {
        return;
      } else {
        return;
      }

      const conflict = checkProvenanceImportConflict(pkg);
      if (
        conflict.provenance_id_conflicts.length > 0 ||
        conflict.entity_id_conflicts.length > 0 ||
        conflict.name_conflicts.length > 0 ||
        conflict.identity_conflicts.length > 0
      ) {
        onConflict(pkg, conflict);
      } else {
        importProvenancePackage(pkg, 'branch');
      }
    } catch { /* invalid file */ }
  }, [checkProvenanceImportConflict, importProvenancePackage, onConflict]);

  const handleRestore = (id: string) => {
    temporaryRestore(id);
  };

  const handleBranch = (id: string) => {
    setBranchTargetId(id);
    setBranchModalOpen(true);
  };

  const handleConfirmBranch = (newName: string) => {
    if (branchTargetId) {
      branchProvenance(branchTargetId, newName);
    }
    setBranchModalOpen(false);
    setBranchTargetId(null);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={cn(
          'flex w-full max-w-6xl flex-col rounded-md shadow-2xl',
          'bg-slate-800 border border-slate-700 max-h-[85vh]'
        )}>
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 flex-none">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-violet-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">结论来历账本</h2>
                <p className="text-xs text-slate-500">追踪每份封存和副本的完整来龙去脉</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className={cn(
              'flex h-8 w-8 flex-none items-center justify-center rounded-md',
              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
            )}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 py-2 flex items-center gap-2 flex-none border-b border-slate-700/60 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    placeholder="搜索原始名称、当前名称..."
                    className="input pl-7 py-1 text-xs w-full"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'px-2 py-0.5 rounded text-xs transition-colors',
                      viewMode === 'list' ? 'bg-slate-600 text-slate-200' : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    列表
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('timeline')}
                    className={cn(
                      'px-2 py-0.5 rounded text-xs transition-colors',
                      viewMode === 'timeline' ? 'bg-slate-600 text-slate-200' : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    时间线
                  </button>
                </div>

                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className={cn(
                    'appearance-none rounded-md border border-slate-600 bg-slate-700 pr-6 pl-2 py-1',
                    'text-xs text-slate-300 hover:border-slate-500 focus:outline-none transition-colors'
                  )}
                >
                  <option value="all">全部类型</option>
                  <option value="snapshot">快照</option>
                  <option value="conclusion">结论</option>
                </select>

                <select
                  value={filterMethod}
                  onChange={e => setFilterMethod(e.target.value)}
                  className={cn(
                    'appearance-none rounded-md border border-slate-600 bg-slate-700 pr-6 pl-2 py-1',
                    'text-xs text-slate-300 hover:border-slate-500 focus:outline-none transition-colors'
                  )}
                >
                  <option value="">全部方式</option>
                  {Object.entries(METHOD_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleExportAll}
                  disabled={summaries.length === 0}
                  className={cn(
                    'flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1',
                    'text-xs font-medium transition-colors',
                    summaries.length > 0
                      ? 'text-slate-300 hover:bg-slate-700'
                      : 'text-slate-600 cursor-not-allowed'
                  )}
                >
                  <Download className="h-3 w-3" />
                  导出全部
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1',
                    'text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors'
                  )}
                >
                  <Upload className="h-3 w-3" />
                  导入
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                {summaries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                    <Layers className="h-8 w-8 mb-2" />
                    <div className="text-sm">暂下来历记录</div>
                    <div className="text-xs mt-1">封存快照时会自动记录来历信息</div>
                  </div>
                )}

                {viewMode === 'list' && summaries.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/60 text-xs text-slate-500 sticky top-0 bg-slate-800">
                        <th className="text-left px-4 py-2 font-medium">
                          <button type="button" onClick={() => toggleSort('current_name')} className="inline-flex items-center gap-1 hover:text-slate-300">
                            名称 <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="text-left px-3 py-2 font-medium">类型</th>
                        <th className="text-left px-3 py-2 font-medium">生成方式</th>
                        <th className="text-center px-2 py-2 font-medium">
                          <button type="button" onClick={() => toggleSort('event_count')} className="inline-flex items-center gap-1 hover:text-slate-300">
                            事件 <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="text-center px-2 py-2 font-medium">
                          <button type="button" onClick={() => toggleSort('branch_depth')} className="inline-flex items-center gap-1 hover:text-slate-300">
                            深度 <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="text-left px-3 py-2 font-medium">
                          <button type="button" onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-slate-300">
                            创建时间 <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="text-left px-3 py-2 font-medium">最近回放</th>
                        <th className="text-right px-4 py-2 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map(s => {
                        const methodInfo = METHOD_LABELS[s.generation_method];
                        return (
                          <tr
                            key={s.provenance_id}
                            className={cn(
                              'border-b border-slate-700/40 hover:bg-slate-700/30 transition-colors cursor-pointer',
                              selectedId === s.provenance_id && 'bg-teal-500/10'
                            )}
                            onClick={() => setSelectedId(s.provenance_id)}
                          >
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-slate-200 truncate max-w-[180px]" title={s.current_name}>
                                {s.current_name}
                                {s.is_original && <span className="ml-1 text-[10px] text-teal-400">·原件</span>}
                              </div>
                              {s.original_name !== s.current_name && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                                  原名: {s.original_name}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={cn(
                                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                                s.entity_type === 'snapshot'
                                  ? 'text-sky-300 bg-sky-500/15 border-sky-500/40'
                                  : 'text-amber-300 bg-amber-500/15 border-amber-500/40'
                              )}>
                                {s.entity_type === 'snapshot' ? <FileText className="h-3 w-3" /> : <FileCheck className="h-3 w-3" />}
                                {s.entity_type === 'snapshot' ? '快照' : '结论'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium', methodInfo.cls)}>
                                {methodInfo.icon}{methodInfo.label}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-center text-xs text-slate-300">{s.event_count}</td>
                            <td className="px-2 py-2.5 text-center text-xs text-slate-300">{s.branch_depth}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-400">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(s.created_at, 'datetime')}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-400">
                              {s.last_playback_at ? (
                                <div className="flex items-center gap-1 text-cyan-400">
                                  <Eye className="h-3 w-3" />
                                  {formatTime(s.last_playback_at, 'datetime')}
                                </div>
                              ) : (
                                <span className="text-slate-600">未回放</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleRestore(s.provenance_id); }}
                                  title="临时恢复到工作台比对"
                                  className={cn(
                                    'flex items-center justify-center h-7 w-7 rounded-md',
                                    'text-cyan-400 hover:bg-cyan-500/15 transition-colors'
                                  )}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleBranch(s.provenance_id); }}
                                  title="创建分支"
                                  className={cn(
                                    'flex items-center justify-center h-7 w-7 rounded-md',
                                    'text-violet-400 hover:bg-violet-500/15 transition-colors'
                                  )}
                                >
                                  <GitBranch className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleExportOne(s.provenance_id); }}
                                  title="导出JSON"
                                  className={cn(
                                    'flex items-center justify-center h-7 w-7 rounded-md',
                                    'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
                                  )}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {viewMode === 'timeline' && timelineRoots.length > 0 && (
                  <div className="p-4 space-y-4">
                    {timelineRoots.map(root => {
                      const timeline = getProvenanceTimeline(root.provenance_id);
                      if (!timeline) return null;
                      const isExpanded = expandedTimelineRoot === root.provenance_id;
                      return (
                        <div key={root.provenance_id} className="rounded-md border border-slate-700 bg-slate-800/40 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedTimelineRoot(isExpanded ? null : root.provenance_id)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                              <Layers className="h-4 w-4 text-violet-400" />
                              <span className="font-medium text-slate-200">{root.current_name}</span>
                              <span className="text-xs text-slate-500">({root.event_count} 条事件, {timeline.children.length + 1} 个版本)</span>
                            </div>
                            <span className="text-xs text-slate-500 font-mono">{formatTime(root.created_at, 'date')}</span>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-slate-700 p-3">
                              <TimelineNode
                                node={timeline}
                                depth={0}
                                onRestore={handleRestore}
                                onBranch={handleBranch}
                                onSelect={setSelectedId}
                                selectedId={selectedId}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {canDiscardTemporaryRestore() && (
                <div className="border-t border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 flex items-center justify-between flex-none">
                  <span className="text-xs text-cyan-300 flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" />
                    存在活跃的临时恢复，回退后不会污染正式结果
                  </span>
                  <button
                    type="button"
                    onClick={discardTemporaryRestore}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1',
                      'text-xs font-medium text-cyan-300',
                      'hover:bg-cyan-500/20 transition-colors'
                    )}
                  >
                    <Undo2 className="h-3 w-3" />
                    丢弃临时恢复
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-5 py-3 flex-none">
                <div className="text-xs text-slate-500">
                  共 {summaries.length} 条来历记录
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

            {selectedId && (
              <DetailPanel
                provenanceId={selectedId}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        </div>
      </div>

      <BranchModal
        open={branchModalOpen}
        currentName={summaries.find(s => s.provenance_id === branchTargetId)?.current_name || ''}
        onConfirm={handleConfirmBranch}
        onCancel={() => { setBranchModalOpen(false); setBranchTargetId(null); }}
      />
    </>
  );
}
