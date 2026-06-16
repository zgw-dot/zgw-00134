export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Severity = 'mild' | 'moderate' | 'severe';

export type EventStatus = 'pending' | 'confirmed' | 'false_alarm' | 'closed';

export type RiskLevel = 'high' | 'medium' | 'low';

export type FileType = 'menu' | 'profile' | 'pickup' | 'complaint';

export interface MenuItem {
  meal_date: string;
  dish_id: string;
  meal_type?: MealType;
  dish_name?: string;
  ingredients?: string[];
  allergens_tagged?: string[];
}

export interface AllergyProfile {
  student_id: string;
  student_name: string;
  class_name: string;
  allergens: string[];
  severity: Severity;
}

export interface MealPickup {
  pickup_id: string;
  student_id: string;
  meal_date: string;
  meal_type?: MealType;
  dish_ids: string[];
  pickup_time: string;
}

export interface Complaint {
  complaint_id: string;
  student_id: string;
  meal_date: string;
  meal_type?: MealType;
  complaint_time: string;
  symptoms: string[];
  description: string;
  suspected_allergens?: string[];
}

export type AllergenAliasMap = Record<string, string[]>;

export interface EvidenceLink {
  type: 'menu' | 'profile' | 'pickup' | 'complaint';
  source_id: string;
  source_data: any;
  imported_at: string;
}

export interface ReviewLog {
  id: string;
  timestamp: string;
  from_status: EventStatus;
  to_status: EventStatus;
  note: string;
}

export interface RiskEvent {
  event_id: string;
  canonical_allergen: string;
  matched_aliases: string[];
  meal_type?: MealType;
  time_window_start: string;
  time_window_end: string;
  student_ids: string[];
  student_names: string[];
  class_names: string[];
  risk_level: RiskLevel;
  status: EventStatus;
  evidence: EvidenceLink[];
  review_logs: ReviewLog[];
  latest_note?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  batch_id: string;
  file_type: FileType;
  file_name: string;
  content_hash: string;
  record_count: number;
  imported_at: string;
}

export interface ImportError {
  file_type: FileType;
  line_number?: number;
  message: string;
  raw_data?: any;
}

export interface FilterState {
  classes: string[];
  meal_types: MealType[];
  risk_levels: RiskLevel[];
  statuses: EventStatus[];
  search_text: string;
}

export interface BoardStats {
  total: number;
  pending: number;
  confirmed: number;
  false_alarm: number;
  closed: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
}

export interface BatchUpdateResult {
  updated: string[];
  skipped: { eventId: string; reason: string }[];
  conflicts: string[];
}

export interface UndoSnapshot {
  batchId: string;
  timestamp: string;
  events: RiskEvent[];
  description: string;
}

export interface ReviewSnapshot {
  snapshot_id: string;
  name: string;
  created_at: string;
  filters: FilterState;
  events: RiskEvent[];
  risk_stats: { high: number; medium: number; low: number };
  import_batches: ImportBatch[];
}

export type SnapshotOpType = 'seal' | 'import' | 'overwrite' | 'restore' | 'undo_restore';

export interface SnapshotOpLog {
  id: string;
  op: SnapshotOpType;
  snapshot_id: string;
  snapshot_name: string;
  timestamp: string;
  detail: string;
}

export interface SnapshotConflict {
  name_conflict: boolean;
  event_id_conflicts: string[];
}

export type SnapshotImportResolution = 'overwrite' | 'copy' | 'cancel';

export interface SnapshotRestoreUndo {
  snapshot_id: string;
  events_before_restore: RiskEvent[];
  filters_before_restore: FilterState;
  timestamp: string;
}
