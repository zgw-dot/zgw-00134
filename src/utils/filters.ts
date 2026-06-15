import {
  RiskEvent,
  FilterState,
  MealType,
  RiskLevel,
  EventStatus,
} from '@/types';

type EventWithHidden = RiskEvent & { hidden: boolean };

function hasIntersection(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b.map(s => s.toLowerCase()));
  return a.some(item => setB.has(item.toLowerCase()));
}

export function applyFilters(
  events: RiskEvent[],
  filters: FilterState
): RiskEvent[] {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.map(event => {
    const visible = isEventVisible(event, filters);
    return {
      ...event,
      hidden: !visible,
    };
  }) as EventWithHidden[] as RiskEvent[];
}

function isEventVisible(event: RiskEvent, filters: FilterState): boolean {
  if (filters.classes && filters.classes.length > 0) {
    if (!hasIntersection(event.class_names || [], filters.classes)) {
      return false;
    }
  }

  if (filters.meal_types && filters.meal_types.length > 0) {
    if (event.meal_type === undefined || event.meal_type === null) {
      return false;
    }
    if (!filters.meal_types.includes(event.meal_type as MealType)) {
      return false;
    }
  }

  if (filters.risk_levels && filters.risk_levels.length > 0) {
    if (!filters.risk_levels.includes(event.risk_level as RiskLevel)) {
      return false;
    }
  }

  if (filters.statuses && filters.statuses.length > 0) {
    if (!filters.statuses.includes(event.status as EventStatus)) {
      return false;
    }
  }

  if (filters.search_text && filters.search_text.trim() !== '') {
    const query = filters.search_text.trim().toLowerCase();
    const searchTargets: string[] = [];

    if (event.student_names && Array.isArray(event.student_names)) {
      searchTargets.push(event.student_names.join(' '));
    }

    if (event.canonical_allergen) {
      searchTargets.push(event.canonical_allergen);
    }

    if (event.matched_aliases && Array.isArray(event.matched_aliases)) {
      searchTargets.push(event.matched_aliases.join(' '));
    }

    if (event.latest_note) {
      searchTargets.push(event.latest_note);
    }

    if (event.class_names && Array.isArray(event.class_names)) {
      searchTargets.push(event.class_names.join(' '));
    }

    const matched = searchTargets.some(target =>
      target.toLowerCase().includes(query)
    );

    if (!matched) {
      return false;
    }
  }

  return true;
}
