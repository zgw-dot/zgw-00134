import { useState, useMemo } from 'react';
import { useBoardStore } from '@/store';
import { cn } from '@/lib/utils';
import StatsBar from '@/components/StatsBar';
import FilterPanel from '@/components/FilterPanel';
import EventList from '@/components/EventList';
import EventDetailDrawer from '@/components/EventDetailDrawer';
import ImportModal from '@/components/ImportModal';
import ExportPanel from '@/components/ExportPanel';
import AliasModal from '@/components/AliasModal';
import BatchActionPanel from '@/components/BatchActionPanel';
import SnapshotPanel from '@/components/SnapshotPanel';
import SnapshotPreviewDrawer from '@/components/SnapshotPreviewDrawer';
import SnapshotOpLogPanel from '@/components/SnapshotOpLogPanel';
import SnapshotConflictModal from '@/components/SnapshotConflictModal';
import { applyFilters } from '@/utils/filters';
import type { BoardStats, ReviewSnapshot, SnapshotConflict } from '@/types';
import {
  Upload,
  FileText,
  Settings2,
  Package,
} from 'lucide-react';

export default function Home() {
  const events = useBoardStore((s) => s.events);
  const profiles = useBoardStore((s) => s.profiles);
  const filters = useBoardStore((s) => s.filters);
  const setFilters = useBoardStore((s) => s.setFilters);
  const selectedEventId = useBoardStore((s) => s.selectedEventId);
  const selectEvent = useBoardStore((s) => s.selectEvent);
  const aliasMap = useBoardStore((s) => s.aliasMap);
  const setAliasMap = useBoardStore((s) => s.setAliasMap);

  const [importOpen, setImportOpen] = useState(false);
  const [aliasOpen, setAliasOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<ReviewSnapshot | null>(null);
  const [opLogOpen, setOpLogOpen] = useState(false);
  const [conflictSnapshot, setConflictSnapshot] = useState<ReviewSnapshot | null>(null);
  const [conflictInfo, setConflictInfo] = useState<SnapshotConflict | null>(null);

  const importSnapshot = useBoardStore((s) => s.importSnapshot);

  const stats = useMemo<BoardStats>(() => {
    const s: BoardStats = {
      total: events.length,
      pending: 0,
      confirmed: 0,
      false_alarm: 0,
      closed: 0,
      high_risk: 0,
      medium_risk: 0,
      low_risk: 0,
    };
    for (const e of events) {
      if (e.status === 'pending') s.pending++;
      else if (e.status === 'confirmed') s.confirmed++;
      else if (e.status === 'false_alarm') s.false_alarm++;
      else if (e.status === 'closed') s.closed++;
      if (e.risk_level === 'high') s.high_risk++;
      else if (e.risk_level === 'medium') s.medium_risk++;
      else if (e.risk_level === 'low') s.low_risk++;
    }
    return s;
  }, [events]);

  const availableClasses = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (p.class_name) set.add(p.class_name);
    }
    for (const e of events) {
      for (const c of e.class_names || []) {
        if (c) set.add(c);
      }
    }
    return Array.from(set).sort();
  }, [events, profiles]);

  const visibleEvents = useMemo(() => {
    const filtered = applyFilters(events, filters);
    return filtered.filter((e) => !(e as any).hidden);
  }, [events, filters]);

  const selectedEvent = events.find((e) => e.event_id === selectedEventId) || null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-500/15 text-teal-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">校餐过敏投诉复盘看板</h1>
              <p className="text-xs text-slate-500">Allergen Risk Review Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSnapshotOpen(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5',
                'text-sm font-medium text-slate-300 bg-slate-800/50',
                'hover:bg-slate-800 hover:text-slate-100 transition-colors'
              )}
            >
              <Package className="h-4 w-4" />
              快照包
            </button>
            <button
              type="button"
              onClick={() => setAliasOpen(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5',
                'text-sm font-medium text-slate-300 bg-slate-800/50',
                'hover:bg-slate-800 hover:text-slate-100 transition-colors'
              )}
            >
              <Settings2 className="h-4 w-4" />
              过敏原别名
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-1.5',
                'text-sm font-medium text-white',
                'hover:bg-teal-600 active:bg-teal-700 transition-colors'
              )}
            >
              <Upload className="h-4 w-4" />
              导入数据
            </button>
            <ExportPanel />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        <StatsBar stats={stats} />

        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          availableClasses={availableClasses}
        />

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            共 <span className="font-semibold text-slate-200">{visibleEvents.length}</span> 条事件
            {visibleEvents.length !== events.length && (
              <span className="text-slate-600 ml-1">
                (总 {events.length} 条，已筛选)
              </span>
            )}
          </div>
        </div>

        <EventList
          events={visibleEvents}
          selectedEventId={selectedEventId}
          onSelect={selectEvent}
        />
      </main>

      <BatchActionPanel />

      <EventDetailDrawer
        event={selectedEvent}
        onClose={() => selectEvent(null)}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <AliasModal
        open={aliasOpen}
        onClose={() => setAliasOpen(false)}
        initialMap={aliasMap}
        onSave={setAliasMap}
      />

      <SnapshotPanel
        open={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        onPreview={(snap) => { setSnapshotOpen(false); setPreviewSnapshot(snap); }}
        onConflict={(snap, conflict) => { setConflictSnapshot(snap); setConflictInfo(conflict); }}
        onShowLogs={() => { setSnapshotOpen(false); setOpLogOpen(true); }}
      />

      <SnapshotPreviewDrawer
        snapshot={previewSnapshot}
        onClose={() => setPreviewSnapshot(null)}
      />

      <SnapshotOpLogPanel
        open={opLogOpen}
        onClose={() => setOpLogOpen(false)}
      />

      {conflictSnapshot && conflictInfo && (
        <SnapshotConflictModal
          snapshot={conflictSnapshot}
          conflict={conflictInfo}
          onResolve={(resolution) => {
            if (conflictSnapshot) {
              importSnapshot(conflictSnapshot, resolution);
            }
            setConflictSnapshot(null);
            setConflictInfo(null);
          }}
        />
      )}
    </div>
  );
}
