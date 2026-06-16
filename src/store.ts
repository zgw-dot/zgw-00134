import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MenuItem,
  AllergyProfile,
  MealPickup,
  Complaint,
  AllergenAliasMap,
  RiskEvent,
  ImportBatch,
  FilterState,
  BoardStats,
  EventStatus,
  BatchUpdateResult,
  UndoSnapshot,
  ReviewSnapshot,
  SnapshotOpLog,
  SnapshotConflict,
  SnapshotImportResolution,
  SnapshotRestoreUndo,
  SealedEventConclusion,
  SealedConclusionOpLog,
  SealedConclusionConflict,
  SealedConclusionImportResolution,
  SealedConclusionRestoreUndo,
} from '@/types';
import { generateRiskEvents } from '@/utils/engine';
import { applyFilters } from '@/utils/filters';
import { contentHash, genId } from '@/utils/crypto';
import {
  validateMenuRows,
  validateComplaints,
  validateAllergyProfiles,
  validateMealPickups,
  type ValidResult,
} from '@/utils/validators';
import { validateAliasMap, type AliasMap } from '@/utils/alias';

interface BoardState {
  menus: MenuItem[];
  profiles: AllergyProfile[];
  pickups: MealPickup[];
  complaints: Complaint[];
  aliasMap: AllergenAliasMap;
  events: RiskEvent[];
  importBatches: ImportBatch[];
  filters: FilterState;
  selectedEventId: string | null;
  selectedEventIds: Set<string>;
  undoSnapshot: UndoSnapshot | null;
  snapshots: ReviewSnapshot[];
  snapshotOpLogs: SnapshotOpLog[];
  snapshotRestoreUndo: SnapshotRestoreUndo | null;
  sealedConclusions: SealedEventConclusion[];
  sealedConclusionOpLogs: SealedConclusionOpLog[];
  sealedConclusionRestoreUndo: SealedConclusionRestoreUndo | null;

  setAliasMap: (map: AllergenAliasMap) => { ok: boolean; errors: string[] };
  regenerateEvents: () => void;
  getStats: () => BoardStats;
  getVisibleEvents: () => RiskEvent[];
  getAvailableClasses: () => string[];

  setFilters: (f: Partial<FilterState>) => void;
  selectEvent: (id: string | null) => void;
  updateEventStatus: (eventId: string, status: EventStatus, note?: string) => void;

  toggleEventSelection: (eventId: string) => void;
  toggleSelectAllVisible: () => void;
  clearSelection: () => void;
  getSelectedEvents: () => RiskEvent[];
  getClosedInSelection: () => RiskEvent[];

  batchUpdateEvents: (
    eventIds: string[],
    status: EventStatus,
    note?: string,
    forceClosed?: boolean
  ) => BatchUpdateResult;
  canUndo: () => boolean;
  undoLastBatch: () => boolean;
  consumeUndoSnapshot: () => void;

  importData: (
    fileType: 'menu' | 'profile' | 'pickup' | 'complaint',
    fileName: string,
    rows: any[]
  ) => { ok: boolean; errors: string[]; imported: number };
  clearAllData: () => void;

  sealSnapshot: (name: string) => ReviewSnapshot;
  deleteSnapshot: (snapshotId: string) => void;
  checkSnapshotConflict: (incoming: ReviewSnapshot) => SnapshotConflict;
  importSnapshot: (incoming: ReviewSnapshot, resolution: SnapshotImportResolution) => { ok: boolean; reason?: string };
  restoreSnapshot: (snapshotId: string) => boolean;
  canUndoSnapshotRestore: () => boolean;
  undoSnapshotRestore: () => boolean;
  getSnapshotOpLogs: () => SnapshotOpLog[];
  exportSnapshotsJson: (snapshotIds?: string[]) => string;

  getSealedConclusions: () => SealedEventConclusion[];
  getSealedConclusionById: (conclusionId: string) => SealedEventConclusion | undefined;
  getSealedConclusionsBySnapshot: (snapshotId: string) => SealedEventConclusion[];
  getSealedConclusionsByEvent: (eventId: string) => SealedEventConclusion[];
  restoreSealedConclusion: (conclusionId: string) => boolean;
  canUndoSealedConclusionRestore: () => boolean;
  undoSealedConclusionRestore: () => boolean;
  checkSealedConclusionConflict: (incomingConclusions: SealedEventConclusion[]) => SealedConclusionConflict;
  importSealedConclusions: (
    incomingConclusions: SealedEventConclusion[],
    resolution: SealedConclusionImportResolution
  ) => { ok: boolean; imported: number; skipped: number; reason?: string };
  getSealedConclusionOpLogs: () => SealedConclusionOpLog[];
  exportSealedConclusionsJson: (conclusionIds?: string[]) => string;
  deleteSealedConclusion: (conclusionId: string) => void;
}

const defaultAliasMap: AllergenAliasMap = {
  花生: ['花生', '花生酱', '花生油', '花生米', '落花生'],
  小麦: ['小麦', '小麦粉', '面粉', '面筋', '麸质'],
  甲壳类: ['虾', '虾子', '龙虾', '螃蟹', '甲壳', '虾仁'],
  乳制品: ['牛奶', '奶粉', '奶酪', '芝士', '黄油', '乳清', '乳制品'],
  鸡蛋: ['鸡蛋', '蛋', '蛋清', '蛋黄', '鸡蛋液', '禽蛋'],
  大豆: ['大豆', '黄豆', '大豆油', '豆腐', '豆浆', '黄豆酱'],
};

const defaultFilters: FilterState = {
  classes: [],
  meal_types: [],
  risk_levels: [],
  statuses: [],
  search_text: '',
};

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      menus: [],
      profiles: [],
      pickups: [],
      complaints: [],
      aliasMap: defaultAliasMap,
      events: [],
      importBatches: [],
      filters: defaultFilters,
      selectedEventId: null,
      selectedEventIds: new Set(),
      undoSnapshot: null,
      snapshots: [],
      snapshotOpLogs: [],
      snapshotRestoreUndo: null,
      sealedConclusions: [],
      sealedConclusionOpLogs: [],
      sealedConclusionRestoreUndo: null,

      setAliasMap: (map: AllergenAliasMap) => {
        const errors = validateAliasMap(map as AliasMap);
        if (errors.length > 0) {
          return { ok: false, errors: errors.map(e => e.message) };
        }
        set({ aliasMap: map });
        get().regenerateEvents();
        return { ok: true, errors: [] };
      },

      regenerateEvents: () => {
        const state = get();
        const events = generateRiskEvents({
          menus: state.menus,
          profiles: state.profiles,
          pickups: state.pickups,
          complaints: state.complaints,
          aliasMap: state.aliasMap,
          existingEvents: state.events,
        });
        set({ events });
      },

      getStats: () => {
        const events = get().events;
        const stats: BoardStats = {
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
          if (e.status) stats[e.status]++;
          if (e.risk_level === 'high') stats.high_risk++;
          else if (e.risk_level === 'medium') stats.medium_risk++;
          else if (e.risk_level === 'low') stats.low_risk++;
        }
        return stats;
      },

      getVisibleEvents: () => {
        const { events, filters } = get();
        const filtered = applyFilters(events, filters);
        return filtered.filter(e => !(e as any).hidden);
      },

      getAvailableClasses: () => {
        const set = new Set<string>();
        for (const p of get().profiles) {
          if (p.class_name) set.add(p.class_name);
        }
        for (const e of get().events) {
          for (const c of e.class_names || []) {
            if (c) set.add(c);
          }
        }
        return Array.from(set).sort();
      },

      setFilters: (f: Partial<FilterState>) => {
        set(state => ({ filters: { ...state.filters, ...f } }));
      },

      selectEvent: (id: string | null) => {
        set({ selectedEventId: id });
      },

      updateEventStatus: (eventId: string, status: EventStatus, note?: string) => {
        set(state => {
          const events = state.events.map(e => {
            if (e.event_id !== eventId) return e;
            const log = {
              id: genId(),
              timestamp: new Date().toISOString(),
              from_status: e.status,
              to_status: status,
              note: note || '',
            };
            return {
              ...e,
              status,
              latest_note: note || e.latest_note,
              closed_at: status === 'closed' ? new Date().toISOString() : e.closed_at,
              review_logs: [...(e.review_logs || []), log],
              updated_at: new Date().toISOString(),
            };
          });
          return { events };
        });
      },

      toggleEventSelection: (eventId: string) => {
        set(state => {
          const newSet = new Set(state.selectedEventIds);
          if (newSet.has(eventId)) {
            newSet.delete(eventId);
          } else {
            newSet.add(eventId);
          }
          return { selectedEventIds: newSet };
        });
      },

      toggleSelectAllVisible: () => {
        set(state => {
          const visible = state.getVisibleEvents();
          const visibleIds = new Set(visible.map(e => e.event_id));
          const currentSelected = state.selectedEventIds;
          const allSelected = visible.length > 0 && visible.every(e => currentSelected.has(e.event_id));

          if (allSelected) {
            const newSet = new Set(currentSelected);
            for (const id of visibleIds) {
              newSet.delete(id);
            }
            return { selectedEventIds: newSet };
          } else {
            return { selectedEventIds: new Set([...currentSelected, ...visibleIds]) };
          }
        });
      },

      clearSelection: () => {
        set({ selectedEventIds: new Set() });
      },

      getSelectedEvents: () => {
        const state = get();
        return state.events.filter(e => state.selectedEventIds.has(e.event_id));
      },

      getClosedInSelection: () => {
        return get().getSelectedEvents().filter(e => e.status === 'closed');
      },

      batchUpdateEvents: (
        eventIds: string[],
        status: EventStatus,
        note?: string,
        forceClosed: boolean = false
      ): BatchUpdateResult => {
        const state = get();
        const result: BatchUpdateResult = {
          updated: [],
          skipped: [],
          conflicts: [],
        };

        const idSet = new Set(eventIds);
        const snapshotEvents: RiskEvent[] = [];

        const events = state.events.map(e => {
          if (!idSet.has(e.event_id)) return e;

          if (e.status === 'closed' && !forceClosed) {
            result.conflicts.push(e.event_id);
            result.skipped.push({
              eventId: e.event_id,
              reason: '事件已关闭，需确认后强制更新',
            });
            return e;
          }

          snapshotEvents.push({ ...e });

          const log = {
            id: genId(),
            timestamp: new Date().toISOString(),
            from_status: e.status,
            to_status: status,
            note: note || '',
          };

          result.updated.push(e.event_id);

          return {
            ...e,
            status,
            latest_note: note || e.latest_note,
            closed_at: status === 'closed' ? new Date().toISOString() : e.closed_at,
            review_logs: [...(e.review_logs || []), log],
            updated_at: new Date().toISOString(),
          };
        });

        if (snapshotEvents.length > 0) {
          const snapshot: UndoSnapshot = {
            batchId: genId(),
            timestamp: new Date().toISOString(),
            events: snapshotEvents,
            description: `批量更新 ${snapshotEvents.length} 条事件状态为 ${status}${note ? '，附加备注' : ''}`,
          };
          set({ events, undoSnapshot: snapshot, selectedEventIds: new Set() });
        } else {
          set({ events });
        }

        return result;
      },

      canUndo: () => {
        return get().undoSnapshot !== null;
      },

      undoLastBatch: (): boolean => {
        const state = get();
        const snapshot = state.undoSnapshot;
        if (!snapshot) return false;

        const snapshotMap = new Map(snapshot.events.map(e => [e.event_id, e]));

        const events = state.events.map(e => {
          const original = snapshotMap.get(e.event_id);
          if (!original) return e;

          const undoLog = {
            id: genId(),
            timestamp: new Date().toISOString(),
            from_status: e.status,
            to_status: original.status,
            note: `撤销批量操作: ${snapshot.description}`,
          };

          return {
            ...original,
            review_logs: [...e.review_logs, undoLog],
            updated_at: new Date().toISOString(),
          };
        });

        set({ events, undoSnapshot: null });
        return true;
      },

      consumeUndoSnapshot: () => {
        set({ undoSnapshot: null });
      },

      importData: (
        fileType: 'menu' | 'profile' | 'pickup' | 'complaint',
        fileName: string,
        rows: any[]
      ) => {
        const hash = contentHash(JSON.stringify(rows));
        const state = get();
        if (state.importBatches.some(b => b.content_hash === hash)) {
          return { ok: false, errors: ['该文件已导入过，请勿重复导入'], imported: 0 };
        }

        let valid: any[] = [];
        let errors: string[] = [];
        let result: ValidResult<any>;

        switch (fileType) {
          case 'menu':
            result = validateMenuRows(rows, fileName);
            valid = result.valid;
            errors = result.errors.map(e => e.message);
            break;
          case 'profile':
            result = validateAllergyProfiles(rows);
            valid = result.valid;
            errors = result.errors.map(e => e.message);
            break;
          case 'pickup':
            result = validateMealPickups(rows);
            valid = result.valid;
            errors = result.errors.map(e => e.message);
            break;
          case 'complaint':
            result = validateComplaints(rows);
            valid = result.valid;
            errors = result.errors.map(e => e.message);
            break;
        }

        if (valid.length === 0) {
          return { ok: false, errors, imported: 0 };
        }

        set(s => {
          const newState: Partial<BoardState> = {};
          if (fileType === 'menu') newState.menus = [...s.menus, ...valid];
          if (fileType === 'profile') newState.profiles = [...s.profiles, ...valid];
          if (fileType === 'pickup') newState.pickups = [...s.pickups, ...valid];
          if (fileType === 'complaint') newState.complaints = [...s.complaints, ...valid];
          newState.importBatches = [
            ...s.importBatches,
            {
              batch_id: genId(),
              file_type: fileType,
              file_name: fileName,
              content_hash: hash,
              record_count: valid.length,
              imported_at: new Date().toISOString(),
            },
          ];
          return newState;
        });

        get().regenerateEvents();
        return { ok: true, errors, imported: valid.length };
      },

      clearAllData: () => {
        set({
          menus: [],
          profiles: [],
          pickups: [],
          complaints: [],
          events: [],
          importBatches: [],
          selectedEventId: null,
          selectedEventIds: new Set(),
          undoSnapshot: null,
          snapshotRestoreUndo: null,
        });
      },

      sealSnapshot: (name: string): ReviewSnapshot => {
        const state = get();
        const visibleEvents = state.getVisibleEvents();
        const risk_stats = { high: 0, medium: 0, low: 0 };
        for (const e of visibleEvents) {
          if (e.risk_level === 'high') risk_stats.high++;
          else if (e.risk_level === 'medium') risk_stats.medium++;
          else if (e.risk_level === 'low') risk_stats.low++;
        }
        const snapshot: ReviewSnapshot = {
          snapshot_id: genId('snap'),
          name,
          created_at: new Date().toISOString(),
          filters: { ...state.filters },
          events: visibleEvents.map(e => ({ ...e })),
          risk_stats,
          import_batches: state.importBatches.map(b => ({ ...b })),
        };
        const opLog: SnapshotOpLog = {
          id: genId('op'),
          op: 'seal',
          snapshot_id: snapshot.snapshot_id,
          snapshot_name: snapshot.name,
          timestamp: new Date().toISOString(),
          detail: `封存快照「${name}」，含 ${visibleEvents.length} 条事件`,
        };

        const sealedAt = new Date().toISOString();
        const sealedConclusions: SealedEventConclusion[] = visibleEvents.map(e => {
          const evidenceTypes = new Set(e.evidence?.map(ev => ev.type) || []);
          return {
            conclusion_id: genId('conc'),
            event_id: e.event_id,
            snapshot_id: snapshot.snapshot_id,
            snapshot_name: snapshot.name,
            sealed_at: sealedAt,
            filters_at_seal: { ...state.filters },
            risk_level: e.risk_level,
            status: e.status,
            latest_note: e.latest_note || '',
            evidence_summary: {
              total_evidence: e.evidence?.length || 0,
              evidence_types: Array.from(evidenceTypes),
              student_count: e.student_ids?.length || 0,
              canonical_allergen: e.canonical_allergen,
              matched_aliases: [...e.matched_aliases],
            },
            event_snapshot: { ...e },
          };
        });

        const sealedOpLogs: SealedConclusionOpLog[] = sealedConclusions.map(c => ({
          id: genId('op-c'),
          op: 'seal',
          snapshot_id: snapshot.snapshot_id,
          snapshot_name: snapshot.name,
          conclusion_id: c.conclusion_id,
          event_id: c.event_id,
          timestamp: sealedAt,
          detail: `封存事件 ${c.event_id.slice(0, 12)} 结论副本，风险: ${c.risk_level}, 状态: ${c.status}`,
        }));

        set(s => ({
          snapshots: [...s.snapshots, snapshot],
          snapshotOpLogs: [...s.snapshotOpLogs, opLog],
          sealedConclusions: [...s.sealedConclusions, ...sealedConclusions],
          sealedConclusionOpLogs: [...s.sealedConclusionOpLogs, ...sealedOpLogs],
        }));
        return snapshot;
      },

      deleteSnapshot: (snapshotId: string) => {
        set(s => ({
          snapshots: s.snapshots.filter(snap => snap.snapshot_id !== snapshotId),
        }));
      },

      checkSnapshotConflict: (incoming: ReviewSnapshot): SnapshotConflict => {
        const state = get();
        const name_conflict = state.snapshots.some(s => s.name === incoming.name);
        const existingEventIds = new Set(state.snapshots.flatMap(s => s.events.map(e => e.event_id)));
        const event_id_conflicts = incoming.events
          .map(e => e.event_id)
          .filter(id => existingEventIds.has(id));
        return { name_conflict, event_id_conflicts };
      },

      importSnapshot: (incoming: ReviewSnapshot, resolution: SnapshotImportResolution): { ok: boolean; reason?: string } => {
        if (resolution === 'cancel') {
          return { ok: false, reason: '用户取消导入' };
        }
        const state = get();

        if (resolution === 'overwrite') {
          const overwritten = state.snapshots.find(s => s.name === incoming.name);
          const filtered = state.snapshots.filter(s => s.name !== incoming.name);
          const toAdd = { ...incoming };
          const opLog: SnapshotOpLog = {
            id: genId('op'),
            op: 'overwrite',
            snapshot_id: incoming.snapshot_id,
            snapshot_name: incoming.name,
            timestamp: new Date().toISOString(),
            detail: overwritten
              ? `覆盖快照「${incoming.name}」(原ID: ${overwritten.snapshot_id})`
              : `导入并覆盖快照「${incoming.name}」`,
          };
          set(s => ({
            snapshots: [...filtered, toAdd],
            snapshotOpLogs: [...s.snapshotOpLogs, opLog],
          }));
          return { ok: true };
        }

        if (resolution === 'copy') {
          const baseName = incoming.name;
          const existingNames = new Set(state.snapshots.map(s => s.name));
          let finalName = baseName;
          let suffix = 1;
          while (existingNames.has(finalName)) {
            finalName = `${baseName} (${suffix})`;
            suffix++;
          }
          const copy: ReviewSnapshot = {
            ...incoming,
            snapshot_id: genId('snap'),
            name: finalName,
          };
          const opLog: SnapshotOpLog = {
            id: genId('op'),
            op: 'import',
            snapshot_id: copy.snapshot_id,
            snapshot_name: copy.name,
            timestamp: new Date().toISOString(),
            detail: `另存快照副本「${finalName}」(原始名: ${baseName})`,
          };
          set(s => ({
            snapshots: [...s.snapshots, copy],
            snapshotOpLogs: [...s.snapshotOpLogs, opLog],
          }));
          return { ok: true };
        }

        return { ok: false, reason: '未知操作' };
      },

      restoreSnapshot: (snapshotId: string): boolean => {
        const state = get();
        const snapshot = state.snapshots.find(s => s.snapshot_id === snapshotId);
        if (!snapshot) return false;

        const restoreUndo: SnapshotRestoreUndo = {
          snapshot_id: snapshotId,
          events_before_restore: state.events.map(e => ({ ...e })),
          filters_before_restore: { ...state.filters },
          timestamp: new Date().toISOString(),
        };

        const opLog: SnapshotOpLog = {
          id: genId('op'),
          op: 'restore',
          snapshot_id: snapshotId,
          snapshot_name: snapshot.name,
          timestamp: new Date().toISOString(),
          detail: `恢复快照「${snapshot.name}」到主看板，${snapshot.events.length} 条事件`,
        };

        set({
          events: snapshot.events.map(e => ({ ...e })),
          filters: { ...snapshot.filters },
          snapshotRestoreUndo: restoreUndo,
          snapshotOpLogs: [...state.snapshotOpLogs, opLog],
        });
        return true;
      },

      canUndoSnapshotRestore: (): boolean => {
        return get().snapshotRestoreUndo !== null;
      },

      undoSnapshotRestore: (): boolean => {
        const state = get();
        const undo = state.snapshotRestoreUndo;
        if (!undo) return false;

        const opLog: SnapshotOpLog = {
          id: genId('op'),
          op: 'undo_restore',
          snapshot_id: undo.snapshot_id,
          snapshot_name: state.snapshots.find(s => s.snapshot_id === undo.snapshot_id)?.name || '',
          timestamp: new Date().toISOString(),
          detail: '撤销快照恢复，还原到恢复前状态',
        };

        set(s => ({
          events: undo.events_before_restore,
          filters: undo.filters_before_restore,
          snapshotRestoreUndo: null,
          snapshotOpLogs: [...s.snapshotOpLogs, opLog],
        }));
        return true;
      },

      getSnapshotOpLogs: (): SnapshotOpLog[] => {
        return [...get().snapshotOpLogs].reverse();
      },

      exportSnapshotsJson: (snapshotIds?: string[]): string => {
        const state = get();
        const toExport = snapshotIds
          ? state.snapshots.filter(s => snapshotIds.includes(s.snapshot_id))
          : state.snapshots;
        const exportData = {
          _type: 'review-snapshot-package',
          _version: 1,
          exported_at: new Date().toISOString(),
          snapshots: toExport,
          op_logs: state.snapshotOpLogs.filter(l =>
            toExport.some(s => s.snapshot_id === l.snapshot_id)
          ),
        };
        return JSON.stringify(exportData, null, 2);
      },

      getSealedConclusions: (): SealedEventConclusion[] => {
        return [...get().sealedConclusions];
      },

      getSealedConclusionById: (conclusionId: string): SealedEventConclusion | undefined => {
        return get().sealedConclusions.find(c => c.conclusion_id === conclusionId);
      },

      getSealedConclusionsBySnapshot: (snapshotId: string): SealedEventConclusion[] => {
        return get().sealedConclusions.filter(c => c.snapshot_id === snapshotId);
      },

      getSealedConclusionsByEvent: (eventId: string): SealedEventConclusion[] => {
        return get().sealedConclusions.filter(c => c.event_id === eventId);
      },

      restoreSealedConclusion: (conclusionId: string): boolean => {
        const state = get();
        const conclusion = state.sealedConclusions.find(c => c.conclusion_id === conclusionId);
        if (!conclusion) return false;

        const currentEvent = state.events.find(e => e.event_id === conclusion.event_id);
        if (!currentEvent) return false;

        const restoreUndo: SealedConclusionRestoreUndo = {
          conclusion_id: conclusionId,
          snapshot_id: conclusion.snapshot_id,
          event_id: conclusion.event_id,
          event_before_restore: { ...currentEvent },
          timestamp: new Date().toISOString(),
        };

        const opLog: SealedConclusionOpLog = {
          id: genId('op-c'),
          op: 'restore',
          snapshot_id: conclusion.snapshot_id,
          snapshot_name: conclusion.snapshot_name,
          conclusion_id: conclusionId,
          event_id: conclusion.event_id,
          timestamp: new Date().toISOString(),
          detail: `回放封存结论 ${conclusionId.slice(0, 12)} 到事件 ${conclusion.event_id.slice(0, 12)}`,
        };

        const events = state.events.map(e => {
          if (e.event_id !== conclusion.event_id) return e;
          return { ...conclusion.event_snapshot, updated_at: new Date().toISOString() };
        });

        set(s => ({
          events,
          sealedConclusionRestoreUndo: restoreUndo,
          sealedConclusionOpLogs: [...s.sealedConclusionOpLogs, opLog],
        }));
        return true;
      },

      canUndoSealedConclusionRestore: (): boolean => {
        return get().sealedConclusionRestoreUndo !== null;
      },

      undoSealedConclusionRestore: (): boolean => {
        const state = get();
        const undo = state.sealedConclusionRestoreUndo;
        if (!undo) return false;

        const opLog: SealedConclusionOpLog = {
          id: genId('op-c'),
          op: 'undo_restore',
          snapshot_id: undo.snapshot_id,
          snapshot_name: state.snapshots.find(s => s.snapshot_id === undo.snapshot_id)?.name || '',
          conclusion_id: undo.conclusion_id,
          event_id: undo.event_id,
          timestamp: new Date().toISOString(),
          detail: `撤销回放结论 ${undo.conclusion_id.slice(0, 12)}，还原事件 ${undo.event_id.slice(0, 12)}`,
        };

        const events = state.events.map(e => {
          if (e.event_id !== undo.event_id) return e;
          return { ...undo.event_before_restore, updated_at: new Date().toISOString() };
        });

        set(s => ({
          events,
          sealedConclusionRestoreUndo: null,
          sealedConclusionOpLogs: [...s.sealedConclusionOpLogs, opLog],
        }));
        return true;
      },

      checkSealedConclusionConflict: (incomingConclusions: SealedEventConclusion[]): SealedConclusionConflict => {
        const state = get();
        const existingSnapshotNames = new Set(state.snapshots.map(s => s.name));
        const existingEventIds = new Set(state.sealedConclusions.map(c => c.event_id));
        const existingConclusionIds = new Set(state.sealedConclusions.map(c => c.conclusion_id));

        const snapshot_name_conflict = incomingConclusions.some(c => existingSnapshotNames.has(c.snapshot_name));
        const event_id_conflicts = incomingConclusions
          .map(c => c.event_id)
          .filter(id => existingEventIds.has(id));
        const conclusion_id_conflicts = incomingConclusions
          .map(c => c.conclusion_id)
          .filter(id => existingConclusionIds.has(id));

        return { snapshot_name_conflict, event_id_conflicts, conclusion_id_conflicts };
      },

      importSealedConclusions: (
        incomingConclusions: SealedEventConclusion[],
        resolution: SealedConclusionImportResolution
      ): { ok: boolean; imported: number; skipped: number; reason?: string } => {
        if (resolution === 'cancel') {
          const cancelLogs: SealedConclusionOpLog[] = incomingConclusions.map(c => ({
            id: genId('op-c'),
            op: 'cancel_import',
            snapshot_id: c.snapshot_id,
            snapshot_name: c.snapshot_name,
            conclusion_id: c.conclusion_id,
            event_id: c.event_id,
            timestamp: new Date().toISOString(),
            detail: `用户取消导入结论 ${c.conclusion_id.slice(0, 12)}`,
          }));
          set(s => ({
            sealedConclusionOpLogs: [...s.sealedConclusionOpLogs, ...cancelLogs],
          }));
          return { ok: false, imported: 0, skipped: incomingConclusions.length, reason: '用户取消导入' };
        }

        const state = get();
        const existingConclusionIds = new Set(state.sealedConclusions.map(c => c.conclusion_id));
        const existingEventSnapshotMap = new Map(state.sealedConclusions.map(c => [`${c.snapshot_id}-${c.event_id}`, c]));

        let imported = 0;
        let skipped = 0;
        const toAdd: SealedEventConclusion[] = [];
        const opLogs: SealedConclusionOpLog[] = [];
        const now = new Date().toISOString();

        for (const incoming of incomingConclusions) {
          const key = `${incoming.snapshot_id}-${incoming.event_id}`;
          const existing = existingEventSnapshotMap.get(key);

          if (existing && resolution === 'skip') {
            skipped++;
            continue;
          }

          if (existing && resolution === 'overwrite') {
            toAdd.push({
              ...incoming,
              conclusion_id: existing.conclusion_id,
            });
            opLogs.push({
              id: genId('op-c'),
              op: 'overwrite',
              snapshot_id: incoming.snapshot_id,
              snapshot_name: incoming.snapshot_name,
              conclusion_id: existing.conclusion_id,
              event_id: incoming.event_id,
              timestamp: now,
              detail: `覆盖结论 ${existing.conclusion_id.slice(0, 12)} (事件 ${incoming.event_id.slice(0, 12)})`,
            });
            imported++;
          } else if (existing && resolution === 'copy') {
            const baseName = incoming.snapshot_name;
            const existingNames = new Set(state.snapshots.map(s => s.name));
            let finalName = baseName;
            let suffix = 1;
            while (existingNames.has(finalName)) {
              finalName = `${baseName} (${suffix})`;
              suffix++;
            }
            toAdd.push({
              ...incoming,
              conclusion_id: genId('conc'),
              snapshot_name: finalName,
            });
            opLogs.push({
              id: genId('op-c'),
              op: 'copy',
              snapshot_id: incoming.snapshot_id,
              snapshot_name: finalName,
              conclusion_id: toAdd[toAdd.length - 1].conclusion_id,
              event_id: incoming.event_id,
              timestamp: now,
              detail: `另存结论副本 ${finalName} (事件 ${incoming.event_id.slice(0, 12)})`,
            });
            imported++;
          } else {
            const newId = existingConclusionIds.has(incoming.conclusion_id)
              ? genId('conc')
              : incoming.conclusion_id;
            toAdd.push({
              ...incoming,
              conclusion_id: newId,
            });
            opLogs.push({
              id: genId('op-c'),
              op: 'import',
              snapshot_id: incoming.snapshot_id,
              snapshot_name: incoming.snapshot_name,
              conclusion_id: newId,
              event_id: incoming.event_id,
              timestamp: now,
              detail: `导入结论 ${newId.slice(0, 12)} (事件 ${incoming.event_id.slice(0, 12)})`,
            });
            imported++;
          }
        }

        if (toAdd.length > 0) {
          const existingIdsToRemove = new Set(
            toAdd.filter(c => existingConclusionIds.has(c.conclusion_id)).map(c => c.conclusion_id)
          );
          set(s => ({
            sealedConclusions: [
              ...s.sealedConclusions.filter(c => !existingIdsToRemove.has(c.conclusion_id)),
              ...toAdd,
            ],
            sealedConclusionOpLogs: [...s.sealedConclusionOpLogs, ...opLogs],
          }));
        }

        return { ok: true, imported, skipped };
      },

      getSealedConclusionOpLogs: (): SealedConclusionOpLog[] => {
        return [...get().sealedConclusionOpLogs].reverse();
      },

      exportSealedConclusionsJson: (conclusionIds?: string[]): string => {
        const state = get();
        const toExport = conclusionIds
          ? state.sealedConclusions.filter(c => conclusionIds.includes(c.conclusion_id))
          : state.sealedConclusions;

        const relatedSnapshotIds = new Set(toExport.map(c => c.snapshot_id));
        const relatedSnapshots = state.snapshots.filter(s => relatedSnapshotIds.has(s.snapshot_id));

        const exportData = {
          _type: 'sealed-conclusion-package',
          _version: 1,
          exported_at: new Date().toISOString(),
          conclusions: toExport,
          snapshots: relatedSnapshots,
          op_logs: state.sealedConclusionOpLogs.filter(l =>
            toExport.some(c => c.conclusion_id === l.conclusion_id)
          ),
        };
        return JSON.stringify(exportData, null, 2);
      },

      deleteSealedConclusion: (conclusionId: string) => {
        set(s => ({
          sealedConclusions: s.sealedConclusions.filter(c => c.conclusion_id !== conclusionId),
        }));
      },
    }),
    {
      name: 'allergy-board-store',
      partialize: (state) => ({
        menus: state.menus,
        profiles: state.profiles,
        pickups: state.pickups,
        complaints: state.complaints,
        aliasMap: state.aliasMap,
        events: state.events,
        importBatches: state.importBatches,
        filters: state.filters,
        selectedEventIds: Array.from(state.selectedEventIds),
        undoSnapshot: state.undoSnapshot,
        snapshots: state.snapshots,
        snapshotOpLogs: state.snapshotOpLogs,
        snapshotRestoreUndo: state.snapshotRestoreUndo,
        sealedConclusions: state.sealedConclusions,
        sealedConclusionOpLogs: state.sealedConclusionOpLogs,
        sealedConclusionRestoreUndo: state.sealedConclusionRestoreUndo,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (Array.isArray((state as any).selectedEventIds)) {
            (state as any).selectedEventIds = new Set((state as any).selectedEventIds);
          } else {
            (state as any).selectedEventIds = new Set();
          }
        }
      },
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).__boardStore = useBoardStore;
}
