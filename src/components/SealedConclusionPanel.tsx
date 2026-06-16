import { useState, useMemo, useRef, useCallback } from 'react';
import { useBoardStore } from '@/store';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';
import { downloadBlob } from '@/utils/exporters';
import type { SealedEventConclusion, SealedConclusionConflict, RiskLevel, SnapshotSource } from '@/types';
import {
  X,
  FileCheck,
  Download,
  Upload,
  Trash2,
  Eye,
  RotateCcw,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Search,
  ArrowUpDown,
  ScrollText,
  Undo2,
  Filter,
} from 'lucide-react';

type SortKey = 'snapshot_name' | 'sealed_at' | 'risk_level' | 'status';
type SortDir = 'asc' | 'desc';

function getSourceDisplayName(item: { source?: SnapshotSource; name?: string; snapshot_name?: string }): string {
  return item.source?.current_name || item.name || item.snapshot_name || '';
}

function getSourceOriginalName(item: { source?: SnapshotSource; name?: string; snapshot_name?: string }): string | undefined {
  return item.source?.original_name;
}

interface SealedConclusionPanelProps {
  open: boolean;
  onClose: () => void;
  onViewDetail: (conclusion: SealedEventConclusion) => void;
  onConflict: (conclusions: SealedEventConclusion[], conflict: SealedConclusionConflict) => void;
  onShowLogs: () => void;
}

const RISK_BADGE: Record<RiskLevel, { cls: string; icon: React.ReactNode }> = {
  high: {
    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    icon: <ShieldAlert className="h-3 w-3" />,
  },
  medium: {
    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  low: {
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    icon: <ShieldCheck className="h-3 w-3" />,
  },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: '待复核', cls: 'text-sky-300 bg-sky-500/15 border-sky-500/40' },
  confirmed: { label: '已确认', cls: 'text-teal-300 bg-teal-500/15 border-teal-500/40' },
  false_alarm: { label: '误报', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40' },
  closed: { label: '已关闭', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40' },
};

export default function SealedConclusionPanel({ open, onClose, onViewDetail, onConflict, onShowLogs }: SealedConclusionPanelProps) {
  const sealedConclusions = useBoardStore((s) => s.sealedConclusions);
  const restoreSealedConclusion = useBoardStore((s) => s.restoreSealedConclusion);
  const canUndoSealedConclusionRestore = useBoardStore((s) => s.canUndoSealedConclusionRestore);
  const undoSealedConclusionRestore = useBoardStore((s) => s.undoSealedConclusionRestore);
  const exportSealedConclusionsJson = useBoardStore((s) => s.exportSealedConclusionsJson);
  const checkSealedConclusionConflict = useBoardStore((s) => s.checkSealedConclusionConflict);
  const importSealedConclusions = useBoardStore((s) => s.importSealedConclusions);
  const deleteSealedConclusion = useBoardStore((s) => s.deleteSealedConclusion);
  const sealedConclusionOpLogs = useBoardStore((s) => s.sealedConclusionOpLogs);

  const [sortKey, setSortKey] = useState<SortKey>('sealed_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchText, setSearchText] = useState('');
  const [filterRisk, setFilterRisk] = useState<RiskLevel | ''>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSnapshot, setFilterSnapshot] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const snapshotOptions = useMemo(() => {
    const set = new Set(sealedConclusions.map(c => getSourceDisplayName(c)));
    return Array.from(set).sort();
  }, [sealedConclusions]);

  const sorted = useMemo(() => {
    let list = [...sealedConclusions];
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(c =>
        getSourceDisplayName(c).toLowerCase().includes(q) ||
        c.event_id.toLowerCase().includes(q) ||
        c.evidence_summary.canonical_allergen.toLowerCase().includes(q) ||
        c.latest_note.toLowerCase().includes(q)
      );
    }
    if (filterRisk) {
      list = list.filter(c => c.risk_level === filterRisk);
    }
    if (filterStatus) {
      list = list.filter(c => c.status === filterStatus);
    }
    if (filterSnapshot) {
      list = list.filter(c => getSourceDisplayName(c) === filterSnapshot);
    }
    list.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'snapshot_name':
          va = getSourceDisplayName(a);
          vb = getSourceDisplayName(b);
          break;
        case 'sealed_at':
          va = a.sealed_at;
          vb = b.sealed_at;
          break;
        case 'risk_level':
          const riskOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
          va = riskOrder[a.risk_level];
          vb = riskOrder[b.risk_level];
          break;
        case 'status':
          va = a.status;
          vb = b.status;
          break;
        default:
          va = a.sealed_at;
          vb = b.sealed_at;
      }
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return list;
  }, [sealedConclusions, sortKey, sortDir, searchText, filterRisk, filterStatus, filterSnapshot]);

  const handleExportAll = () => {
    const json = exportSealedConclusionsJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(blob, `sealed-conclusions-${ts}.json`);
  };

  const handleExportOne = (id: string) => {
    const json = exportSealedConclusionsJson([id]);
    const conc = sealedConclusions.find(c => c.conclusion_id === id);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `conclusion-${getSourceDisplayName(conc) || id}.json`);
  };

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let incomingList: SealedEventConclusion[];
      if (Array.isArray(parsed)) {
        incomingList = parsed;
      } else if (parsed && parsed._type === 'sealed-conclusion-package' && Array.isArray(parsed.conclusions)) {
        incomingList = parsed.conclusions;
      } else if (parsed && parsed.conclusion_id && parsed.event_id) {
        incomingList = [parsed];
      } else {
        return;
      }

      const conflict = checkSealedConclusionConflict(incomingList);
      if (conflict.snapshot_name_conflict || conflict.event_id_conflicts.length > 0 || conflict.conclusion_id_conflicts.length > 0) {
        onConflict(incomingList, conflict);
      } else {
        importSealedConclusions(incomingList, 'copy');
      }
    } catch { /* invalid file */ }
  }, [checkSealedConclusionConflict, importSealedConclusions, onConflict]);

  const handleRestore = (id: string) => {
    restoreSealedConclusion(id);
  };

  const handleUndoRestore = () => {
    undoSealedConclusionRestore();
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
          'flex w-full max-w-5xl flex-col rounded-md shadow-2xl',
          'bg-slate-800 border border-slate-700 max-h-[85vh]'
        )}>
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 flex-none">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-teal-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">封存结论页</h2>
                <p className="text-xs text-slate-500">查看、对比、回放封存的事件结论</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className={cn(
              'flex h-8 w-8 flex-none items-center justify-center rounded-md',
              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
            )}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-2 flex items-center gap-2 flex-none border-b border-slate-700/60 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="搜索快照名、事件ID、过敏原、备注..."
                className="input pl-7 py-1 text-xs w-full"
              />
            </div>
            <select
              value={filterSnapshot}
              onChange={e => setFilterSnapshot(e.target.value)}
              className={cn(
                'appearance-none rounded-md border border-slate-600 bg-slate-700 pr-6 pl-2 py-1',
                'text-xs text-slate-300 hover:border-slate-500 focus:outline-none transition-colors'
              )}
            >
              <option value="">全部快照</option>
              {snapshotOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={filterRisk}
              onChange={e => setFilterRisk(e.target.value as RiskLevel | '')}
              className={cn(
                'appearance-none rounded-md border border-slate-600 bg-slate-700 pr-6 pl-2 py-1',
                'text-xs text-slate-300 hover:border-slate-500 focus:outline-none transition-colors'
              )}
            >
              <option value="">全部风险</option>
              <option value="high">高风险</option>
              <option value="medium">中风险</option>
              <option value="low">低风险</option>
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className={cn(
                'appearance-none rounded-md border border-slate-600 bg-slate-700 pr-6 pl-2 py-1',
                'text-xs text-slate-300 hover:border-slate-500 focus:outline-none transition-colors'
              )}
            >
              <option value="">全部状态</option>
              <option value="pending">待复核</option>
              <option value="confirmed">已确认</option>
              <option value="false_alarm">误报</option>
              <option value="closed">已关闭</option>
            </select>
            <button
              type="button"
              onClick={handleExportAll}
              disabled={sealedConclusions.length === 0}
              className={cn(
                'flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1',
                'text-xs font-medium transition-colors',
                sealedConclusions.length > 0
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
            <button
              type="button"
              onClick={onShowLogs}
              className={cn(
                'flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1',
                'text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors'
              )}
            >
              <ScrollText className="h-3 w-3" />
              日志{sealedConclusionOpLogs.length > 0 && <span className="text-teal-400">({sealedConclusionOpLogs.length})</span>}
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
            {sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <FileCheck className="h-8 w-8 mb-2" />
                <div className="text-sm">暂无封存结论</div>
                <div className="text-xs mt-1">封存快照时会自动创建事件结论副本</div>
              </div>
            )}
            {sorted.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 text-xs text-slate-500 sticky top-0 bg-slate-800">
                    <th className="text-left px-4 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('snapshot_name')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        快照 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('sealed_at')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        封存时间 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-center px-2 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('risk_level')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        风险 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-center px-2 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        状态 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2 font-medium">过敏原</th>
                    <th className="text-left px-3 py-2 font-medium">证据摘要</th>
                    <th className="text-left px-3 py-2 font-medium">备注</th>
                    <th className="text-right px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(conc => (
                    <tr key={conc.conclusion_id} className="border-b border-slate-700/40 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-200 truncate max-w-[150px]" title={getSourceDisplayName(conc)}>{getSourceDisplayName(conc)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(conc.sealed_at, 'datetime')}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-medium', RISK_BADGE[conc.risk_level].cls)}>
                          {RISK_BADGE[conc.risk_level].icon}{conc.risk_level === 'high' ? '高' : conc.risk_level === 'medium' ? '中' : '低'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium', STATUS_LABELS[conc.status]?.cls)}>
                          {STATUS_LABELS[conc.status]?.label || conc.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-300">
                        <div className="font-medium text-teal-300">{conc.evidence_summary.canonical_allergen}</div>
                        {conc.evidence_summary.matched_aliases.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                            {conc.evidence_summary.matched_aliases.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Filter className="h-3 w-3 text-slate-500" />
                          <span>{conc.evidence_summary.total_evidence} 条证据</span>
                          <span className="text-slate-600">·</span>
                          <span>{conc.evidence_summary.student_count} 人</span>
                        </div>
                        {conc.evidence_summary.evidence_types.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {conc.evidence_summary.evidence_types.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        <div className="truncate max-w-[180px]" title={conc.latest_note}>
                          {conc.latest_note || <span className="text-slate-600">无备注</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onViewDetail(conc)}
                            title="查看详情与对比"
                            className={cn(
                              'flex items-center justify-center h-7 w-7 rounded-md',
                              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
                            )}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestore(conc.conclusion_id)}
                            title="回放到工作台"
                            className={cn(
                              'flex items-center justify-center h-7 w-7 rounded-md',
                              'text-sky-400 hover:bg-sky-500/15 transition-colors'
                            )}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportOne(conc.conclusion_id)}
                            title="导出JSON"
                            className={cn(
                              'flex items-center justify-center h-7 w-7 rounded-md',
                              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
                            )}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSealedConclusion(conc.conclusion_id)}
                            title="删除"
                            className={cn(
                              'flex items-center justify-center h-7 w-7 rounded-md',
                              'text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors'
                            )}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {canUndoSealedConclusionRestore() && (
            <div className="border-t border-sky-500/40 bg-sky-500/10 px-5 py-2.5 flex items-center justify-between flex-none">
              <span className="text-xs text-sky-300">可撤销上一次结论回放操作</span>
              <button
                type="button"
                onClick={handleUndoRestore}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1',
                  'text-xs font-medium text-sky-300',
                  'hover:bg-sky-500/20 transition-colors'
                )}
              >
                <Undo2 className="h-3 w-3" />
                撤销回放
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-5 py-3 flex-none">
            <div className="text-xs text-slate-500">
              共 {sealedConclusions.length} 条封存结论
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
