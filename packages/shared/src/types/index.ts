import type { Role } from "../constants/roles.js";

export interface JwtPayload {
  userId: string;
  tenantId: string | null;
  role: Role;
  email: string;
}

export interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
