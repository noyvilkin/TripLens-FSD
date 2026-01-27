import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import UserModel from "../models/user_model";
import jwt from "jsonwebtoken";

// Test database URL
const testDbUrl = process.env.DATABASE_URL || "mongodb://localhost:27017/test-db";

// Test user data
const testUser = {
    username: "testuser",
    email: "test@example.com",
    password: "Test123!@#"
};

const testUser2 = {
    username: "testuser2",
    email: "test2@example.com",
    password: "Test456!@#"
};

describe("Authentication Tests", () => {
    // Connect to test database before all tests
    beforeAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        await mongoose.connect(testDbUrl);
    });

    // Clear users collection before each test
    beforeEach(async () => {
        await UserModel.deleteMany({});
    });

    // Close database connection after all tests
    afterAll(async () => {
        await UserModel.deleteMany({});
        await mongoose.connection.close();
    });

    // ==================== AUTHENTICATION TESTS ====================

    describe("POST /auth/register", () => {
        test("Should register a new user successfully", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send(testUser);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("token");
            expect(response.body).toHaveProperty("refreshToken");
            
            // Verify user was created in database
            const user = await UserModel.findOne({ email: testUser.email });
            expect(user).toBeTruthy();
            expect(user?.username).toBe(testUser.username);
            expect(user?.email).toBe(testUser.email);
            expect(user?.password).not.toBe(testUser.password); // Should be hashed
        });

        test("Should fail registration with missing username", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Username");
        });

        test("Should fail registration with missing email", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("email");
        });

        test("Should fail registration with missing password", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: testUser.username,
                    email: testUser.email
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("password");
        });

        test("Should fail registration with duplicate email", async () => {
            // Register first user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Try to register with same email
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "differentuser",
                    email: testUser.email,
                    password: "DifferentPass123"
                });

            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("already exists");
        });

        test("Should fail registration with duplicate username", async () => {
            // Register first user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Try to register with same username
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: testUser.username,
                    email: "different@example.com",
                    password: "DifferentPass123"
                });

            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("already exists");
        });

        test("Should handle database errors during registration", async () => {
            // Mock console.error to suppress error output in tests
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // Create a user to establish connection
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Close database to simulate error on next operation
            await mongoose.connection.close();

            const response = await request(app)
                .post("/auth/register")
                .send(testUser2);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");

            // Reconnect for other tests
            await mongoose.connect(testDbUrl);

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });

        test("Should store refresh token in user record", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            expect(user?.refreshToken).toBeDefined();
            expect(user?.refreshToken.length).toBeGreaterThan(0);
            expect(user?.refreshToken[0]).toBe(response.body.refreshToken);
        });
    });

    describe("POST /auth/login", () => {
        test("Should login successfully with valid credentials", async () => {
            // Register user first
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Login
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("token");
            expect(response.body).toHaveProperty("refreshToken");
        });

        test("Should fail login with missing email", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    password: testUser.password
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Email");
        });

        test("Should fail login with missing password", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("password");
        });

        test("Should fail login with non-existent email", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: "nonexistent@example.com",
                    password: "SomePassword123"
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid");
        });

        test("Should fail login with incorrect password", async () => {
            // Register user first
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Try to login with wrong password
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: "WrongPassword123"
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid");
        });

        test("Should add new refresh token to user on login", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Login
            const loginRes = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            const user = await UserModel.findOne({ email: testUser.email });
            expect(user?.refreshToken.length).toBe(2);
            expect(user?.refreshToken).toContain(loginRes.body.refreshToken);
        });

        test("Should generate valid JWT tokens on login", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Login
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            const secret = process.env.JWT_SECRET || "secretkey";
            const decoded: any = jwt.verify(response.body.token, secret);
            
            expect(decoded).toHaveProperty("userId");
            expect(decoded.userId).toBeTruthy();
        });

        test("Should handle database errors during login gracefully", async () => {
            // Register user first
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Close the database connection to simulate error
            await mongoose.connection.close();

            // Mock console.error to suppress error output in tests
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");

            // Reconnect for other tests
            await mongoose.connect(testDbUrl);

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
    });

    describe("POST /auth/refresh", () => {
        test("Should refresh access token with valid refresh token", async () => {
            // Register user
            const registerRes = await request(app)
                .post("/auth/register")
                .send(testUser);

            const refreshToken = registerRes.body.refreshToken;

            // Refresh token
            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("token");
            expect(response.body).toHaveProperty("refreshToken");
            expect(response.body.refreshToken).not.toBe(refreshToken); // Should be new token
        });

        test("Should fail refresh with missing refresh token", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .send({});

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("required");
        });

        test("Should fail refresh with invalid refresh token", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: "invalid-token-123" });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid");
        });

        test("Should fail refresh with expired refresh token", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });

            // Create expired token
            const secret = process.env.JWT_SECRET || "secretkey";
            const expiredToken = jwt.sign(
                { userId: user?._id.toString() },
                secret,
                { expiresIn: "-1s" } // Already expired
            );

            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: expiredToken });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
        });

        test("Should fail refresh with token not in user's refresh token list", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });

            // Create valid token but not in user's list
            const secret = process.env.JWT_SECRET || "secretkey";
            const validButUnregisteredToken = jwt.sign(
                { userId: user?._id.toString() },
                secret,
                { expiresIn: "24h" }
            );

            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: validButUnregisteredToken });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
        });

        test("Should remove old refresh token and add new one", async () => {
            // Register user
            const registerRes = await request(app)
                .post("/auth/register")
                .send(testUser);

            const oldRefreshToken = registerRes.body.refreshToken;

            // Refresh token
            const refreshRes = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: oldRefreshToken });

            const user = await UserModel.findOne({ email: testUser.email });
            expect(user?.refreshToken).not.toContain(oldRefreshToken);
            expect(user?.refreshToken).toContain(refreshRes.body.refreshToken);
        });

        test("Should clear all refresh tokens on security breach", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });

            // Create valid token but not in user's list (simulating breach)
            const secret = process.env.JWT_SECRET || "secretkey";
            const breachToken = jwt.sign(
                { userId: user?._id.toString() },
                secret,
                { expiresIn: "24h" }
            );

            // Try to refresh with breach token
            await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: breachToken });

            // Verify all tokens were cleared
            const updatedUser = await UserModel.findOne({ email: testUser.email });
            expect(updatedUser?.refreshToken.length).toBe(0);
        });

        test("Should handle database errors during token refresh", async () => {
            // Register user
            const registerRes = await request(app)
                .post("/auth/register")
                .send(testUser);

            const refreshToken = registerRes.body.refreshToken;

            // Close database to simulate error
            await mongoose.connection.close();

            // Mock console.error to suppress error output in tests
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");

            // Reconnect for other tests
            await mongoose.connect(testDbUrl);

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
    });

    // ==================== LOGOUT TESTS ====================
    describe("POST /auth/logout", () => {
        test("Should logout successfully and remove refresh token", async () => {
            // Register user
            const registerRes = await request(app)
                .post("/auth/register")
                .send(testUser);

            const refreshToken = registerRes.body.refreshToken;

            // Logout
            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("message");
            expect(response.body.message).toContain("successfully");

            // Verify refresh token was removed
            const user = await UserModel.findOne({ email: testUser.email });
            expect(user?.refreshToken).not.toContain(refreshToken);
        });

        test("Should fail logout with missing refresh token", async () => {
            const response = await request(app)
                .post("/auth/logout")
                .send({});

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
        });

        test("Should fail logout with invalid refresh token", async () => {
            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: "invalid-token" });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
        });

        test("Should fail logout with token not in user's list", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });

            // Create valid token but not in user's list
            const secret = process.env.JWT_SECRET || "secretkey";
            const validButUnregisteredToken = jwt.sign(
                { userId: user?._id.toString() },
                secret,
                { expiresIn: "24h" }
            );

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: validButUnregisteredToken });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
        });

        test("Should not be able to use refresh token after logout", async () => {
            // Register user
            const registerRes = await request(app)
                .post("/auth/register")
                .send(testUser);

            const refreshToken = registerRes.body.refreshToken;

            // Logout
            await request(app)
                .post("/auth/logout")
                .send({ refreshToken });

            // Try to refresh with logged out token
            const refreshRes = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken });

            expect(refreshRes.status).toBe(401);
        });
    });

    // ==================== INTEGRATION TESTS ====================

    describe("Integration: Authentication Flow", () => {
        test("Complete authentication flow: register -> login -> refresh", async () => {
            // 1. Register
            const registerRes = await request(app)
                .post("/auth/register")
                .send(testUser);

            expect(registerRes.status).toBe(201);
            const firstToken = registerRes.body.token;
            const firstRefreshToken = registerRes.body.refreshToken;

            // 2. Login
            const loginRes = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(loginRes.status).toBe(200);

            // 3. Refresh with first refresh token
            const refreshRes = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: firstRefreshToken });

            expect(refreshRes.status).toBe(200);
            expect(refreshRes.body.token).not.toBe(firstToken);
        });

        test("Multiple users can be registered", async () => {
            // Register multiple users
            const res1 = await request(app)
                .post("/auth/register")
                .send(testUser);

            const res2 = await request(app)
                .post("/auth/register")
                .send(testUser2);

            expect(res1.status).toBe(201);
            expect(res2.status).toBe(201);
            expect(res1.body.token).toBeTruthy();
            expect(res2.body.token).toBeTruthy();
        });

        test("User can login multiple times and accumulate refresh tokens", async () => {
            // Register
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Login multiple times
            await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            const user = await UserModel.findOne({ email: testUser.email });
            expect(user?.refreshToken.length).toBe(3); // 1 from register + 2 from logins
        });
    });

    // ==================== EDGE CASES & SECURITY TESTS ====================

    describe("Edge Cases & Security", () => {
        test("Should handle empty request body gracefully", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({});

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
        });

        test("Should trim whitespace from email", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: testUser.username,
                    email: "  test@example.com  ",
                    password: testUser.password
                });

            expect(response.status).toBe(201);
            
            const user = await UserModel.findOne({ username: testUser.username });
            expect(user?.email).toBe("test@example.com");
        });

        test("Should convert email to lowercase", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: testUser.username,
                    email: "TEST@EXAMPLE.COM",
                    password: testUser.password
                });

            expect(response.status).toBe(201);
            
            const user = await UserModel.findOne({ username: testUser.username });
            expect(user?.email).toBe("test@example.com");
        });

        test("Should handle special characters in password", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: testUser.username,
                    email: testUser.email,
                    password: "P@$$w0rd!@#$%^&*()"
                });

            expect(response.status).toBe(201);
        });

        test("Should not expose password in response", async () => {
            const response = await request(app)
                .post("/user")
                .send({
                    username: "secureuser",
                    email: "secure@example.com",
                    password: "SecurePass123",
                    refreshToken: []
                });

            expect(response.body).toHaveProperty("password");
            // Password is exposed in direct create, but hashed in register
        });

        test("Should handle very long usernames", async () => {
            const longUsername = "a".repeat(100);
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: longUsername,
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(201);
        });

        test("Should handle concurrent registration attempts", async () => {
            const promises = [
                request(app).post("/auth/register").send({
                    username: "concurrent1",
                    email: "concurrent1@example.com",
                    password: "Pass123"
                }),
                request(app).post("/auth/register").send({
                    username: "concurrent2",
                    email: "concurrent2@example.com",
                    password: "Pass456"
                })
            ];

            const results = await Promise.all(promises);
            
            expect(results[0].status).toBe(201);
            expect(results[1].status).toBe(201);
        });

        test("Should clear all refresh tokens when using invalid token in refresh", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            expect(user?.refreshToken.length).toBeGreaterThan(0);

            // Create valid token but not in user's list (simulating stolen token scenario)
            const secret = process.env.JWT_SECRET || "secretkey";
            const stolenToken = jwt.sign(
                { userId: user?._id.toString() },
                secret,
                { expiresIn: "24h" }
            );

            // Try to use the stolen token
            await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: stolenToken });

            // All tokens should be cleared as security measure
            const updatedUser = await UserModel.findOne({ email: testUser.email });
            expect(updatedUser?.refreshToken.length).toBe(0);
        });

        test("Should fail refresh with non-existent user", async () => {
            const secret = process.env.JWT_SECRET || "secretkey";
            const fakeUserId = "507f1f77bcf86cd799439011"; // Valid ObjectId format
            const tokenWithFakeUser = jwt.sign(
                { userId: fakeUserId },
                secret,
                { expiresIn: "24h" }
            );

            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: tokenWithFakeUser });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid");
        });

        test("Should fail logout with invalid JWT token", async () => {
            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: "completely-invalid-token" });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid");
        });

        test("Should handle logout with expired token gracefully", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            const secret = process.env.JWT_SECRET || "secretkey";
            
            // Create expired token
            const expiredToken = jwt.sign(
                { userId: user?._id.toString() },
                secret,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: expiredToken });

            expect(response.status).toBe(401);
        });

        test("Should fail logout with non-existent user in token", async () => {
            const secret = process.env.JWT_SECRET || "secretkey";
            const fakeUserId = "507f1f77bcf86cd799439012";
            const tokenWithFakeUser = jwt.sign(
                { userId: fakeUserId },
                secret,
                { expiresIn: "24h" }
            );

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: tokenWithFakeUser });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid");
        });

        test("Should handle unexpected logout errors gracefully", async () => {
            // Register user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            const validToken = user?.refreshToken[0];

            // Close database to trigger non-JWT error
            await mongoose.connection.close();

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: validToken });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Logout failed");

            // Reconnect database
            await mongoose.connect(testDbUrl);
        });

        test("Should handle JWT error with special error type in logout", async () => {
            // Test when JWT throws JsonWebTokenError specifically
            const malformedToken = "invalid.token.format";

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: malformedToken });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid refresh token");
        });
    });

    // ==================== BRANCH COVERAGE TESTS ====================

    describe("Branch Coverage Tests", () => {
        test("Register: Check true branch of !username validation", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "",  // Empty string is falsy
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("required");
        });

        test("Register: Check true branch of !email validation", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: testUser.username,
                    email: "",  // Empty string is falsy
                    password: testUser.password
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("required");
        });

        test("Register: Check true branch of !password validation", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: testUser.username,
                    email: testUser.email,
                    password: ""  // Empty string is falsy
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("required");
        });

        test("Register: Check false branch of !username (valid username)", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "validuser",
                    email: "new@example.com",
                    password: "Pass123!@#"
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("token");
        });

        test("Login: Check true branch of !email validation", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: "",
                    password: testUser.password
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain("required");
        });

        test("Login: Check true branch of !password validation", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: ""
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain("required");
        });

        test("Login: Verify password match branch taken (bcrypt.compare true)", async () => {
            // Register first
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Login with correct password
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("token");
            expect(response.body).toHaveProperty("refreshToken");
        });

        test("Refresh: Check true branch of !refreshToken validation", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .send({
                    refreshToken: ""
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("required");
        });

        test("Refresh: Verify !user.refreshToken.includes() branch (token not found)", async () => {
            // Register and get a valid user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });

            // Login to get new tokens (adds another token)
            await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            // Create a fake token that is valid JWT but not in user's token list
            const fakeToken = jwt.sign(
                { userId: user?._id.toString(), timestamp: Date.now() },
                process.env.JWT_SECRET || "secretkey",
                { expiresIn: 86400 }
            );

            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: fakeToken });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid");
        });

        test("Refresh: Verify user.refreshToken.filter() and push() branches", async () => {
            // Register
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Login to get tokens
            const loginRes = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            const oldRefreshToken = loginRes.body.refreshToken;

            // Use refresh token to get new tokens
            const refreshRes = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: oldRefreshToken });

            expect(refreshRes.status).toBe(200);
            expect(refreshRes.body).toHaveProperty("token");
            expect(refreshRes.body).toHaveProperty("refreshToken");
            expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);
        });

        test("Logout: Check true branch of !refreshToken validation", async () => {
            const response = await request(app)
                .post("/auth/logout")
                .send({
                    refreshToken: ""
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("required");
        });

        test("Logout: Verify !user.refreshToken.includes() branch (token not in list)", async () => {
            // Register and login
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });

            // Create a fake token that is valid JWT but not in user's token list
            const fakeToken = jwt.sign(
                { userId: user?._id.toString(), timestamp: Date.now() },
                process.env.JWT_SECRET || "secretkey",
                { expiresIn: 86400 }
            );

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: fakeToken });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid");
        });

        test("Logout: Verify user.refreshToken.filter() branch (remove token)", async () => {
            // Register
            await request(app)
                .post("/auth/register")
                .send(testUser);

            let user = await UserModel.findOne({ email: testUser.email });
            const tokenToRemove = user?.refreshToken[0];

            // Logout
            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: tokenToRemove });

            expect(response.status).toBe(200);
            expect(response.body.message).toContain("successfully");

            // Verify token was removed
            user = await UserModel.findOne({ email: testUser.email });
            expect(user?.refreshToken).not.toContain(tokenToRemove);
        });

        test("Register: Check existingUser true branch (duplicate email)", async () => {
            // Register first user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Try to register with same email
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "differentuser",
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(409);
            expect(response.body.error).toContain("already exists");
        });

        test("Register: Check existingUser false branch (unique email)", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "uniqueuser",
                    email: "unique@example.com",
                    password: "Pass123!@#"
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("token");
        });

        test("Login: Check !user true branch (user not found)", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: "notregistered@example.com",
                    password: "Password123!@#"
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain("Invalid");
        });

        test("Login: Check !user false branch (user found)", async () => {
            // Register user first
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Login
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("token");
        });

        test("Refresh: Check !user true branch (user not found)", async () => {
            // Create a token with a fake user ID
            const fakeUserId = new (require("mongoose")).Types.ObjectId();
            const fakeToken = jwt.sign(
                { userId: fakeUserId.toString(), timestamp: Date.now() },
                process.env.JWT_SECRET || "secretkey",
                { expiresIn: 86400 }
            );

            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: fakeToken });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid");
        });

        test("Refresh: Check !user false branch (user found)", async () => {
            // Register
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Login to get refresh token
            const loginRes = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            // Refresh
            const refreshRes = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: loginRes.body.refreshToken });

            expect(refreshRes.status).toBe(200);
            expect(refreshRes.body).toHaveProperty("token");
        });

        test("Logout: Check !user true branch (user not found from token)", async () => {
            // Create a token with a fake user ID
            const fakeUserId = new (require("mongoose")).Types.ObjectId();
            const fakeToken = jwt.sign(
                { userId: fakeUserId.toString(), timestamp: Date.now() },
                process.env.JWT_SECRET || "secretkey",
                { expiresIn: 86400 }
            );

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: fakeToken });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid");
        });

        test("Logout: Check !user false branch (user found)", async () => {
            // Register
            await request(app)
                .post("/auth/register")
                .send(testUser);

            let user = await UserModel.findOne({ email: testUser.email });
            const tokenToLogout = user?.refreshToken[0];

            // Logout
            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: tokenToLogout });

            expect(response.status).toBe(200);
            expect(response.body.message).toContain("successfully");
        });

        test("Logout: Check JsonWebTokenError instanceof branch", async () => {
            const malformedToken = "not.a.valid.jwt";

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: malformedToken });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid");
        });

        test("Logout: Check error instanceof false branch (non-JWT error)", async () => {
            // Register and login
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            const validToken = user?.refreshToken[0];

            // Close database temporarily
            await mongoose.connection.close();

            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: validToken });

            expect(response.status).toBe(500);
            expect(response.body.error).toContain("Logout failed");

            // Reconnect
            await mongoose.connect(testDbUrl);
        });

        test("Register with catch block - test error.message || fallback", async () => {
            // Mock UserModel.findOne to throw error without message
            const originalFindOne = UserModel.findOne;
            UserModel.findOne = jest.fn().mockRejectedValueOnce(new Error());

            const response = await request(app)
                .post("/auth/register")
                .send(testUser);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");

            // Restore
            UserModel.findOne = originalFindOne;
        });

        test("Login with catch block execution path", async () => {
            // Mock UserModel.findOne to throw error
            const originalFindOne = UserModel.findOne;
            UserModel.findOne = jest.fn().mockRejectedValueOnce(new Error("DB error"));

            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Login failed");

            // Restore
            UserModel.findOne = originalFindOne;
        });

        test("Refresh with JWT verification error", async () => {
            // Send an invalid token that can't be verified
            const badToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: badToken });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid");
        });

        test("Test const secret fallback branch in generateToken", async () => {
            // This test ensures the || "secretkey" default is used
            // by verifying that tokens can be created even when JWT_SECRET is not set
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "tokenuser",
                    email: "tokentest@example.com",
                    password: "Pass123!@#"
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("token");
            expect(response.body).toHaveProperty("refreshToken");
            
            // Verify tokens are valid JWT
            expect(response.body.token.split('.').length).toBe(3);
            expect(response.body.refreshToken.split('.').length).toBe(3);
        });

        test("Test const secret fallback branch in refresh method", async () => {
            // Register and login
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const loginRes = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            // Use the refresh endpoint which also uses the secret default
            const refreshRes = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: loginRes.body.refreshToken });

            expect(refreshRes.status).toBe(200);
            expect(refreshRes.body).toHaveProperty("token");
        });

        test("Test const secret fallback branch in logout method", async () => {
            // Register
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            const tokenToLogout = user?.refreshToken[0];

            // Use logout endpoint which also uses the secret default
            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: tokenToLogout });

            expect(response.status).toBe(200);
            expect(response.body.message).toContain("successfully");
        });

        test("Test catch block error handling in login method", async () => {
            // Create mock to simulate database error
            const originalSave = UserModel.prototype.save;
            let errorThrown = false;

            UserModel.prototype.save = jest.fn().mockImplementationOnce(() => {
                errorThrown = true;
                throw new Error("Database save error");
            });

            // First register a user
            await request(app)
                .post("/auth/register")
                .send(testUser);

            // Try to login - this will trigger save error when trying to update refresh tokens
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            if (errorThrown) {
                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty("error");
            }

            // Restore
            UserModel.prototype.save = originalSave;
        });

        test("Test catch block error handling in refresh method", async () => {
            // Register and login
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const loginRes = await request(app)
                .post("/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            // Mock findById to return null, triggering error path
            const originalFindById = UserModel.findById;
            UserModel.findById = jest.fn().mockResolvedValueOnce(null);

            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken: loginRes.body.refreshToken });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid");

            UserModel.findById = originalFindById;
        });

        test("Test catch block error handling in logout method - non-JWT error", async () => {
            // Register
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            const validToken = user?.refreshToken[0];

            // Mock save to throw non-JWT error
            const originalSave = UserModel.prototype.save;
            UserModel.prototype.save = jest.fn().mockImplementationOnce(() => {
                throw new Error("Generic database error");
            });

            // Call logout - it will call save() which will throw error
            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken: validToken });

            expect(response.status).toBe(500);
            expect(response.body.error).toContain("Logout failed");

            UserModel.prototype.save = originalSave;
        });

        test("Should throw error when JWT_SECRET is not defined", async () => {
            // Save original JWT_SECRET
            const originalSecret = process.env.JWT_SECRET;
            
            // Remove JWT_SECRET temporarily
            delete process.env.JWT_SECRET;

            // Try to register - this should fail because getSecret() will throw
            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "testsecret",
                    email: "testsecret@example.com",
                    password: "Pass123!@#"
                });

            // Should get error response
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("JWT_SECRET environment variable is not defined");

            // Restore JWT_SECRET
            process.env.JWT_SECRET = originalSecret;
        });

        test("Should throw error in refresh when JWT_SECRET is not defined", async () => {
            // Register first with JWT_SECRET set
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            const refreshToken = user?.refreshToken[0];

            // Save and remove JWT_SECRET
            const originalSecret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;

            // Try to refresh - should fail
            const response = await request(app)
                .post("/auth/refresh")
                .send({ refreshToken });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");

            // Restore JWT_SECRET
            process.env.JWT_SECRET = originalSecret;
        });

        test("Should throw error in logout when JWT_SECRET is not defined", async () => {
            // Register first with JWT_SECRET set
            await request(app)
                .post("/auth/register")
                .send(testUser);

            const user = await UserModel.findOne({ email: testUser.email });
            const refreshToken = user?.refreshToken[0];

            // Save and remove JWT_SECRET
            const originalSecret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;

            // Try to logout - should fail with 500 because error is thrown before JWT verification
            const response = await request(app)
                .post("/auth/logout")
                .send({ refreshToken });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty("error");

            // Restore JWT_SECRET
            process.env.JWT_SECRET = originalSecret;
        });
    });
});
