/**
 * APEX COMMAND CENTER OS
 * core/financeResolver.ts
 *
 * Finance SSOT — derives all financial figures from live event stores.
 *
 * RULE (from STEP 5):
 *   In hybrid/live mode, Finance MUST be fully derived:
 *   - revenue  = sum(financial_events where category === 'revenue')
 *   - costs    = sum(api_usage_logs.cost + ai_metrics.cost + infra costs)
 *   - savings  = sum(operational_metrics.savings)
 *
 *   Mock revenue/cost curves are NEVER used in hybrid or live mode.
 *
 * In mock mode, the store already has seed-generated financial_events
 * written through Storage SSOT → these same derivation functions apply.
 */

import { safeSum, safeFilter } from './dataResolver';
import { DATA_MODE } from './dataMode';
import type {
  FinancialEvent, APIUsageLog, AIMetric, OperationalMetric, InfrastructureMetric,
} from '@/types';

export interface DerivedFinancials {
  totalRevenue: number;
  totalApiCost: number;
  totalAICost: number;
  totalInfraCost: number;
  totalCosts: number;
  totalSavings: number;
  netMargin: number;
  /** Revenue broken down by category */
  revenueByCategory: Record<string, number>;
  /** Cost breakdown by category */
  costBreakdown: Array<{ name: string; value: number }>;
  /** Daily revenue/cost trend (last N days) */
  dailyTrend: Array<{ date: string; revenue: number; cost: number; savings: number }>;
}

/**
 * deriveFinancials — computes all finance figures from live store data.
 * Safe to call with empty arrays — always returns a zero-filled structure.
 */
export function deriveFinancials(
  financialEvents: FinancialEvent[],
  apiLogs: APIUsageLog[],
  aiMetrics: AIMetric[],
  opsMetrics: OperationalMetric[],
  infraMetrics: InfrastructureMetric[],
  periodDays = 30
): DerivedFinancials {

  const cutoff = Date.now() - periodDays * 86400000;

  // ── Revenue ─────────────────────────────────────────────────────────────
  const revenueEvents = safeFilter(
    financialEvents,
    (e) => e.category === 'revenue' && e.timestamp >= cutoff
  );
  const totalRevenue = safeSum(revenueEvents, 'amount');

  const revenueByCategory: Record<string, number> = {};
  revenueEvents.forEach((e) => {
    revenueByCategory[e.subCategory ?? 'subscription'] =
      (revenueByCategory[e.subCategory ?? 'subscription'] ?? 0) + (e.amount ?? 0);
  });

  // ── API Costs ────────────────────────────────────────────────────────────
  const recentApiLogs = safeFilter(apiLogs, (l) => l.timestamp >= cutoff);
  const totalApiCost = safeSum(recentApiLogs, 'cost');

  // ── AI Costs ─────────────────────────────────────────────────────────────
  const recentAIMetrics = safeFilter(aiMetrics, (m) => m.timestamp >= cutoff);
  const totalAICost = safeSum(recentAIMetrics, 'cost');

  // ── Infrastructure Costs ─────────────────────────────────────────────────
  // InfrastructureMetric has no costUSD — infra costs come only from financial_events
  const totalInfraCost = 0;

  // Also pull explicit infra cost events from financial_events
  const infraEvents = safeFilter(
    financialEvents,
    (e) => e.category === 'infrastructure' && e.timestamp >= cutoff
  );
  const infraEventsCost = safeSum(infraEvents, 'amount');

  const totalCosts = totalApiCost + totalAICost + totalInfraCost + infraEventsCost;

  // ── Savings ──────────────────────────────────────────────────────────────
  const recentOps = safeFilter(opsMetrics, (m) => m.timestamp >= cutoff);
  const opsEventSavings = safeSum(recentOps, 'savings' as keyof OperationalMetric);

  const savingEvents = safeFilter(
    financialEvents,
    (e) => e.category === 'optimisation_saving' && e.timestamp >= cutoff
  );
  const totalSavings = opsEventSavings + safeSum(savingEvents, 'amount');

  // ── Net margin ───────────────────────────────────────────────────────────
  const netMargin = totalRevenue > 0
    ? parseFloat((((totalRevenue - totalCosts) / totalRevenue) * 100).toFixed(1))
    : 0;

  // ── Cost breakdown (for pie chart) ───────────────────────────────────────
  const costBreakdown = [
    { name: 'API Costs',        value: parseFloat(totalApiCost.toFixed(2)) },
    { name: 'AI Costs',         value: parseFloat(totalAICost.toFixed(2)) },
    { name: 'Infrastructure',   value: parseFloat((totalInfraCost + infraEventsCost).toFixed(2)) },
  ].filter((c) => c.value > 0);

  // ── Daily trend ───────────────────────────────────────────────────────────
  const dailyMap: Record<string, { revenue: number; cost: number; savings: number }> = {};
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA').slice(5);
    dailyMap[d] = { revenue: 0, cost: 0, savings: 0 };
  }

  financialEvents.forEach((e) => {
    if (e.timestamp < cutoff) return;
    const d = new Date(e.timestamp).toLocaleDateString('en-CA').slice(5);
    if (!dailyMap[d]) return;
    if (e.category === 'revenue') dailyMap[d].revenue += e.amount ?? 0;
    else if (e.category === 'optimisation_saving') dailyMap[d].savings += e.amount ?? 0;
    else dailyMap[d].cost += e.amount ?? 0;
  });

  apiLogs.forEach((l) => {
    if (l.timestamp < cutoff) return;
    const d = new Date(l.timestamp).toLocaleDateString('en-CA').slice(5);
    if (dailyMap[d]) dailyMap[d].cost += l.cost ?? 0;
  });

  aiMetrics.forEach((m) => {
    if (m.timestamp < cutoff) return;
    const d = new Date(m.timestamp).toLocaleDateString('en-CA').slice(5);
    if (dailyMap[d]) dailyMap[d].cost += m.cost ?? 0;
  });

  opsMetrics.forEach((m) => {
    if ((m.timestamp ?? 0) < cutoff) return;
    const d = new Date(m.timestamp ?? Date.now()).toLocaleDateString('en-CA').slice(5);
    if (dailyMap[d]) dailyMap[d].savings += (m as Record<string, unknown>).savings as number ?? 0;
  });

  const dailyTrend = Object.entries(dailyMap).map(([date, v]) => ({
    date,
    revenue: parseFloat(v.revenue.toFixed(2)),
    cost: parseFloat(v.cost.toFixed(2)),
    savings: parseFloat(v.savings.toFixed(2)),
  }));

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalApiCost: parseFloat(totalApiCost.toFixed(2)),
    totalAICost: parseFloat(totalAICost.toFixed(2)),
    totalInfraCost: parseFloat((totalInfraCost + infraEventsCost).toFixed(2)),
    totalCosts: parseFloat(totalCosts.toFixed(2)),
    totalSavings: parseFloat(totalSavings.toFixed(2)),
    netMargin,
    revenueByCategory,
    costBreakdown,
    dailyTrend,
  };
}

/**
 * shouldUseDerivedFinance — returns true when Finance page should use
 * deriveFinancials() instead of raw mock curves.
 * Always true in hybrid/live mode.
 */
export const shouldUseDerivedFinance = DATA_MODE !== 'mock';
