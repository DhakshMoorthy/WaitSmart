import type { Server, Socket } from "socket.io";
import { and, eq } from "drizzle-orm";
import { SOCKET_EVENTS, type JwtPayload } from "@waitsmart/shared";
import { db } from "../config/db.js";
import { doctors } from "../db/schema/index.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES = new Set(["admin", "doctor", "superadmin"]);

/** Room everyone in the tenant can watch: token numbers + statuses only. */
export const publicQueueRoom = (doctorId: string) => `queue:${doctorId}`;
/** Staff-only room: full payload incl. patient names, notes and file ids. */
export const staffQueueRoom = (doctorId: string) => `queue:${doctorId}:staff`;

export function registerQueueHandlers(_io: Server, socket: Socket) {
  const user = socket.data.user as JwtPayload;

  socket.on(SOCKET_EVENTS.QUEUE_SUBSCRIBE, async (doctorId: unknown) => {
    if (typeof doctorId !== "string" || !UUID_RE.test(doctorId)) return;

    // The doctor must belong to the caller's tenant (superadmin may watch any).
    const doctor = await db.query.doctors.findFirst({
      where: user.role === "superadmin"
        ? eq(doctors.id, doctorId)
        : and(eq(doctors.id, doctorId), eq(doctors.tenantId, user.tenantId ?? "")),
    });
    if (!doctor) return;

    socket.join(STAFF_ROLES.has(user.role) ? staffQueueRoom(doctorId) : publicQueueRoom(doctorId));
  });

  socket.on(SOCKET_EVENTS.QUEUE_UNSUBSCRIBE, (doctorId: unknown) => {
    if (typeof doctorId !== "string") return;
    socket.leave(publicQueueRoom(doctorId));
    socket.leave(staffQueueRoom(doctorId));
  });
}
