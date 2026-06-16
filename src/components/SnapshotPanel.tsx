import { useState, useMemo, useRef, useCallback } from 'react';
import { useBoardStore } from '@/store';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';
import { downloadBlob } from '@/utils/exporters';
import type { ReviewSnapshot, SnapshotConflict, RiskLevel } from '@/types';
import {
  X,
  Camera,
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
} from 'lucide-react';

type SortKey = 'name' | 'created_at' | 'high_risk' | 'medium_risk' | 'low_risk';
type SortDir = 'asc' | 'desc';

interface SnapshotPanelProps {
  open: boolean;
  onClose: () => void;
  onPreview: (snapshot: ReviewSnapshot) => void;
  onConflict: (snapshot: ReviewSnapshot, conflict: SnapshotConflict) => void;
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

export default function SnapshotPanel({ open, onClose, onPreview, onConflict, onShowLogs }: SnapshotPanelProps) {
  const snapshots = useBoardStore((s) => s.snapshots);
  const sealSnapshot = useBoardStore((s) => s.sealSnapshot);
  const deleteSnapshot = useBoardStore((s) => s.deleteSnapshot);
  const restoreSnapshot = useBoardStore((s) => s.restoreSnapshot);
  const canUndoSnapshotRestore = useBoardStore((s) => s.canUndoSnapshotRestore);
  const undoSnapshotRestore = useBoardStore((s) => s.undoSnapshotRestore);
  const exportSnapshotsJson = useBoardStore((s) => s.exportSnapshotsJson);
  const checkSnapshotConflict = useBoardStore((s) => s.checkSnapshotConflict);
  const importSnapshot = useBoardStore((s) => s.importSnapshot);
  const snapshotOpLogs = useBoardStore((s) => s.snapshotOpLogs);
  const getVisibleEvents = useBoardStore((s) => s.getVisibleEvents);

  const [sealName, setSealName] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchText, setSearchText] = useState('');
  const [filterRisk, setFilterRisk] = useState<RiskLevel | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleCount = getVisibleEvents().length;

  const sorted = useMemo(() => {
    let list = [...snapshots];
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    if (filterRisk) {
      list = list.filter(s => s.risk_stats[filterRisk] > 0);
    }
    list.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'name':
          va = a.name;
          vb = b.name;
          break;
        case 'created_at':
          va = a.created_at;
          vb = b.created_at;
          break;
        case 'high_risk':
          va = a.risk_stats.high;
          vb = b.risk_stats.high;
          break;
        case 'medium_risk':
          va = a.risk_stats.medium;
          vb = b.risk_stats.medium;
          break;
        case 'low_risk':
          va = a.risk_stats.low;
          vb = b.risk_stats.low;
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
  }, [snapshots, sortKey, sortDir, searchText, filterRisk]);

  const handleSeal = () => {
    if (!sealName.trim()) return;
    sealSnapshot(sealName.trim());
    setSealName('');
  };

  const handleExportAll = () => {
    const json = exportSnapshotsJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(blob, `review-snapshots-${ts}.json`);
  };

  const handleExportOne = (id: string) => {
    const json = exportSnapshotsJson([id]);
    const snap = snapshots.find(s => s.snapshot_id === id);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `snapshot-${snap?.name || id}.json`);
  };

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let incomingList: ReviewSnapshot[];
      if (Array.isArray(parsed)) {
        incomingList = parsed;
      } else if (parsed && parsed._type === 'review-snapshot-package' && Array.isArray(parsed.snapshots)) {
        incomingList = parsed.snapshots;
      } else if (parsed && parsed.snapshot_id && parsed.name) {
        incomingList = [parsed];
      } else {
        return;
      }

      for (const incoming of incomingList) {
        const conflict = checkSnapshotConflict(incoming);
        if (conflict.name_conflict || conflict.event_id_conflicts.length > 0) {
          onConflict(incoming, conflict);
        } else {
          importSnapshot(incoming, 'copy');
        }
      }
    } catch { /* invalid snapshot file */ }
  }, [checkSnapshotConflict, importSnapshot, onConflict]);

  const handleRestore = (id: string) => {
    restoreSnapshot(id);
  };

  const handleUndoRestore = () => {
    undoSnapshotRestore();
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
          'flex w-full max-w-3xl flex-col rounded-md shadow-2xl',
          'bg-slate-800 border border-slate-700 max-h-[85vh]'
        )}>
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 flex-none">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-teal-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">复盘快照包</h2>
                <p className="text-xs text-slate-500">封存、回看、导出筛选快照</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className={cn(
              'flex h-8 w-8 flex-none items-center justify-center rounded-md',
              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
            )}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-slate-700 px-5 py-3 flex-none space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={sealName}
                  onChange={e => setSealName(e.target.value)}
                  placeholder="输入快照名称..."
                  className={cn(
                    'w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 pr-16',
                    'text-sm text-slate-200 placeholder:text-slate-500',
                    'hover:border-slate-500 focus:border-teal-500 focus:outline-none transition-colors'
                  )}
                  onKeyDown={e => { if (e.key === 'Enter') handleSeal(); }}
                />
                <button
                  type="button"
                  onClick={handleSeal}
                  disabled={!sealName.trim() || visibleCount === 0}
                  className={cn(
                    'absolute right-1 top-1 bottom-1 rounded px-2.5 text-xs font-medium transition-colors',
                    sealName.trim() && visibleCount > 0
                      ? 'bg-teal-500 text-white hover:bg-teal-600'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  )}
                >
                  封存
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>当前筛选下 {visibleCount} 条事件可封存</span>
            </div>
          </div>

          <div className="px-5 py-2 flex items-center gap-2 flex-none border-b border-slate-700/60">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="搜索快照名称..."
                className="input pl-7 py-1 text-xs"
              />
            </div>
            <select
              value={filterRisk}
              onChange={e => setFilterRisk(e.target.value as RiskLevel | '')}
              className={cn(
                'appearance-none rounded-md border border-slate-600 bg-slate-700 pr-6 pl-2 py-1',
                'text-xs text-slate-300 hover:border-slate-500 focus:outline-none transition-colors'
              )}
            >
              <option value="">全部风险</option>
              <option value="high">含高风险</option>
              <option value="medium">含中风险</option>
              <option value="low">含低风险</option>
            </select>
            <button
              type="button"
              onClick={handleExportAll}
              disabled={snapshots.length === 0}
              className={cn(
                'flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1',
                'text-xs font-medium transition-colors',
                snapshots.length > 0
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
              日志{snapshotOpLogs.length > 0 && <span className="text-teal-400">({snapshotOpLogs.length})</span>}
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
                <Camera className="h-8 w-8 mb-2" />
                <div className="text-sm">暂无快照</div>
                <div className="text-xs mt-1">封存当前筛选条件下的数据以供回看</div>
              </div>
            )}
            {sorted.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 text-xs text-slate-500">
                    <th className="text-left px-5 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        名称 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        创建时间 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-center px-2 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('high_risk')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        高 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-center px-2 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('medium_risk')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        中 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-center px-2 py-2 font-medium">
                      <button type="button" onClick={() => toggleSort('low_risk')} className="inline-flex items-center gap-1 hover:text-slate-300">
                        低 <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-center px-2 py-2 font-medium">事件</th>
                    <th className="text-right px-5 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(snap => (
                    <tr key={snap.snapshot_id} className="border-b border-slate-700/40 hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="font-medium text-slate-200 truncate max-w-[180px]" title={snap.name}>{snap.name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(snap.created_at, 'datetime')}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {snap.risk_stats.high > 0 && (
                          <span className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-medium', RISK_BADGE.high.cls)}>
                            {RISK_BADGE.high.icon}{snap.risk_stats.high}
                          </span>
                        )}
                        {snap.risk_stats.high === 0 && <span className="text-slate-600">0</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {snap.risk_stats.medium > 0 && (
                          <span className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-medium', RISK_BADGE.medium.cls)}>
                            {RISK_BADGE.medium.icon}{snap.risk_stats.medium}
                          </span>
                        )}
                        {snap.risk_stats.medium === 0 && <span className="text-slate-600">0</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {snap.risk_stats.low > 0 && (
                          <span className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-medium', RISK_BADGE.low.cls)}>
                            {RISK_BADGE.low.icon}{snap.risk_stats.low}
                          </span>
                        )}
                        {snap.risk_stats.low === 0 && <span className="text-slate-600">0</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs text-slate-300">{snap.events.length}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onPreview(snap)}
                            title="预览"
                            className={cn(
                              'flex items-center justify-center h-7 w-7 rounded-md',
                              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
                            )}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestore(snap.snapshot_id)}
                            title="恢复到主看板"
                            className={cn(
                              'flex items-center justify-center h-7 w-7 rounded-md',
                              'text-sky-400 hover:bg-sky-500/15 transition-colors'
                            )}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportOne(snap.snapshot_id)}
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
                            onClick={() => deleteSnapshot(snap.snapshot_id)}
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

          {canUndoSnapshotRestore() && (
            <div className="border-t border-sky-500/40 bg-sky-500/10 px-5 py-2.5 flex items-center justify-between flex-none">
              <span className="text-xs text-sky-300">可撤销上一次快照恢复操作</span>
              <button
                type="button"
                onClick={handleUndoRestore}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1',
                  'text-xs font-medium text-sky-300',
                  'hover:bg-sky-500/20 transition-colors'
                )}
              >
                <RotateCcw className="h-3 w-3" />
                撤销恢复
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-5 py-3 flex-none">
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
