/**
 * APEX COMMAND CENTER OS
 * lib/export-engine.ts
 *
 * Generates PDF, DOCX, and CSV reports from local data.
 * All export jobs are tracked in IndexedDB.
 */

import { v4 as uuid } from 'uuid';
import Storage from '@/storage/storage';
import type { ExportFormat, ExportType, Tenant, FleetEntity, AIMetric, APIUsageLog } from '@/types';

// ============================================================
// EXPORT JOB MANAGEMENT
// ============================================================

async function createJob(format: ExportFormat, type: ExportType, params: Record<string, unknown>) {
  const job = {
    id: `export_${uuid()}`,
    format,
    type,
    status: 'processing' as const,
    createdAt: Date.now(),
    params,
  };
  await Storage.Exports.save(job);
  return job;
}

async function completeJob(jobId: string, fileUrl?: string, fileSize?: number) {
  const job = await Storage.Exports.get(jobId);
  if (!job) return;
  await Storage.Exports.save({
    ...job,
    status: 'complete',
    completedAt: Date.now(),
    fileUrl,
    fileSize,
  });
}

async function failJob(jobId: string, error: string) {
  const job = await Storage.Exports.get(jobId);
  if (!job) return;
  await Storage.Exports.save({ ...job, status: 'failed', error, completedAt: Date.now() });
}

// ============================================================
// CSV EXPORT
// ============================================================

function objectsToCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    ),
  ];
  return lines.join('\n');
}

function downloadString(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// PDF REPORT (jsPDF)
// ============================================================

async function generatePDFReport(
  title: string,
  sections: Array<{ heading: string; rows?: string[][]; headers?: string[]; text?: string }>
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(5, 8, 16);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(14, 165, 233);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('APEX COMMAND CENTER OS', pageWidth / 2, 18, { align: 'center' });
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(10);
  doc.text(title, pageWidth / 2, 28, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toISOString()}`, pageWidth / 2, 36, { align: 'center' });

  let y = 50;

  for (const section of sections) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setTextColor(14, 165, 233);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(section.heading, 14, y);
    y += 6;

    if (section.text) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(section.text, pageWidth - 28);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 8;
    }

    if (section.headers && section.rows) {
      autoTable(doc, {
        startY: y,
        head: [section.headers],
        body: section.rows,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [240, 248, 255] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${pageCount} — Apex Command Center OS — CONFIDENTIAL`, pageWidth / 2, 290, {
      align: 'center',
    });
  }

  return doc.output('blob');
}

// ============================================================
// EXPORT FUNCTIONS — BY TYPE
// ============================================================

export async function exportExecutiveReport(tenantId?: string): Promise<string> {
  const jobId = (await createJob('pdf', 'executive', { tenantId })).id;

  try {
    const tenants = await Storage.Tenants.getAll();
    const fleets = await Storage.Fleets.getAll();
    const aiMetrics = await Storage.AIMetrics.getByTimeRange(Date.now() - 7 * 86400000, Date.now());
    const apiLogs = await Storage.APIUsage.getByTimeRange(Date.now() - 7 * 86400000, Date.now());

    const totalApiCost = apiLogs.reduce((a, l) => a + l.cost, 0);
    const totalAiCost = aiMetrics.reduce((a, m) => a + m.cost, 0);
    const localAI = aiMetrics.filter((m) => m.inferenceSource === 'local').length;

    const sections = [
      {
        heading: 'Executive Summary',
        text: `This report covers the Apex Command Center OS federation performance for the past 7 days. Total tenants: ${tenants.length}. Total fleets: ${fleets.length}. API costs: $${totalApiCost.toFixed(2)}. AI costs: $${totalAiCost.toFixed(2)}. Local AI inference: ${localAI}/${aiMetrics.length} inferences.`,
      },
      {
        heading: 'Tenant Overview',
        headers: ['Name', 'Region', 'Status', 'Plan', 'Vehicles', 'Drivers'],
        rows: tenants.map((t) => [t.name, t.region, t.status, t.plan, String(t.vehicleCount), String(t.driverCount)]),
      },
      {
        heading: 'Fleet Summary',
        headers: ['Fleet', 'Region', 'Status', 'Vehicles', 'Uptime %', 'Version'],
        rows: fleets.map((f) => [f.name, f.region, f.status, String(f.vehicleCount), `${f.uptimePercent}%`, f.version]),
      },
      {
        heading: 'AI Performance (7 Days)',
        headers: ['Provider', 'Source', 'Tokens', 'Latency (ms)', 'Cost ($)', 'Cache Hit'],
        rows: aiMetrics.slice(0, 50).map((m) => [m.provider, m.inferenceSource, String(m.tokensUsed), String(m.latencyMs), m.cost.toFixed(4), m.cacheHit ? 'Yes' : 'No']),
      },
    ];

    const blob = await generatePDFReport('Executive Federation Report', sections);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex-executive-report-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    await completeJob(jobId);
    return jobId;
  } catch (err) {
    await failJob(jobId, String(err));
    throw err;
  }
}

export async function exportCSV(type: ExportType, tenantId?: string): Promise<string> {
  const jobId = (await createJob('csv', type, { tenantId })).id;

  try {
    let rows: Record<string, unknown>[] = [];
    let filename = `apex-${type}-${Date.now()}.csv`;

    if (type === 'api_usage') {
      const logs = tenantId
        ? await Storage.APIUsage.getByTenant(tenantId)
        : await Storage.APIUsage.getByTimeRange(Date.now() - 30 * 86400000, Date.now());
      rows = logs.map((l) => ({
        service: l.service,
        endpoint: l.endpoint,
        calls: l.calls,
        cost_usd: l.cost.toFixed(4),
        latency_ms: l.latencyAvgMs,
        error_rate: l.errorRate,
        category: l.category,
        date: new Date(l.timestamp).toISOString(),
      }));
    } else if (type === 'fleet_performance') {
      const fleets = tenantId
        ? await Storage.Fleets.getByTenant(tenantId)
        : await Storage.Fleets.getAll();
      rows = fleets.map((f) => ({
        fleet: f.name,
        region: f.region,
        status: f.status,
        vehicles: f.vehicleCount,
        active_vehicles: f.activeVehicles,
        uptime_pct: f.uptimePercent,
        last_heartbeat: new Date(f.lastHeartbeat).toISOString(),
        version: f.version,
      }));
    } else if (type === 'ai_optimisation') {
      const metrics = tenantId
        ? await Storage.AIMetrics.getByTenant(tenantId)
        : await Storage.AIMetrics.getByTimeRange(Date.now() - 30 * 86400000, Date.now());
      rows = metrics.map((m) => ({
        provider: m.provider,
        model: m.model,
        source: m.inferenceSource,
        tokens: m.tokensUsed,
        latency_ms: m.latencyMs,
        cost_usd: m.cost.toFixed(6),
        cache_hit: m.cacheHit,
        fallback: m.fallbackTriggered,
        task: m.taskType,
        date: new Date(m.timestamp).toISOString(),
      }));
    } else if (type === 'operational') {
      const ops = tenantId
        ? await Storage.Operations.getByTenant(tenantId)
        : await Storage.Operations.getByTimeRange(Date.now() - 30 * 86400000, Date.now());
      rows = ops.map((o) => ({
        fleet_id: o.fleetId,
        period: o.period,
        efficiency: o.efficiency,
        uptime: o.uptimePercent,
        delivery_success: o.deliverySuccessRate,
        route_opt: o.avgRouteOptimisation,
        driver_util: o.driverUtilisation,
        vehicle_util: o.vehicleUtilisation,
        incidents: o.incidentCount,
        date: new Date(o.timestamp).toISOString(),
      }));
    }

    const csv = objectsToCSV(rows);
    downloadString(csv, filename, 'text/csv');
    await completeJob(jobId);
    return jobId;
  } catch (err) {
    await failJob(jobId, String(err));
    throw err;
  }
}

export async function exportTenantReport(tenantId: string): Promise<string> {
  const jobId = (await createJob('pdf', 'tenant', { tenantId })).id;

  try {
    const tenant = await Storage.Tenants.get(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const fleets = await Storage.Fleets.getByTenant(tenantId);
    const aiMetrics = await Storage.AIMetrics.getByTenant(tenantId, 200);
    const apiLogs = await Storage.APIUsage.getByTenant(tenantId, 200);

    const sections = [
      {
        heading: `Tenant Report — ${tenant.name}`,
        text: `Region: ${tenant.region} | Plan: ${tenant.plan} | Status: ${tenant.status} | Vehicles: ${tenant.vehicleCount} | Drivers: ${tenant.driverCount}`,
      },
      {
        heading: 'Fleet Entities',
        headers: ['Fleet', 'Status', 'Vehicles', 'Uptime', 'Version'],
        rows: fleets.map((f) => [f.name, f.status, String(f.vehicleCount), `${f.uptimePercent}%`, f.version]),
      },
      {
        heading: 'AI Usage Summary',
        headers: ['Provider', 'Source', 'Tokens', 'Cost', 'Cache Hit'],
        rows: aiMetrics.slice(0, 30).map((m) => [m.provider, m.inferenceSource, String(m.tokensUsed), `$${m.cost.toFixed(4)}`, m.cacheHit ? 'Yes' : 'No']),
      },
      {
        heading: 'API Usage',
        headers: ['Service', 'Calls', 'Cost', 'Latency ms'],
        rows: apiLogs.slice(0, 30).map((l) => [l.service, String(l.calls), `$${l.cost.toFixed(2)}`, String(l.latencyAvgMs)]),
      },
    ];

    const blob = await generatePDFReport(`Tenant Report — ${tenant.name}`, sections);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex-tenant-${tenant.slug}-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    await completeJob(jobId);
    return jobId;
  } catch (err) {
    await failJob(jobId, String(err));
    throw err;
  }
}

export { Storage as ExportStorage };
