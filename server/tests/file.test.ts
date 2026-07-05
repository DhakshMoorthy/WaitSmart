import { describe, it, expect, beforeAll } from "vitest";
import { api, createTestTenant, createTestUser, patientToken } from "./helpers.js";

describe("File Module", () => {
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const user = await createTestUser(tenantId, "patient");
    token = patientToken(user.id, tenantId);
  });

  describe("POST /files/upload", () => {
    it("should upload an allowed file type", async () => {
      // Create a minimal valid PNG (1x1 pixel)
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const res = await api
        .post("/files/upload")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", pngBuffer, {
          filename: "test.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.filename).toBe("test.png");
    });

    it("should reject disallowed file types", async () => {
      const res = await api
        .post("/files/upload")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("text content"), {
          filename: "test.txt",
          contentType: "text/plain",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_FILE_TYPE");
    });

    it("should reject request without file", async () => {
      const res = await api
        .post("/files/upload")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /files/:id", () => {
    it("should serve an uploaded file", async () => {
      const pdfBuffer = Buffer.from("%PDF-1.4 minimal");

      const uploadRes = await api
        .post("/files/upload")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", pdfBuffer, {
          filename: "doc.pdf",
          contentType: "application/pdf",
        });

      const fileId = uploadRes.body.data.id;

      const res = await api
        .get(`/files/${fileId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
    });

    it("should 404 for non-existent file", async () => {
      const res = await api
        .get("/files/00000000-0000-0000-0000-000000000099")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
