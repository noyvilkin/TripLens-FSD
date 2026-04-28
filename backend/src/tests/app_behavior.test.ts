import request from "supertest";
import fs from "fs";
import path from "path";
import type { Express } from "express";

const uploadsDir = path.resolve(__dirname, "../../uploads");
const uploadTestFileName = "coverage-test.txt";
const uploadTestFilePath = path.join(uploadsDir, uploadTestFileName);

describe("App Behavior", () => {
    const originalEnv = { ...process.env };
    let app: Express;

    beforeAll(() => {
        process.env.NODE_ENV = "development";
        process.env.CORS_ORIGINS = "http://allowed-origin.test";

        fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(uploadTestFilePath, "ok");

        jest.resetModules();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        app = require("../app").default;
        app.set("env", "test");
    });

    afterAll(async () => {
        process.env = originalEnv;

        if (fs.existsSync(uploadTestFilePath)) {
            fs.unlinkSync(uploadTestFilePath);
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    test("denies non-whitelisted origins in development", async () => {
        const response = await request(app)
            .get("/post")
            .set("Origin", "http://blocked-origin.test");

        expect(response.status).toBe(500);
    });

    test("allows whitelisted origins in development", async () => {
        const response = await request(app)
            .get("/post")
            .set("Origin", "http://allowed-origin.test");

        expect(response.status).toBe(200);
    });

    test("allows any origin in production", async () => {
        process.env.NODE_ENV = "production";
        jest.resetModules();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const productionApp = require("../app").default as Express;

        const response = await request(productionApp)
            .get("/post")
            .set("Origin", "http://blocked-origin.test");

        expect(response.status).toBe(200);
    });

    test("serves existing upload files", async () => {
        const response = await request(app).get(`/uploads/${uploadTestFileName}`);

        expect(response.status).toBe(200);
        expect(response.text).toContain("ok");
    });

    test("returns 404 for missing upload files", async () => {
        const response = await request(app).get("/uploads/does-not-exist.jpg");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "File not found" });
    });
});
