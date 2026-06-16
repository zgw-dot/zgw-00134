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

  setAliasMap: (map: AllergenAliasMap) => { ok: boolean; errors: string[] };
  regenerateEvents: () => void;
  getStats: () => BoardStats;
  getVisibleEvents: () => RiskEvent[];
  getAvailableClasses: () => string[];

  setFilters: (f: Partial<FilterState>) => void;
  selectEvent: (id: string | null) => void;
  updateEventStatus: (eventId: string, status: EventStatus, note?: string) => void;

  importData: (
    fileType: 'menu' | 'profile' | 'pickup' | 'complaint',
    fileName: string,
    rows: any[]
  ) => { ok: boolean; errors: string[]; imported: number };
  clearAllData: () => void;
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
              closed_at: status === 'closed' ? new Date().toISOString() : undefined,
              review_logs: [...(e.review_logs || []), log],
              updated_at: new Date().toISOString(),
            };
          });
          return { events };
        });
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
        return { ok: true, errors: [], imported: valid.length };
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
        });
      },
    }),
    {
      name: 'allergy-board-store',
    }
  )
);
