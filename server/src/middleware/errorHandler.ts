import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../types/index.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}`, code: "NOT_FOUND" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.flatten(),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message, code: err.code });
  }

  logger.error("Unhandled error", { err });
  res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
}
