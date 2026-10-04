import { Router } from "express";
import { register, login, refresh, logout, otpSend, otpVerify } from "./auth.controller.js";
import { authRateLimiter } from "../../middleware/rateLimiter.js";

export const authRouter = Router();

authRouter.post("/register", authRateLimiter, register);
authRouter.post("/login", authRateLimiter, login);
authRouter.post("/refresh", authRateLimiter, refresh);
authRouter.post("/logout", authRateLimiter, logout);
authRouter.post("/otp/send", authRateLimiter, otpSend);
authRouter.post("/otp/verify", authRateLimiter, otpVerify);
