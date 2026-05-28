/**
 * AP3X CONTROL OS — SAFETY GOVERNANCE + INTELLIGENCE TYPES
 *
 * NEW TABLES (additive only — no changes to existing schema):
 *   decision_trace_log      · safety_metrics_snapshot
 *   system_health_metrics   · audit_log_v2
 *   incident_replay_engine
 *
 * All tables are READ-ONLY from the Control OS UI.
 * Writes happen via service-role backend only.
 */

// ─────────────────────────────────────────────────────────────────
// Shared enums
// ─────────────────────────────────────────────────────────────────
export type GovernanceRole =
  | 'tenant_owner'
  | 'fleet_manager'
  | 'dispatcher'
  | 'driver'
  | 'safety_officer'
  | 'auditor';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AuditAction =
  | 'task_created'       | 'task_cancelled'    | 'task_assigned'
  | 'task_accepted'      | 'task_in_progress'  | 'task_completed'
  | 'driver_status_changed'                    | 'vehicle_status_changed'
  | 'assignment_created' | 'assignment_cancelled'
  | 'override_applied'   | 'escalation_triggered'
  | 'setting_changed'    | 'role_changed'
  | 'system_health_alert'| 'safety_threshold_breach'
  | string;

export type HealthComponent =
  | 'realtime_sync'
  | 'dispatch_pipeline'
  | 'event_ingestion'
  | 'location_feed'
  | 'assignment_engine'
  | 'api_gateway';

export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'down';

// ─────────────────────────────────────────────────────────────────
// decision_trace_log
// ─────────────────────────────────────────────────────────────────
export interface DecisionRuleStep {
  step:   number;
  rule:   string;
  result: 'pass' | 'fail' | 'skip';
  detail: string;
  weight: number;
}

export interface DecisionContextSnapshot {
  available_drivers?:      number;
  pending_tasks?:          number;
  fleet_utilisation_pct?:  number;
  time_to_assign_ms?:      number;
  [key: string]: unknown;
}

export interface DecisionTraceLog {
  id:                 string;
  task_id:            string;
  assignment_id:      string | null;
  driver_id:          string | null;
  vehicle_id:         string | null;
  decision_type:      'assignment' | 'rejection' | 'escalation' | 'override' | string;
  triggered_by:       'system_auto' | 'dispatcher_manual' | 'safety_officer' | 'ai_engine' | string;
  rule_chain:         DecisionRuleStep[];
  outcome:            'assigned' | 'rejected' | 'escalated' | 'overridden' | string;
  confidence_score:   number | null;
  override_reason:    string | null;
  context_snapshot:   DecisionContextSnapshot;
  created_at:         string;
}

// ─────────────────────────────────────────────────────────────────
// safety_metrics_snapshot
// ─────────────────────────────────────────────────────────────────
export type SnapshotPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface SafetyMetricsSnapshot {
  id:                    string;
  snapshot_period:       SnapshotPeriod;
  period_start:          string;
  period_end:            string;
  tenant_id:             string | null;

  // Task
  tasks_created:         number;
  tasks_completed:       number;
  tasks_cancelled:       number;
  task_completion_rate:  number | null;
  avg_task_duration_min: number | null;

  // Assignment
  assignments_total:      number;
  assignments_auto:       number;
  assignments_manual:     number;
  avg_assignment_time_ms: number | null;

  // Risk
  risk_level:             RiskLevel;
  incidents_total:        number;
  incidents_critical:     number;
  escalations_total:      number;
  overrides_total:        number;

  // Compliance
  compliance_rate:        number | null;
  sla_breach_count:       number;

  // Drivers
  drivers_active:         number;
  driver_utilisation_pct: number | null;
  avg_driver_response_ms: number | null;

  // Fleet
  fleet_uptime_pct:       number | null;
  vehicles_active:        number;
  vehicles_maintenance:   number;

  // System
  event_pipeline_lag_ms:  number | null;
  sync_failure_count:     number;

  breakdown:              Record<string, unknown>;
  computed_at:            string;
}

// ─────────────────────────────────────────────────────────────────
// system_health_metrics
// ─────────────────────────────────────────────────────────────────
export interface SystemHealthMetric {
  id:                 string;
  component:          HealthComponent;
  status:             HealthStatus;
  latency_p50_ms:     number | null;
  latency_p95_ms:     number | null;
  latency_p99_ms:     number | null;
  events_per_minute:  number | null;
  error_rate_pct:     number | null;
  failure_count:      number;
  success_count:      number;
  queue_depth:        number | null;
  queue_lag_ms:       number | null;
  detail:             string | null;
  metadata:           Record<string, unknown>;
  recorded_at:        string;
}

// ─────────────────────────────────────────────────────────────────
// audit_log_v2
// ─────────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  id:                     string;
  actor_id:               string | null;
  actor_email:            string | null;
  actor_role:             string | null;
  acting_as:              'self' | 'system' | 'impersonation' | string;
  action:                 AuditAction;
  entity_type:            string;
  entity_id:              string | null;
  entity_snapshot:        Record<string, unknown>;
  before_state:           Record<string, unknown>;
  after_state:            Record<string, unknown>;
  source_system:          string;
  ip_address:             string | null;
  user_agent:             string | null;
  request_id:             string | null;
  is_override:            boolean;
  override_justification: string | null;
  escalation_id:          string | null;
  risk_level:             RiskLevel;
  created_at:             string;
}

// ─────────────────────────────────────────────────────────────────
// incident_replay_engine
// ─────────────────────────────────────────────────────────────────
export interface ReplayTimelineFrame {
  seq:         number;
  timestamp:   string;
  event_type:  string;
  actor:       string;
  actor_role?: string;
  state:       Record<string, unknown>;
  delta_ms:    number;
  label:       string;
  source:      string;
}

export interface ReplayAnomaly {
  type:          string;
  delta_ms?:     number;
  threshold_ms?: number;
  severity:      'info' | 'warning' | 'critical';
  detail?:       string;
}

export interface IncidentReplay {
  id:               string;
  task_id:          string;
  assignment_id:    string | null;
  replay_label:     string;
  total_duration_ms: number | null;
  timeline:         ReplayTimelineFrame[];
  driver_decisions: ReplayTimelineFrame[];
  system_decisions: ReplayTimelineFrame[];
  anomalies:        ReplayAnomaly[];
  risk_level:       RiskLevel;
  has_anomalies:    boolean;
  is_incident:      boolean;
  constructed_at:   string;
  constructed_by:   string;
  version:          number;
  // Joined from view
  task_title?:    string;
  task_priority?: string;
  task_status?:   string;
}
