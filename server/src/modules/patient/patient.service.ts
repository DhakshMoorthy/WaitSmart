import { eq, and, desc } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users, appointments, patientFavorites, familyMembers, doctors, slots } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import type { UpdateProfileInput, AddFavoriteInput, AddFamilyMemberInput } from "./patient.validator.js";

export async function getProfile(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }
  const { passwordHash, ...profile } = user;
  return profile;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const [user] = await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!user) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }
  const { passwordHash, ...profile } = user;
  return profile;
}

export async function getHistory(userId: string, tenantId: string) {
  const rows = await db.query.appointments.findMany({
    where: and(
      eq(appointments.patientUserId, userId),
      eq(appointments.tenantId, tenantId),
    ),
    orderBy: desc(appointments.createdAt),
    limit: 50,
  });

  // Enrich with doctor name + slot date/time for the mobile bookings list
  return Promise.all(
    rows.map(async (appt) => {
      const [doctor, slot] = await Promise.all([
        db.query.doctors.findFirst({ where: eq(doctors.id, appt.doctorId) }),
        db.query.slots.findFirst({ where: eq(slots.id, appt.slotId) }),
      ]);
      return {
        id: appt.id,
        tokenNumber: appt.tokenNumber,
        status: appt.status,
        doctorId: appt.doctorId,
        doctorName: doctor?.name ?? "Doctor",
        clinicId: appt.clinicId,
        date: slot?.date ?? null,
        slotTime: slot?.slotTime ?? null,
        patientName: appt.patientName,
        patientPhone: appt.patientPhone,
        symptoms: appt.symptoms,
        doctorNotes: appt.doctorNotes,
        fileId: appt.fileId,
      };
    }),
  );
}

export async function getFavorites(userId: string, tenantId: string) {
  const favs = await db.query.patientFavorites.findMany({
    where: and(
      eq(patientFavorites.patientUserId, userId),
      eq(patientFavorites.tenantId, tenantId),
    ),
  });

  // Fetch doctor details
  const doctorIds = favs.map((f) => f.doctorId);
  if (doctorIds.length === 0) return [];

  const docs = await db.query.doctors.findMany({
    where: eq(doctors.tenantId, tenantId),
  });
  return docs.filter((d) => doctorIds.includes(d.id));
}

export async function addFavorite(userId: string, tenantId: string, input: AddFavoriteInput) {
  const [fav] = await db
    .insert(patientFavorites)
    .values({ tenantId, patientUserId: userId, doctorId: input.doctorId })
    .onConflictDoNothing()
    .returning();
  return fav ?? { message: "Already in favorites" };
}

export async function removeFavorite(userId: string, doctorId: string) {
  const [deleted] = await db
    .delete(patientFavorites)
    .where(and(eq(patientFavorites.patientUserId, userId), eq(patientFavorites.doctorId, doctorId)))
    .returning();
  if (!deleted) {
    throw new AppError(404, "Favorite not found", "NOT_FOUND");
  }
  return deleted;
}

export async function getFamily(userId: string, tenantId: string) {
  return db.query.familyMembers.findMany({
    where: and(eq(familyMembers.userId, userId), eq(familyMembers.tenantId, tenantId)),
  });
}

export async function addFamilyMember(userId: string, tenantId: string, input: AddFamilyMemberInput) {
  const [member] = await db
    .insert(familyMembers)
    .values({ tenantId, userId, ...input })
    .returning();
  return member;
}
