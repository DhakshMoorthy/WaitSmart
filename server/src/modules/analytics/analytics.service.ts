import { eq, and, sql, count } from "drizzle-orm";
import { db } from "../../config/db.js";
import { appointments, payments } from "../../db/schema/index.js";

export async function getDailyStats(tenantId: string, startDate?: string, endDate?: string) {
  const start = startDate ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const end = endDate ?? new Date().toISOString().split("T")[0];

  const result = await db
    .select({
      date: sql<string>`DATE(${appointments.createdAt})`.as("date"),
      total: count(),
      done: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'done')`.as("done"),
      cancelled: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'cancelled')`.as("cancelled"),
      noShow: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'no-show')`.as("no_show"),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        sql`DATE(${appointments.createdAt}) >= ${start}`,
        sql`DATE(${appointments.createdAt}) <= ${end}`,
      ),
    )
    .groupBy(sql`DATE(${appointments.createdAt})`)
    .orderBy(sql`DATE(${appointments.createdAt})`);

  return result;
}

export async function getWaitTimes(tenantId: string) {
  // Average time between appointment creation and status changing to "in-cabin"
  const result = await db
    .select({
      avgWaitMinutes: sql<number>`
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (${appointments.updatedAt} - ${appointments.createdAt})) / 60)
          FILTER (WHERE ${appointments.status} IN ('done', 'in-cabin')),
          0
        )`.as("avg_wait_minutes"),
    })
    .from(appointments)
    .where(eq(appointments.tenantId, tenantId));

  return { avgWaitMinutes: Math.round(result[0]?.avgWaitMinutes ?? 0) };
}

export async function getNoShowRate(tenantId: string) {
  const [stats] = await db
    .select({
      total: count(),
      noShows: sql<number>`COUNT(*) FILTER (WHERE ${appointments.status} = 'no-show')`.as("no_shows"),
    })
    .from(appointments)
    .where(eq(appointments.tenantId, tenantId));

  const total = stats?.total ?? 0;
  const noShows = stats?.noShows ?? 0;
  const rate = total > 0 ? ((noShows / total) * 100).toFixed(1) : "0.0";

  return { total, noShows, ratePercent: parseFloat(rate) };
}

export async function getRevenue(tenantId: string, startDate?: string, endDate?: string) {
  const start = startDate ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const end = endDate ?? new Date().toISOString().split("T")[0];

  const [result] = await db
    .select({
      totalPaise: sql<number>`COALESCE(SUM(${payments.amountPaise}) FILTER (WHERE ${payments.status} = 'paid'), 0)`.as("total_paise"),
      count: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} = 'paid')`.as("count"),
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        sql`DATE(${payments.createdAt}) >= ${start}`,
        sql`DATE(${payments.createdAt}) <= ${end}`,
      ),
    );

  return {
    totalPaise: result?.totalPaise ?? 0,
    totalRupees: ((result?.totalPaise ?? 0) / 100).toFixed(2),
    paymentCount: result?.count ?? 0,
  };
}
