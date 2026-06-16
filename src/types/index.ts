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

export interface SealedEventConclusion {
  conclusion_id: string;
  event_id: string;
  snapshot_id: string;
  snapshot_name: string;
  sealed_at: string;
  filters_at_seal: FilterState;
  risk_level: RiskLevel;
  status: EventStatus;
  latest_note: string;
  evidence_summary: {
    total_evidence: number;
    evidence_types: EvidenceLink['type'][];
    student_count: number;
    canonical_allergen: string;
    matched_aliases: string[];
  };
  event_snapshot: RiskEvent;
}

export interface SealedConclusionRestoreUndo {
  conclusion_id: string;
  snapshot_id: string;
  event_id: string;
  event_before_restore: RiskEvent;
  timestamp: string;
}

export type SealedConclusionOpType = 'seal' | 'import' | 'overwrite' | 'copy' | 'skip' | 'restore' | 'undo_restore' | 'cancel_import';

export interface SealedConclusionOpLog {
  id: string;
  op: SealedConclusionOpType;
  snapshot_id: string;
  snapshot_name: string;
  conclusion_id?: string;
  event_id?: string;
  timestamp: string;
  detail: string;
}

export interface SealedConclusionConflict {
  snapshot_name_conflict: boolean;
  event_id_conflicts: string[];
  conclusion_id_conflicts: string[];
}

export type SealedConclusionImportResolution = 'overwrite' | 'copy' | 'skip' | 'cancel';

export type ProvenanceGenerationMethod = 
  | 'seal'
  | 'import_copy'
  | 'import_overwrite'
  | 'import_skip'
  | 'branch'
  | 'overwrite'
  | 'copy'
  | 'restore'
  | 'undo_restore'
  | 'temp_restore'
  | 'temp_restore_discard';

export type ProvenanceEntityType = 'snapshot' | 'conclusion';

export interface ProvenanceConflictDecision {
  type: 'name' | 'event_id' | 'conclusion_id' | 'identity';
  existing_id: string;
  existing_name: string;
  resolution: 'keep_existing' | 'overwrite' | 'branch' | 'skip';
  resolved_at: string;
}

export interface ProvenanceRecord {
  provenance_id: string;
  entity_type: ProvenanceEntityType;
  entity_id: string;
  original_name: string;
  current_name: string;
  generation_method: ProvenanceGenerationMethod;
  event_count: number;
  import_batch_id?: string;
  import_batch_name?: string;
  conflict_decisions: ProvenanceConflictDecision[];
  last_playback_at?: string;
  parent_provenance_id?: string;
  root_provenance_id: string;
  created_at: string;
  updated_at: string;
  is_original: boolean;
  branch_depth: number;
  identity_signature: string;
}

export interface ProvenanceTimelineNode {
  provenance: ProvenanceRecord;
  children: ProvenanceTimelineNode[];
  operation_detail?: string;
  overwrote_provenance_id?: string;
}

export interface TemporaryRestoreSession {
  session_id: string;
  provenance_id: string;
  entity_type: ProvenanceEntityType;
  entity_id: string;
  events_before: RiskEvent[];
  filters_before: FilterState;
  restored_at: string;
  is_active: boolean;
}

export interface ProvenanceImportConflict {
  provenance_id_conflicts: string[];
  entity_id_conflicts: string[];
  name_conflicts: string[];
  identity_conflicts: {
    incoming_signature: string;
    existing_signature: string;
    existing_provenance_id: string;
  }[];
}

export type ProvenanceImportResolution = 
  | 'keep_existing'
  | 'branch'
  | 'overwrite_target'
  | 'cancel';

export interface ProvenanceExportPackage {
  _type: 'provenance-package';
  _version: 1;
  exported_at: string;
  provenance_records: ProvenanceRecord[];
  snapshots: ReviewSnapshot[];
  conclusions: SealedEventConclusion[];
  operation_logs: (SnapshotOpLog | SealedConclusionOpLog)[];
}

export interface ProvenanceSummary {
  provenance_id: string;
  entity_type: ProvenanceEntityType;
  original_name: string;
  current_name: string;
  generation_method: ProvenanceGenerationMethod;
  event_count: number;
  created_at: string;
  last_playback_at?: string;
  is_original: boolean;
  branch_depth: number;
  has_children: boolean;
  conflict_count: number;
}
