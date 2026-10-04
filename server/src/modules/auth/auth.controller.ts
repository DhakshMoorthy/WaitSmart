import type { Request, Response, NextFunction } from "express";
import { registerBody, loginBody, refreshBody, otpSendBody, otpVerifyBody } from "./auth.validator.js";
import { registerUser, loginUser, refreshTokens } from "./auth.service.js";
import { revokeRefreshToken } from "./auth.tokens.js";
import { sendOtp, verifyAndLogin } from "./auth.otp.service.js";
import type { AuthedRequest } from "../../types/index.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerBody.parse(req.body);
    const tenantId = (req as AuthedRequest).user?.tenantId ?? null;
    const result = await registerUser(input, tenantId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginBody.parse(req.body);
    const result = await loginUser(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const input = refreshBody.parse(req.body);
    const result = await refreshTokens(input.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function otpSend(req: Request, res: Response, next: NextFunction) {
  try {
    const input = otpSendBody.parse(req.body);
    const result = await sendOtp(input.phone);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function otpVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const input = otpVerifyBody.parse(req.body);
    const result = await verifyAndLogin(input.phone, input.otp, input.tenantSlug);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const input = refreshBody.parse(req.body);
    await revokeRefreshToken(input.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
