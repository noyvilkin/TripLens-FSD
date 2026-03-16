import request from "supertest";
import type { Express } from "express";
import path from "path";
import fs from "fs";

const frontendDistDir = path.resolve(__dirname, "../../../frontend/dist");
const indexPath = path.join(frontendDistDir, "index.html");
const HTML_CONTENT =
    '<!doctype html><html><head><title>TripLens</title></head><body><div id="root"></div></body></html>';

describe("Production Static Assets", () => {
    let app: Express;
    let createdFile = false;
    const originalNodeEnv = process.env.NODE_ENV;
    let consoleErrorSpy: jest.SpyInstance;

    beforeAll(() => {
        consoleErrorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        fs.mkdirSync(frontendDistDir, { recursive: true });
        if (!fs.existsSync(indexPath)) {
            fs.writeFileSync(indexPath, HTML_CONTENT);
            createdFile = true;
        }

        process.env.NODE_ENV = "production";
        jest.resetModules();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        app = require("../app").default;
    });

    afterAll(async () => {
        process.env.NODE_ENV = originalNodeEnv;
        if (createdFile && fs.existsSync(indexPath)) {
            fs.unlinkSync(indexPath);
        }
        consoleErrorSpy?.mockRestore();

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    test("serves index.html with 200 status for the root path", async () => {
        const response = await request(app).get("/");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/html/);
        expect(response.text).toContain("TripLens");
    });

    test("serves index.html for unmatched SPA routes (React Router support)", async () => {
        const response = await request(app).get("/profile/some-user");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/html/);
        expect(response.text).toContain("TripLens");
    });

    test("API routes still take precedence over the SPA catch-all", async () => {
        const response = await request(app).get("/api-docs/");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/html/);
    });
});
