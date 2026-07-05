import type { Request } from "express";
import type { JwtPayload } from "@waitsmart/shared";

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}
