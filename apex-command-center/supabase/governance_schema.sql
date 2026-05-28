-- ═══════════════════════════════════════════════════════════════════════
-- AP3X CONTROL OS — SAFETY GOVERNANCE + INTELLIGENCE LAYER
-- governance_schema.sql
--
-- ADDITIVE ONLY — zero changes to existing tables.
-- Run this AFTER the main schema is already deployed.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ───────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE governance_role AS ENUM (
    'tenant_owner', 'fleet_manager', 'dispatcher',
    'driver', 'safety_officer', 'auditor'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'task_created', 'task_cancelled', 'task_assigned', 'task_accepted',
    'task_in_progress', 'task_completed',
    'driver_status_changed', 'vehicle_status_changed',
    'assignment_created', 'assignment_cancelled',
    'override_applied', 'escalation_triggered',
    'setting_changed', 'role_changed',
    'system_health_alert', 'safety_threshold_breach'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE health_component AS ENUM (
    'realtime_sync', 'dispatch_pipeline', 'event_ingestion',
    'location_feed', 'assignment_engine', 'api_gateway'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────────────────────────────────────────────────────
-- 1. decision_trace_log
--    Stores WHY any job was assigned — full rule-based reasoning chain.
--    Written by the dispatcher system, read by Control OS.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_trace_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source event
  task_id             UUID        NOT NULL REFERENCES tasks(id)            ON DELETE CASCADE,
  assignment_id       UUID        REFERENCES job_assignments(id)            ON DELETE SET NULL,
  driver_id           UUID        REFERENCES drivers(id)                   ON DELETE SET NULL,
  vehicle_id          UUID        REFERENCES vehicles(id)                  ON DELETE SET NULL,

  -- Decision metadata
  decision_type       TEXT        NOT NULL,   -- 'assignment' | 'rejection' | 'escalation' | 'override'
  triggered_by        TEXT        NOT NULL,   -- 'system_auto' | 'dispatcher_manual' | 'safety_officer' | 'ai_engine'

  -- Reasoning chain (ordered list of rules evaluated)
  rule_chain          JSONB       NOT NULL DEFAULT '[]',
  /*
    rule_chain shape:
    [
      {
        "step": 1,
        "rule": "driver_availability_check",
        "result": "pass",
        "detail": "Driver status = available",
        "weight": 1.0
      },
      {
        "step": 2,
        "rule": "proximity_score",
        "result": "pass",
        "detail": "Driver 2.3km from task location — best candidate",
        "weight": 0.92
      }
    ]
  */

  -- Final outcome
  outcome             TEXT        NOT NULL,   -- 'assigned' | 'rejected' | 'escalated' | 'overridden'
  confidence_score    NUMERIC(5,4),           -- 0.0000–1.0000
  override_reason     TEXT,                   -- populated if outcome = 'overridden'

  -- Context snapshot at time of decision
  context_snapshot    JSONB       DEFAULT '{}',
  /*
    {
      "available_drivers": 4,
      "pending_tasks": 12,
      "fleet_utilisation_pct": 78.5,
      "time_to_assign_ms": 243
    }
  */

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dtl_task_id    ON decision_trace_log (task_id);
CREATE INDEX IF NOT EXISTS idx_dtl_driver_id  ON decision_trace_log (driver_id);
CREATE INDEX IF NOT EXISTS idx_dtl_created_at ON decision_trace_log (created_at DESC);

COMMENT ON TABLE decision_trace_log IS
  'Full rule-based reasoning chain for every dispatch decision. Read-only from Control OS.';

-- ───────────────────────────────────────────────────────────────────────
-- 2. safety_metrics_snapshot
--    Computed system-wide safety scores — written by a scheduled job
--    or triggered by threshold breaches.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_metrics_snapshot (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  snapshot_period         TEXT        NOT NULL,  -- 'hourly' | 'daily' | 'weekly' | 'monthly'
  period_start            TIMESTAMPTZ NOT NULL,
  period_end              TIMESTAMPTZ NOT NULL,
  tenant_id               UUID,                  -- NULL = system-wide

  -- Task performance
  tasks_created           INT         NOT NULL DEFAULT 0,
  tasks_completed         INT         NOT NULL DEFAULT 0,
  tasks_cancelled         INT         NOT NULL DEFAULT 0,
  task_completion_rate    NUMERIC(5,4),           -- 0.0–1.0
  avg_task_duration_min   NUMERIC(8,2),

  -- Assignment performance
  assignments_total       INT         NOT NULL DEFAULT 0,
  assignments_auto        INT         NOT NULL DEFAULT 0,
  assignments_manual      INT         NOT NULL DEFAULT 0,
  avg_assignment_time_ms  NUMERIC(10,2),          -- time from task created → assigned

  -- Risk metrics
  risk_level              risk_level  NOT NULL DEFAULT 'low',
  incidents_total         INT         NOT NULL DEFAULT 0,
  incidents_critical      INT         NOT NULL DEFAULT 0,
  escalations_total       INT         NOT NULL DEFAULT 0,
  overrides_total         INT         NOT NULL DEFAULT 0,

  -- Compliance
  compliance_rate         NUMERIC(5,4),           -- 0.0–1.0
  sla_breach_count        INT         NOT NULL DEFAULT 0,

  -- Driver performance
  drivers_active          INT         NOT NULL DEFAULT 0,
  driver_utilisation_pct  NUMERIC(5,2),
  avg_driver_response_ms  NUMERIC(10,2),

  -- Fleet health
  fleet_uptime_pct        NUMERIC(5,2),
  vehicles_active         INT         NOT NULL DEFAULT 0,
  vehicles_maintenance    INT         NOT NULL DEFAULT 0,

  -- System health
  event_pipeline_lag_ms   NUMERIC(10,2),
  sync_failure_count      INT         NOT NULL DEFAULT 0,

  -- Raw breakdown blob for charts
  breakdown               JSONB       DEFAULT '{}',

  computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_period_start ON safety_metrics_snapshot (period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sms_tenant_id    ON safety_metrics_snapshot (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_period       ON safety_metrics_snapshot (snapshot_period);

COMMENT ON TABLE safety_metrics_snapshot IS
  'Periodic computed safety and performance snapshots. Control OS reads these for analytics.';

-- ───────────────────────────────────────────────────────────────────────
-- 3. system_health_metrics
--    Sub-second operational health of each system component.
--    Written by monitoring agents, read by Control OS health panel.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  component           health_component NOT NULL,
  status              TEXT            NOT NULL,  -- 'healthy' | 'degraded' | 'critical' | 'down'

  -- Latency
  latency_p50_ms      NUMERIC(10,2),
  latency_p95_ms      NUMERIC(10,2),
  latency_p99_ms      NUMERIC(10,2),

  -- Throughput + errors
  events_per_minute   NUMERIC(10,2),
  error_rate_pct      NUMERIC(5,4),   -- 0.0–100.0
  failure_count       INT             NOT NULL DEFAULT 0,
  success_count       INT             NOT NULL DEFAULT 0,

  -- Queue depth (if applicable)
  queue_depth         INT,
  queue_lag_ms        NUMERIC(10,2),

  -- Extra detail for diagnosis
  detail              TEXT,
  metadata            JSONB           DEFAULT '{}',

  recorded_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shm_component    ON system_health_metrics (component, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_shm_recorded_at  ON system_health_metrics (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_shm_status       ON system_health_metrics (status);

COMMENT ON TABLE system_health_metrics IS
  'Real-time operational health per system component. 1-minute rolling window typical.';

-- ───────────────────────────────────────────────────────────────────────
-- 4. audit_log_v2
--    Immutable, full-fidelity audit trail. APPEND-ONLY (no updates/deletes via RLS).
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log_v2 (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  actor_id            UUID            REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email         TEXT,
  actor_role          TEXT,           -- governance_role at time of action
  acting_as           TEXT,           -- 'self' | 'system' | 'impersonation'

  -- What
  action              audit_action    NOT NULL,
  entity_type         TEXT            NOT NULL,  -- 'task' | 'driver' | 'assignment' | 'vehicle' | 'setting'
  entity_id           UUID,
  entity_snapshot     JSONB           DEFAULT '{}',   -- full record state at time of action

  -- Change diff
  before_state        JSONB           DEFAULT '{}',
  after_state         JSONB           DEFAULT '{}',

  -- Context
  source_system       TEXT            NOT NULL DEFAULT 'control_os',
  ip_address          INET,
  user_agent          TEXT,
  request_id          UUID,

  -- Override / escalation tracking
  is_override         BOOLEAN         NOT NULL DEFAULT FALSE,
  override_justification TEXT,
  escalation_id       UUID,

  -- Risk classification
  risk_level          risk_level      NOT NULL DEFAULT 'low',

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Immutable via RLS — no UPDATE or DELETE allowed on this table
CREATE INDEX IF NOT EXISTS idx_alv2_actor_id    ON audit_log_v2 (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alv2_entity      ON audit_log_v2 (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alv2_action      ON audit_log_v2 (action);
CREATE INDEX IF NOT EXISTS idx_alv2_created_at  ON audit_log_v2 (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alv2_override    ON audit_log_v2 (is_override) WHERE is_override = TRUE;
CREATE INDEX IF NOT EXISTS idx_alv2_risk        ON audit_log_v2 (risk_level) WHERE risk_level IN ('high', 'critical');

COMMENT ON TABLE audit_log_v2 IS
  'Immutable, append-only audit trail. Every consequential system action logged here.';

-- ───────────────────────────────────────────────────────────────────────
-- 5. incident_replay_engine
--    Full lifecycle reconstruction of any task/incident.
--    Control OS reads this to replay stop-by-stop execution timelines.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incident_replay_engine (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference entity
  task_id             UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assignment_id       UUID        REFERENCES job_assignments(id) ON DELETE SET NULL,

  -- Snapshot metadata
  replay_label        TEXT        NOT NULL,  -- human-readable: 'Task #1234 Full Lifecycle'
  total_duration_ms   BIGINT,               -- wall-clock from task_created to final state

  -- Ordered timeline events
  timeline            JSONB       NOT NULL DEFAULT '[]',
  /*
    timeline shape — each element is a "frame":
    [
      {
        "seq":        1,
        "timestamp":  "2026-05-28T14:00:00.000Z",
        "event_type": "task_created",
        "actor":      "system",
        "actor_role": "dispatcher",
        "state":      { "status": "pending", "priority": "high" },
        "delta_ms":   0,
        "label":      "Task created by dispatcher",
        "source":     "tasks"
      },
      {
        "seq":        2,
        "timestamp":  "2026-05-28T14:00:12.400Z",
        "event_type": "assignment_created",
        "actor":      "dispatcher_engine",
        "state":      { "driver_id": "...", "vehicle_id": "..." },
        "delta_ms":   12400,
        "label":      "Driver assigned — 12.4s after creation",
        "source":     "job_assignments"
      }
    ]
  */

  -- Parallel views
  driver_decisions    JSONB       DEFAULT '[]',  -- driver-side events (accepted, location pings)
  system_decisions    JSONB       DEFAULT '[]',  -- system-side events (rule evaluations, AI calls)

  -- Anomaly flags found during replay construction
  anomalies           JSONB       DEFAULT '[]',
  /*
    [
      {
        "type": "long_accept_delay",
        "delta_ms": 87000,
        "threshold_ms": 30000,
        "severity": "warning"
      }
    ]
  */

  -- Classification
  risk_level          risk_level  NOT NULL DEFAULT 'low',
  has_anomalies       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_incident         BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Replay construction metadata
  constructed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  constructed_by      TEXT        NOT NULL DEFAULT 'system',  -- 'system' | profile.id
  version             INT         NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ire_task_id       ON incident_replay_engine (task_id);
CREATE INDEX IF NOT EXISTS idx_ire_is_incident   ON incident_replay_engine (is_incident) WHERE is_incident = TRUE;
CREATE INDEX IF NOT EXISTS idx_ire_has_anomalies ON incident_replay_engine (has_anomalies) WHERE has_anomalies = TRUE;
CREATE INDEX IF NOT EXISTS idx_ire_constructed   ON incident_replay_engine (constructed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ire_risk_level    ON incident_replay_engine (risk_level);

COMMENT ON TABLE incident_replay_engine IS
  'Full lifecycle reconstruction of tasks. Used by Control OS for incident replay and investigation.';

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — GOVERNANCE TABLES
-- ═══════════════════════════════════════════════════════════════════════

-- Enable RLS on all new tables
ALTER TABLE decision_trace_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_metrics_snapshot  ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_v2             ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_replay_engine   ENABLE ROW LEVEL SECURITY;

-- ── Helper: check if current user has a governance role ──────────────
CREATE OR REPLACE FUNCTION is_governance_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = ANY(allowed_roles)
  );
$$;

-- ── decision_trace_log ───────────────────────────────────────────────
-- READ: admin, safety_officer, auditor, fleet_manager
-- WRITE: system only (service role)
CREATE POLICY dtl_read ON decision_trace_log FOR SELECT
  USING (is_governance_role(ARRAY['admin','safety_officer','auditor','fleet_manager']));

CREATE POLICY dtl_insert ON decision_trace_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ── safety_metrics_snapshot ──────────────────────────────────────────
-- READ: admin, safety_officer, auditor, fleet_manager, tenant_owner
-- WRITE: system only
CREATE POLICY sms_read ON safety_metrics_snapshot FOR SELECT
  USING (is_governance_role(ARRAY['admin','safety_officer','auditor','fleet_manager','tenant_owner']));

CREATE POLICY sms_insert ON safety_metrics_snapshot FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ── system_health_metrics ────────────────────────────────────────────
-- READ: admin, safety_officer, auditor
-- WRITE: system only
CREATE POLICY shm_read ON system_health_metrics FOR SELECT
  USING (is_governance_role(ARRAY['admin','safety_officer','auditor']));

CREATE POLICY shm_insert ON system_health_metrics FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ── audit_log_v2 — IMMUTABLE ─────────────────────────────────────────
-- READ: admin, auditor, safety_officer
-- INSERT: admin, safety_officer, system
-- NO UPDATE OR DELETE — ever
CREATE POLICY alv2_read ON audit_log_v2 FOR SELECT
  USING (is_governance_role(ARRAY['admin','auditor','safety_officer']));

CREATE POLICY alv2_insert ON audit_log_v2 FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR is_governance_role(ARRAY['admin','safety_officer'])
  );

-- Explicitly block UPDATE and DELETE
CREATE POLICY alv2_no_update ON audit_log_v2 FOR UPDATE USING (FALSE);
CREATE POLICY alv2_no_delete ON audit_log_v2 FOR DELETE USING (FALSE);

-- ── incident_replay_engine ───────────────────────────────────────────
-- READ: admin, safety_officer, auditor, fleet_manager
-- WRITE: admin, safety_officer, system
CREATE POLICY ire_read ON incident_replay_engine FOR SELECT
  USING (is_governance_role(ARRAY['admin','safety_officer','auditor','fleet_manager']));

CREATE POLICY ire_write ON incident_replay_engine FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR is_governance_role(ARRAY['admin','safety_officer'])
  );

-- ═══════════════════════════════════════════════════════════════════════
-- USEFUL VIEWS (read-only conveniences for Control OS)
-- ═══════════════════════════════════════════════════════════════════════

-- Latest health status per component
CREATE OR REPLACE VIEW v_latest_health AS
  SELECT DISTINCT ON (component)
    id, component, status,
    latency_p50_ms, latency_p95_ms, error_rate_pct,
    events_per_minute, failure_count, queue_depth,
    detail, recorded_at
  FROM system_health_metrics
  ORDER BY component, recorded_at DESC;

-- Recent high-risk audit entries
CREATE OR REPLACE VIEW v_high_risk_audit AS
  SELECT
    a.*,
    p.full_name AS actor_name,
    p.email     AS actor_email_resolved
  FROM audit_log_v2 a
  LEFT JOIN profiles p ON p.id = a.actor_id
  WHERE a.risk_level IN ('high','critical')
  ORDER BY a.created_at DESC
  LIMIT 500;

-- Latest daily safety snapshot per tenant
CREATE OR REPLACE VIEW v_latest_daily_safety AS
  SELECT DISTINCT ON (tenant_id)
    *
  FROM safety_metrics_snapshot
  WHERE snapshot_period = 'daily'
  ORDER BY tenant_id, period_start DESC;

-- Incidents requiring attention
CREATE OR REPLACE VIEW v_active_incidents AS
  SELECT
    r.*,
    t.title      AS task_title,
    t.priority   AS task_priority,
    t.status     AS task_status
  FROM incident_replay_engine r
  JOIN tasks t ON t.id = r.task_id
  WHERE r.is_incident = TRUE
  ORDER BY r.constructed_at DESC;
