import type { RequestHandler } from "express";

export function notImplemented(module: string): RequestHandler {
  return (_req, res) => {
    res.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: `${module} is not implemented yet`,
      },
    });
  };
}
