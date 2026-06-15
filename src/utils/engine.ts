import type {
  MenuItem,
  AllergyProfile,
  MealPickup,
  Complaint,
  AllergenAliasMap,
  RiskEvent,
  RiskLevel,
  EvidenceLink,
  EventStatus,
  MealType,
} from '@/types';
import { contentHash, genId } from '@/utils/crypto';
import { timeWindow, addHours } from '@/utils/date';
import { resolveAllergenAlias, normalizeAliasName } from '@/utils/alias';

interface PendingHit {
  canonical_allergen: string;
  matched_aliases: string[];
  meal_type?: MealType;
  meal_date: string;
  event_time: string;
  student_id: string;
  student_name: string;
  class_name: string;
  severity: 'mild' | 'moderate' | 'severe';
  evidence: EvidenceLink[];
}

function dayBucketStart(timeISO: string): string {
  const date = new Date(timeISO);
  const hour = date.getHours();
  const bucketStart = Math.floor(hour / 2) * 2;
  const bucket = new Date(date);
  bucket.setHours(bucketStart, 0, 0, 0);
  return bucket.toISOString();
}

export function computeEventKey(
  canonical: string,
  meal_type: MealType | undefined,
  timeISO: string
): string {
  const bucket = dayBucketStart(timeISO);
  const mealPart = meal_type ?? 'any';
  return `${canonical}|${mealPart}|${bucket}`;
}

interface CalcRiskLevelParams {
  has_complaint: boolean;
  has_severe_profile: boolean;
  has_pickup: boolean;
}

export function calcRiskLevel(params: CalcRiskLevelParams): RiskLevel {
  const { has_complaint, has_severe_profile, has_pickup } = params;

  if (has_severe_profile && has_pickup && has_complaint) {
    return 'high';
  }
  if (
    (has_severe_profile && has_pickup) ||
    (has_pickup && has_complaint) ||
    has_complaint
  ) {
    return 'medium';
  }
  return 'low';
}

function deepClone<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(JSON.stringify(obj));
}

interface GenerateRiskEventsParams {
  menus: MenuItem[];
  profiles: AllergyProfile[];
  pickups: MealPickup[];
  complaints: Complaint[];
  aliasMap: AllergenAliasMap;
  existingEvents?: RiskEvent[];
  importedAt?: number;
}

export function generateRiskEvents(params: GenerateRiskEventsParams): RiskEvent[] {
  const {
    menus,
    profiles,
    pickups,
    complaints,
    aliasMap,
    existingEvents = [],
    importedAt = Date.now(),
  } = params;

  const importedAtISO = new Date(importedAt).toISOString();

  const profileMap = new Map<string, AllergyProfile>();
  for (const profile of profiles) {
    profileMap.set(profile.student_id, profile);
  }

  const menuMap = new Map<string, MenuItem>();
  for (const menu of menus) {
    const key = `${menu.meal_date}|${menu.dish_id}`;
    menuMap.set(key, menu);
  }

  const existingEventMap = new Map<string, RiskEvent>();
  for (const evt of existingEvents) {
    existingEventMap.set(evt.event_id, evt);
  }

  const pendingHits: PendingHit[] = [];

  for (const pickup of pickups) {
    const profile = profileMap.get(pickup.student_id);
    if (!profile) continue;

    const canonicalList = profile.allergens
      .map(a => resolveAllergenAlias(a, aliasMap).standardName)
      .filter((a): a is string => a !== null);

    if (canonicalList.length === 0) continue;

    const pickupEvidence: EvidenceLink = {
      type: 'pickup',
      source_id: pickup.pickup_id,
      source_data: deepClone(pickup),
      imported_at: importedAtISO,
    };

    for (const dish_id of pickup.dish_ids) {
      const menuKey = `${pickup.meal_date}|${dish_id}`;
      const menu = menuMap.get(menuKey);
      if (!menu) continue;

      const menuEvidence: EvidenceLink = {
        type: 'menu',
        source_id: `${menu.meal_date}|${menu.dish_id}`,
        source_data: deepClone(menu),
        imported_at: importedAtISO,
      };

      const profileEvidence: EvidenceLink = {
        type: 'profile',
        source_id: profile.student_id,
        source_data: deepClone(profile),
        imported_at: importedAtISO,
      };

      const allIngredients = [
        ...(menu.ingredients ?? []),
        ...(menu.allergens_tagged ?? []),
      ];

      const matchedCanonicals = new Map<string, Set<string>>();

      for (const ingredient of allIngredients) {
        const resolved = resolveAllergenAlias(ingredient, aliasMap);
        if (resolved.standardName && canonicalList.includes(resolved.standardName)) {
          const normalizedIngredient = normalizeAliasName(ingredient);
          if (!matchedCanonicals.has(resolved.standardName)) {
            matchedCanonicals.set(resolved.standardName, new Set());
          }
          const aliasSet = matchedCanonicals.get(resolved.standardName)!;
          aliasSet.add(normalizedIngredient);
          for (const alias of resolved.matchedAliases) {
            aliasSet.add(normalizeAliasName(alias));
          }
        }
      }

      for (const [canonical, aliasSet] of matchedCanonicals) {
        const hit: PendingHit = {
          canonical_allergen: canonical,
          matched_aliases: Array.from(aliasSet),
          meal_type: pickup.meal_type ?? menu.meal_type,
          meal_date: pickup.meal_date,
          event_time: pickup.pickup_time,
          student_id: pickup.student_id,
          student_name: profile.student_name,
          class_name: profile.class_name,
          severity: profile.severity,
          evidence: [profileEvidence, menuEvidence, pickupEvidence],
        };
        pendingHits.push(hit);
      }
    }
  }

  for (const complaint of complaints) {
    const profile = profileMap.get(complaint.student_id);
    if (!profile) continue;

    const canonicalList = profile.allergens
      .map(a => resolveAllergenAlias(a, aliasMap).standardName)
      .filter((a): a is string => a !== null);

    if (canonicalList.length === 0) continue;

    const complaintEvidence: EvidenceLink = {
      type: 'complaint',
      source_id: complaint.complaint_id,
      source_data: deepClone(complaint),
      imported_at: importedAtISO,
    };

    const profileEvidence: EvidenceLink = {
      type: 'profile',
      source_id: profile.student_id,
      source_data: deepClone(profile),
      imported_at: importedAtISO,
    };

    const suspectedIngredients = [
      ...(complaint.suspected_allergens ?? []),
      ...complaint.symptoms,
    ];

    const matchedCanonicals = new Map<string, Set<string>>();

    for (const ingredient of suspectedIngredients) {
      const resolved = resolveAllergenAlias(ingredient, aliasMap);
      if (resolved.standardName && canonicalList.includes(resolved.standardName)) {
        const normalizedIngredient = normalizeAliasName(ingredient);
        if (!matchedCanonicals.has(resolved.standardName)) {
          matchedCanonicals.set(resolved.standardName, new Set());
        }
        const aliasSet = matchedCanonicals.get(resolved.standardName)!;
        aliasSet.add(normalizedIngredient);
        for (const alias of resolved.matchedAliases) {
          aliasSet.add(normalizeAliasName(alias));
        }
      }
    }

    for (const [canonical, aliasSet] of matchedCanonicals) {
      const hit: PendingHit = {
        canonical_allergen: canonical,
        matched_aliases: Array.from(aliasSet),
        meal_type: complaint.meal_type,
        meal_date: complaint.meal_date,
        event_time: complaint.complaint_time,
        student_id: complaint.student_id,
        student_name: profile.student_name,
        class_name: profile.class_name,
        severity: profile.severity,
        evidence: [profileEvidence, complaintEvidence],
      };
      pendingHits.push(hit);
    }
  }

  interface AggregatedEvent {
    key: string;
    canonical_allergen: string;
    matched_aliases: Set<string>;
    meal_type?: MealType;
    time_window_start: string;
    time_window_end: string;
    student_ids: Set<string>;
    student_names: Set<string>;
    class_names: Set<string>;
    has_pickup: boolean;
    has_complaint: boolean;
    has_severe_profile: boolean;
    evidence: EvidenceLink[];
    earliest_time: string;
  }

  const aggregatedMap = new Map<string, AggregatedEvent>();

  for (const hit of pendingHits) {
    const key = computeEventKey(hit.canonical_allergen, hit.meal_type, hit.event_time);
    const tw = timeWindow(hit.event_time, 2);

    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        key,
        canonical_allergen: hit.canonical_allergen,
        matched_aliases: new Set(hit.matched_aliases),
        meal_type: hit.meal_type,
        time_window_start: tw.startISO,
        time_window_end: tw.endISO,
        student_ids: new Set(),
        student_names: new Set(),
        class_names: new Set(),
        has_pickup: false,
        has_complaint: false,
        has_severe_profile: false,
        evidence: [],
        earliest_time: hit.event_time,
      });
    }

    const agg = aggregatedMap.get(key)!;

    for (const alias of hit.matched_aliases) {
      agg.matched_aliases.add(alias);
    }

    agg.student_ids.add(hit.student_id);
    agg.student_names.add(hit.student_name);
    agg.class_names.add(hit.class_name);

    if (hit.severity === 'severe') {
      agg.has_severe_profile = true;
    }

    const hitTime = new Date(hit.event_time).getTime();
    const earliestTime = new Date(agg.earliest_time).getTime();
    if (hitTime < earliestTime) {
      agg.earliest_time = hit.event_time;
      const tw2 = timeWindow(hit.event_time, 2);
      agg.time_window_start = tw2.startISO;
      agg.time_window_end = tw2.endISO;
    }

    const existingSourceIds = new Set(
      agg.evidence.map(e => `${e.type}|${e.source_id}`)
    );

    for (const ev of hit.evidence) {
      const evKey = `${ev.type}|${ev.source_id}`;
      if (!existingSourceIds.has(evKey)) {
        agg.evidence.push(ev);
        existingSourceIds.add(evKey);
      }
      if (ev.type === 'pickup') agg.has_pickup = true;
      if (ev.type === 'complaint') agg.has_complaint = true;
    }
  }

  const result: RiskEvent[] = [];
  const nowISO = new Date(Date.now()).toISOString();

  for (const agg of aggregatedMap.values()) {
    const event_id = `evt_${contentHash(agg.key).slice(0, 12)}`;

    const risk_level = calcRiskLevel({
      has_complaint: agg.has_complaint,
      has_severe_profile: agg.has_severe_profile,
      has_pickup: agg.has_pickup,
    });

    const existing = existingEventMap.get(event_id);

    let status: EventStatus = 'pending';
    let review_logs = [] as any[];
    let latest_note: string | undefined;
    let closed_at: string | undefined;
    let created_at = nowISO;
    let updated_at = nowISO;

    if (existing) {
      status = existing.status;
      review_logs = existing.review_logs;
      latest_note = existing.latest_note;
      closed_at = existing.closed_at;
      created_at = existing.created_at;
      updated_at = nowISO;
    }

    const riskEvent: RiskEvent = {
      event_id,
      canonical_allergen: agg.canonical_allergen,
      matched_aliases: Array.from(agg.matched_aliases),
      meal_type: agg.meal_type,
      time_window_start: agg.time_window_start,
      time_window_end: agg.time_window_end,
      student_ids: Array.from(agg.student_ids),
      student_names: Array.from(agg.student_names),
      class_names: Array.from(agg.class_names),
      risk_level,
      status,
      evidence: agg.evidence,
      review_logs,
      latest_note,
      closed_at,
      created_at,
      updated_at,
    };

    result.push(riskEvent);
  }

  return result;
}
