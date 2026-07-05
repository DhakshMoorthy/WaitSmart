export const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  DOCTOR: "doctor",
  PATIENT: "patient",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LIST = Object.values(ROLES);
