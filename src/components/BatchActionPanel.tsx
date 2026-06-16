import { useState } from 'react';
import { useBoardStore } from '@/store';
import { cn } from '@/lib/utils';
import type { EventStatus, BatchUpdateResult } from '@/types';
import {
  CheckSquare,
  Square,
  X,
  Save,
  Undo2,
  AlertTriangle,
  ChevronDown,
  Check,
} from 'lucide-react';

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'pending', label: '待复核' },
  { value: 'confirmed', label: '已确认' },
  { value: 'false_alarm', label: '误报' },
  { value: 'closed', label: '已关闭' },
];

interface ConflictModalProps {
  closedCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConflictModal({ closedCount, onCancel, onConfirm }: ConflictModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-lg border border-amber-500/40 bg-slate-800 shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-700 bg-amber-500/10 px-5 py-4">
          <AlertTriangle className="h-5 w-5 flex-none text-amber-400" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-200">包含已关闭事件</h3>
            <p className="mt-1 text-xs text-amber-300/80">
              您选中的事件中有 <span className="font-semibold">{closedCount}</span> 条已处于「已关闭」状态。
              继续操作将强制修改这些事件的状态。
            </p>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-slate-400">
            已关闭事件通常表示处理完成。强制修改可能导致历史记录不一致。是否继续？
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                'rounded-md border border-slate-600 bg-slate-700 px-4 py-2',
                'text-sm font-medium text-slate-300',
                'hover:bg-slate-600 transition-colors'
              )}
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={cn(
                'rounded-md bg-amber-500 px-4 py-2',
                'text-sm font-medium text-white',
                'hover:bg-amber-600 active:bg-amber-700 transition-colors'
              )}
            >
              确认强制更新
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ResultToastProps {
  result: BatchUpdateResult;
  onClose: () => void;
  onUndo: () => void;
}

function ResultToast({ result, onClose, onUndo }: ResultToastProps) {
  const canUndo = result.updated.length > 0;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 shadow-xl">
        {result.updated.length > 0 && (
          <div className="flex items-center gap-1.5 text-teal-400">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">
              已更新 {result.updated.length} 条
            </span>
          </div>
        )}
        {result.skipped.length > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              跳过 {result.skipped.length} 条（已关闭）
            </span>
          </div>
        )}
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className={cn(
              'flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1',
              'text-xs font-medium text-slate-300',
              'hover:bg-slate-700 hover:text-slate-100 transition-colors'
            )}
          >
            <Undo2 className="h-3.5 w-3.5" />
            撤销
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function BatchActionPanel() {
  const selectedEventIds = useBoardStore((s) => s.selectedEventIds);
  const visibleEvents = useBoardStore((s) => s.getVisibleEvents());
  const toggleSelectAllVisible = useBoardStore((s) => s.toggleSelectAllVisible);
  const clearSelection = useBoardStore((s) => s.clearSelection);
  const getSelectedEvents = useBoardStore((s) => s.getSelectedEvents);
  const getClosedInSelection = useBoardStore((s) => s.getClosedInSelection);
  const batchUpdateEvents = useBoardStore((s) => s.batchUpdateEvents);
  const canUndo = useBoardStore((s) => s.undoSnapshot !== null);
  const undoLastBatch = useBoardStore((s) => s.undoLastBatch);
  const undoSnapshot = useBoardStore((s) => s.undoSnapshot);
  const consumeUndoSnapshot = useBoardStore((s) => s.consumeUndoSnapshot);

  const [newStatus, setNewStatus] = useState<EventStatus>('confirmed');
  const [note, setNote] = useState('');
  const [showConflict, setShowConflict] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    status: EventStatus;
    note: string;
  } | null>(null);
  const [showResult, setShowResult] = useState<BatchUpdateResult | null>(null);

  const selectedCount = selectedEventIds.size;
  const visibleCount = visibleEvents.length;
  const allSelected =
    visibleCount > 0 && visibleEvents.every((e) => selectedEventIds.has(e.event_id));

  const handleBatchSubmit = () => {
    const selected = getSelectedEvents();
    if (selected.length === 0) return;

    const closedEvents = getClosedInSelection();
    if (closedEvents.length > 0) {
      setPendingAction({ status: newStatus, note });
      setShowConflict(true);
      return;
    }

    executeBatchUpdate(newStatus, note, false);
  };

  const executeBatchUpdate = (
    status: EventStatus,
    noteText: string,
    forceClosed: boolean
  ) => {
    const ids = Array.from(selectedEventIds);
    const result = batchUpdateEvents(ids, status, noteText, forceClosed);
    setShowResult(result);
    setNote('');
    setShowConflict(false);
    setPendingAction(null);

    setTimeout(() => setShowResult(null), 5000);
  };

  const handleConflictConfirm = () => {
    if (pendingAction) {
      executeBatchUpdate(pendingAction.status, pendingAction.note, true);
    }
  };

  const handleConflictCancel = () => {
    setShowConflict(false);
    setPendingAction(null);
  };

  const handleUndo = () => {
    const success = undoLastBatch();
    if (success) {
      setShowResult(null);
    }
  };

  if (selectedCount === 0 && !canUndo) {
    return null;
  }

  return (
    <>
      <div className="sticky bottom-0 z-20 border-t border-slate-700 bg-slate-800/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className={cn(
                'flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-1.5',
                'text-xs font-medium',
                allSelected
                  ? 'bg-teal-500/15 text-teal-300 border-teal-500/40'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                'transition-colors'
              )}
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4 fill-teal-500/20" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {allSelected ? '取消全选' : '全选当前筛选'}
            </button>

            {selectedCount > 0 && (
              <>
                <span className="text-sm text-slate-400">
                  已选择 <span className="font-semibold text-teal-300">{selectedCount}</span> 条
                  {getClosedInSelection().length > 0 && (
                    <span className="ml-1 text-amber-400">
                      (含 {getClosedInSelection().length} 条已关闭)
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  清空选择
                </button>
              </>
            )}

            {canUndo && undoSnapshot && (
              <div className="flex items-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5">
                <span className="text-xs text-sky-300">
                  可撤销：{undoSnapshot.description}
                </span>
                <button
                  type="button"
                  onClick={handleUndo}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-0.5',
                    'text-xs font-medium text-sky-300',
                    'hover:bg-sky-500/20 transition-colors'
                  )}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  撤销
                </button>
                <button
                  type="button"
                  onClick={consumeUndoSnapshot}
                  className="text-sky-500/60 hover:text-sky-400 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-400">状态</label>
                <div className="relative">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as EventStatus)}
                    className={cn(
                      'appearance-none rounded-md border border-slate-600 bg-slate-700 pr-8 pl-3 py-1.5',
                      'text-sm text-slate-200',
                      'hover:border-slate-500 focus:border-teal-500 focus:outline-none transition-colors'
                    )}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-400">备注</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="统一备注（可选）"
                  className={cn(
                    'w-48 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5',
                    'text-sm text-slate-200 placeholder:text-slate-500',
                    'hover:border-slate-500 focus:border-teal-500 focus:outline-none transition-colors'
                  )}
                />
              </div>

              <button
                type="button"
                onClick={handleBatchSubmit}
                className={cn(
                  'flex items-center gap-1.5 rounded-md bg-teal-500 px-4 py-1.5',
                  'text-sm font-medium text-white',
                  'hover:bg-teal-600 active:bg-teal-700 transition-colors'
                )}
              >
                <Save className="h-4 w-4" />
                批量更新
              </button>
            </div>
          )}
        </div>
      </div>

      {showConflict && (
        <ConflictModal
          closedCount={getClosedInSelection().length}
          onCancel={handleConflictCancel}
          onConfirm={handleConflictConfirm}
        />
      )}

      {showResult && (
        <ResultToast
          result={showResult}
          onClose={() => setShowResult(null)}
          onUndo={handleUndo}
        />
      )}
    </>
  );
}
