import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as patientController from "./patient.controller.js";

export const patientRouter = Router();

patientRouter.use(requireAuth, requireTenant);

patientRouter.get("/profile", patientController.getProfile);
patientRouter.patch("/profile", patientController.updateProfile);
patientRouter.get("/history", patientController.getHistory);
patientRouter.get("/favorites", patientController.getFavorites);
patientRouter.post("/favorites", patientController.addFavorite);
patientRouter.get("/family", patientController.getFamily);
patientRouter.post("/family", patientController.addFamilyMember);
