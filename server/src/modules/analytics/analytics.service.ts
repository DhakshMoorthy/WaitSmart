import { eq, and, sql, count } from "drizzle-orm";
import { db } from "../../config/db.js";
import { appointments, payments } from "../../db/schema/index.js";
import type { Actor } from "../booking/booking.service.js";

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

export interface DaySummary {
  date: string;
  /** Bookings that were not cancelled. */
  total: number;
  completed: number;
  noShow: number;
  cancelled: number;
  /** Still to be seen: waiting + in the cabin. */
  waiting: number;
}

export interface SummaryResult extends DaySummary {
  /** Average minutes from "called in" to "done" for that day, or null when nothing measurable yet. */
  avgConsultMinutes: number | null;
  /** The 7 days ending on `date`, oldest first. */
  trend: DaySummary[];
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Appointment numbers for one clinic day, by the date of the slot (not when the booking was made).
 *  - admin / superadmin: the whole clinic group, or one doctor via `doctorId`
 *  - doctor: only their own doctor record(s), whatever `doctorId` says
 */
export async function getSummary(tenantId: string, actor: Actor, date: string, doctorId?: string): Promise<SummaryResult> {
  const from = addDays(date, -6);
  const scope =
    actor.role === "doctor"
      ? sql`AND a.doctor_id IN (SELECT id FROM doctors WHERE user_id = ${actor.userId} AND tenant_id = ${tenantId})`
      : doctorId
        ? sql`AND a.doctor_id = ${doctorId}`
        : sql``;

  const rows = await db.execute(sql`
    SELECT
      s.date::text AS date,
      COUNT(*) FILTER (WHERE a.status <> 'cancelled')::int AS total,
      COUNT(*) FILTER (WHERE a.status = 'done')::int AS completed,
      COUNT(*) FILTER (WHERE a.status = 'no-show')::int AS no_show,
      COUNT(*) FILTER (WHERE a.status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE a.status IN ('waiting', 'in-cabin'))::int AS waiting,
      AVG(EXTRACT(EPOCH FROM (a.completed_at - a.called_at)) / 60)
        FILTER (WHERE a.status = 'done' AND a.called_at IS NOT NULL AND a.completed_at > a.called_at
                AND a.completed_at - a.called_at < interval '3 hours') AS avg_consult
    FROM appointments a
    JOIN slots s ON s.id = a.slot_id
    WHERE a.tenant_id = ${tenantId}
      AND s.date BETWEEN ${from} AND ${date}
      ${scope}
    GROUP BY s.date
  `);

  const byDate = new Map<string, { day: DaySummary; avg: number | null }>();
  for (const r of rows.rows as Array<Record<string, unknown>>) {
    byDate.set(String(r.date), {
      day: {
        date: String(r.date),
        total: Number(r.total),
        completed: Number(r.completed),
        noShow: Number(r.no_show),
        cancelled: Number(r.cancelled),
        waiting: Number(r.waiting),
      },
      avg: r.avg_consult == null ? null : Number(r.avg_consult),
    });
  }

  const trend: DaySummary[] = [];
  for (let i = -6; i <= 0; i++) {
    const d = addDays(date, i);
    trend.push(byDate.get(d)?.day ?? { date: d, total: 0, completed: 0, noShow: 0, cancelled: 0, waiting: 0 });
  }
  const avg = byDate.get(date)?.avg ?? null;
  return { ...trend[trend.length - 1], avgConsultMinutes: avg == null ? null : Math.round(avg), trend };
}
