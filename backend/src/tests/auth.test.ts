import request from "supertest";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import app from "../app";
import mongoose from "mongoose";
import UserModel from "../models/user_model";

var verifyIdTokenMock: jest.Mock;
let consoleErrorSpy: jest.SpyInstance;

jest.mock("google-auth-library", () => {
    verifyIdTokenMock = jest.fn();
    return {
        OAuth2Client: jest.fn().mockImplementation(() => ({
            verifyIdToken: verifyIdTokenMock
        }))
    };
});

const testDbUrl = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/triplens_test";

const testUser = {
    username: "testuser",
    email: "test@example.com",
    password: "TestPassword123"
};

describe("Authentication Flow Tests", () => {
    beforeAll(async () => {
        // Silence noisy error logs in tests (e.g., Google failure path)
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        if (!process.env.JWT_REFRESH_SECRET) {
            process.env.JWT_REFRESH_SECRET = "refresh-secret-test";
        }
        // Ensure we are connected to the local Mongo as required 
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(testDbUrl);
        }
    });

    beforeEach(async () => {
        await UserModel.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
        consoleErrorSpy && consoleErrorSpy.mockRestore();
    });

    describe("POST /auth/register", () => {
        test("Should register and set HttpOnly cookie", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send(testUser);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("accessToken"); // Requirement met 
            
            // Check for HttpOnly Refresh Token cookie 
            const cookies = response.get("Set-Cookie");
            expect(cookies).toBeDefined();
            expect(cookies![0]).toContain("refreshToken=");
            expect(cookies![0]).toContain("HttpOnly");

            const user = await UserModel.findOne({ email: testUser.email });
            expect(user).toBeTruthy();
            expect(user?.refreshToken.length).toBe(1);
        });

        test("Should fail if email already exists", async () => {
            await request(app).post("/auth/register").send(testUser);
            const response = await request(app).post("/auth/register").send(testUser);
            
            expect(response.status).toBe(409); // Conflict status
        });

        test("Should reject missing fields", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({ email: "nope@test.com" });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error", "Missing fields");
        });

        test("Should surface registration failures", async () => {
            const createSpy = jest.spyOn(UserModel, "create").mockRejectedValue(new Error("db down"));

            const response = await request(app)
                .post("/auth/register")
                .send({ username: "x", email: "x@test.com", password: "pass" });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error", "Registration failed");

            createSpy.mockRestore();
        });

        test("Should honor env expirations and randomUUID fallback", async () => {
            const originalUuid = (crypto as any).randomUUID;
            const originalAccessExp = process.env.JWT_EXPIRES_IN;
            const originalRefreshExp = process.env.JWT_REFRESH_EXPIRES_IN;

            (crypto as any).randomUUID = undefined;
            process.env.JWT_EXPIRES_IN = "1h";
            process.env.JWT_REFRESH_EXPIRES_IN = "2d";

            try {
                const response = await request(app)
                    .post("/auth/register")
                    .send({ username: "uuiduser", email: "uuid@test.com", password: "pass" });

                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty("accessToken");
            } finally {
                (crypto as any).randomUUID = originalUuid;
                process.env.JWT_EXPIRES_IN = originalAccessExp;
                process.env.JWT_REFRESH_EXPIRES_IN = originalRefreshExp;
            }
        });

        test("Should fall back to default expirations when env missing", async () => {
            const originalAccessExp = process.env.JWT_EXPIRES_IN;
            const originalRefreshExp = process.env.JWT_REFRESH_EXPIRES_IN;

            delete process.env.JWT_EXPIRES_IN;
            delete process.env.JWT_REFRESH_EXPIRES_IN;

            try {
                const response = await request(app)
                    .post("/auth/register")
                    .send({ username: "noenv", email: "noenv@test.com", password: "Pass123!" });

                expect(response.status).toBe(201);
            } finally {
                process.env.JWT_EXPIRES_IN = originalAccessExp;
                process.env.JWT_REFRESH_EXPIRES_IN = originalRefreshExp;
            }
        });
    });

    describe("POST /auth/login", () => {
        test("Should login and provide accessToken", async () => {
            await request(app).post("/auth/register").send(testUser);

            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("accessToken");
            
            const cookies = response.get("Set-Cookie");
            expect(cookies).toBeDefined();
            expect(cookies && cookies[0]).toContain("refreshToken=");
        });

        test("Should reject invalid credentials", async () => {
            await request(app).post("/auth/register").send(testUser);

            const response = await request(app)
                .post("/auth/login")
                .send({ email: testUser.email, password: "WrongPass" });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error", "Invalid credentials");
        });

        test("Should surface login failures", async () => {
            const findSpy = jest.spyOn(UserModel, "findOne").mockRejectedValue(new Error("db fail"));

            const response = await request(app)
                .post("/auth/login")
                .send({ email: "fail@test.com", password: "pass" });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error", "Login failed");

            findSpy.mockRestore();
        });

        test("Should set secure cookie on login in production", async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";

            try {
                await request(app).post("/auth/register").send({ username: "prodlogin", email: "prodlogin@test.com", password: "Pass123!" });

                const response = await request(app)
                    .post("/auth/login")
                    .send({ email: "prodlogin@test.com", password: "Pass123!" });

                const cookies = response.get("Set-Cookie");
                expect(cookies![0]).toContain("Secure");
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });
    });

    describe("POST /auth/refresh", () => {
        test("Should refresh accessToken using cookie", async () => {
            // 1. Register to get the initial cookie
            const regResponse = await request(app)
                .post("/auth/register")
                .send(testUser);
            
            const refreshTokenCookie = regResponse.get("Set-Cookie");

            // 2. Call refresh using the cookie received
            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", refreshTokenCookie ? refreshTokenCookie : []) // Sending cookie back to server
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("accessToken");
            
            // Verify token rotation: a new cookie should be set 
            const newCookies = response.get("Set-Cookie");
            expect(newCookies).toBeDefined();
            expect(refreshTokenCookie).toBeDefined();
            expect(newCookies![0]).not.toEqual(refreshTokenCookie![0]);
        });

        test("Should reject when no cookie provided", async () => {
            const response = await request(app).post("/auth/refresh").send();
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error", "No refresh token");
        });

        test("Should reject reused/unknown refresh token without clearing stored tokens", async () => {
            await request(app).post("/auth/register").send(testUser);
            const user = await UserModel.findOne({ email: testUser.email });
            const originalTokenCount = user?.refreshToken.length ?? 0;
            const refreshSecret = process.env.JWT_REFRESH_SECRET as string;
            const forgedToken = jwt.sign({ userId: user!._id.toString(), tokenId: "forged" }, refreshSecret, { expiresIn: "7d" });

            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${forgedToken}`])
                .send();

            expect(response.status).toBe(401);
            const updatedUser = await UserModel.findOne({ email: testUser.email });
            expect(updatedUser?.refreshToken.length).toBe(originalTokenCount);
        });

        test("Should return session expired on invalid token signature", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", ["refreshToken=invalid.token.value"])
                .send();

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error", "Session expired");
        });

        test("Should reject refresh when decoded user no longer exists", async () => {
            const phantomUserId = new mongoose.Types.ObjectId().toString();
            const refreshSecret = process.env.JWT_REFRESH_SECRET as string;
            const token = jwt.sign({ userId: phantomUserId, tokenId: "ghost" }, refreshSecret, { expiresIn: "7d" });

            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${token}`])
                .send();

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error", "Invalid token");
        });

        test("Should set secure cookie when production", async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";

            try {
                const regResponse = await request(app)
                    .post("/auth/register")
                    .send({ username: "prod", email: "prod@test.com", password: "Pass123!" });

                const refreshTokenCookie = regResponse.get("Set-Cookie");

                const response = await request(app)
                    .post("/auth/refresh")
                    .set("Cookie", refreshTokenCookie ?? [])
                    .send();

                const cookies = response.get("Set-Cookie");
                expect(cookies![0]).toContain("Secure");
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });
    });

    describe("POST /auth/logout", () => {
        test("Should clear cookie and remove from DB", async () => {
            const regResponse = await request(app)
                .post("/auth/register")
                .send(testUser);
            
            const refreshTokenCookie = regResponse.get("Set-Cookie");

            const response = await request(app)
                .post("/auth/logout")
                .set("Cookie", refreshTokenCookie ?? [])
                .send();

            expect(response.status).toBe(200);
            
            // Verify cookie is cleared
            const cookies = response.get("Set-Cookie");
            expect(cookies).toBeDefined();
            expect(cookies![0]).toContain("refreshToken=;"); // Cleared cookie

            // Verify DB is empty 
            const user = await UserModel.findOne({ email: testUser.email });
            expect(user?.refreshToken.length).toBe(0);
        });

        test("Should return 204 when no cookie present", async () => {
            const response = await request(app).post("/auth/logout").send();
            expect(response.status).toBe(204);
        });

        test("Should clear cookie even with invalid token", async () => {
            const response = await request(app)
                .post("/auth/logout")
                .set("Cookie", ["refreshToken=not-a-real-token"])
                .send();

            expect(response.status).toBe(200);
            const cookies = response.get("Set-Cookie");
            expect(cookies![0]).toContain("refreshToken=;");
        });

        test("Should handle valid token for non-existent user", async () => {
            const phantomUserId = new mongoose.Types.ObjectId().toString();
            const token = jwt.sign({ userId: phantomUserId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: "7d" });

            const response = await request(app)
                .post("/auth/logout")
                .set("Cookie", [`refreshToken=${token}`])
                .send();

            expect(response.status).toBe(200);
            const cookies = response.get("Set-Cookie");
            expect(cookies![0]).toContain("refreshToken=;");
        });
    });

    describe("POST /auth/google", () => {
        const googlePath = "/auth/google";
        const payload = {
            email: "google_user@test.com",
            name: "Google User",
            picture: "http://example.com/pic.png"
        };

        beforeEach(() => {
            verifyIdTokenMock.mockReset();
        });

        test("Should login via Google and set cookie", async () => {
            verifyIdTokenMock.mockResolvedValue({ getPayload: () => payload });

            const response = await request(app)
                .post(googlePath)
                .send({ credential: "valid-google-token" });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("accessToken");
            const cookies = response.get("Set-Cookie");
            expect(cookies![0]).toContain("refreshToken=");
        });

        test("Should reject when credential missing", async () => {
            const response = await request(app).post(googlePath).send({});
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error", "Missing Google credential");
        });

        test("Should reject when payload is invalid", async () => {
            verifyIdTokenMock.mockResolvedValue({ getPayload: () => ({}) });

            const response = await request(app)
                .post(googlePath)
                .send({ credential: "bad-payload" });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error", "Invalid Google token");
        });

        test("Should handle Google verification errors", async () => {
            verifyIdTokenMock.mockRejectedValue(new Error("google failure"));

            const response = await request(app)
                .post(googlePath)
                .send({ credential: "throws" });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty("error", "Google login failed");
        });

        test("Should log in existing Google user without creating new one", async () => {
            await UserModel.create({ username: payload.name, email: payload.email, password: "hash" });
            verifyIdTokenMock.mockResolvedValue({ getPayload: () => payload });

            const response = await request(app)
                .post(googlePath)
                .send({ credential: "valid-google-token" });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("accessToken");

            const users = await UserModel.find({ email: payload.email });
            expect(users.length).toBe(1); // no extra user created
        });

        test("Should set secure cookie on Google login in production", async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            verifyIdTokenMock.mockResolvedValue({ getPayload: () => payload });

            try {
                const response = await request(app)
                    .post(googlePath)
                    .send({ credential: "prod-google" });

                const cookies = response.get("Set-Cookie");
                expect(cookies![0]).toContain("Secure");
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });

        test("Should fall back to email when Google name missing", async () => {
            const payloadNoName = {
                email: "noname@test.com",
                picture: "http://example.com/no.png"
            } as any;

            verifyIdTokenMock.mockResolvedValue({ getPayload: () => payloadNoName });

            const response = await request(app)
                .post(googlePath)
                .send({ credential: "noname" });

            expect(response.status).toBe(200);
            const user = await UserModel.findOne({ email: payloadNoName.email });
            expect(user?.username).toBe(payloadNoName.email);
        });
    });
});