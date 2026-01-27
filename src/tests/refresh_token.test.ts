import mongoose from "mongoose";
import RefreshTokenModel from "../models/refresh_token_model";
import UserModel from "../models/user_model";
import "../app"; // Import app to establish database connection

// Test database URL
const testDbUrl = process.env.DATABASE_URL || "mongodb://localhost:27017/test-db";

describe("Refresh Token Model Tests", () => {
    let testUserId: mongoose.Types.ObjectId;

    // Connect to test database before all tests
    beforeAll(async () => {
        // Small delay to avoid database connection conflicts
        await new Promise(resolve => setTimeout(resolve, 200));
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        await mongoose.connect(testDbUrl);

        // Create a test user
        const testUser = await UserModel.create({
            username: "tokenTestUser",
            email: "tokentest@example.com",
            password: "hashedPassword123"
        });
        testUserId = testUser._id as mongoose.Types.ObjectId;
    }, 60000);

    // Clear refresh tokens collection before each test
    beforeEach(async () => {
        await RefreshTokenModel.deleteMany({});
    });

    // Close database connection after all tests
    afterAll(async () => {
        await RefreshTokenModel.deleteMany({});
        await UserModel.deleteMany({ email: "tokentest@example.com" });
        await mongoose.connection.close();
    });

    describe("Schema Validation", () => {
        test("Should create a refresh token with all required fields", async () => {
            const tokenData = {
                userId: testUserId,
                token: "valid-refresh-token-123",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            };

            const refreshToken = await RefreshTokenModel.create(tokenData);

            expect(refreshToken).toBeTruthy();
            expect(refreshToken.userId.toString()).toBe(testUserId.toString());
            expect(refreshToken.token).toBe(tokenData.token);
            expect(refreshToken.expiresAt).toEqual(tokenData.expiresAt);
            expect(refreshToken.createdAt).toBeDefined();
        });

        test("Should fail to create token without userId", async () => {
            const tokenData = {
                token: "valid-refresh-token-123",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            await expect(RefreshTokenModel.create(tokenData)).rejects.toThrow();
        });

        test("Should fail to create token without token field", async () => {
            const tokenData = {
                userId: testUserId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            await expect(RefreshTokenModel.create(tokenData)).rejects.toThrow();
        });

        test("Should fail to create token without expiresAt", async () => {
            const tokenData = {
                userId: testUserId,
                token: "valid-refresh-token-123"
            };

            await expect(RefreshTokenModel.create(tokenData)).rejects.toThrow();
        });

        test("Should automatically set createdAt timestamp", async () => {
            const tokenData = {
                userId: testUserId,
                token: "valid-refresh-token-123",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const refreshToken = await RefreshTokenModel.create(tokenData);

            expect(refreshToken.createdAt).toBeDefined();
            expect(refreshToken.createdAt).toBeInstanceOf(Date);
            expect(refreshToken.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
        });
    });

    describe("Token Uniqueness", () => {
        test("Should enforce unique token constraint", async () => {
            const tokenData = {
                userId: testUserId,
                token: "duplicate-token-123",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            await RefreshTokenModel.create(tokenData);

            // Try to create another token with the same token string
            await expect(RefreshTokenModel.create(tokenData)).rejects.toThrow();
        });

        test("Should allow same userId with different tokens", async () => {
            const tokenData1 = {
                userId: testUserId,
                token: "token-1",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const tokenData2 = {
                userId: testUserId,
                token: "token-2",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const token1 = await RefreshTokenModel.create(tokenData1);
            const token2 = await RefreshTokenModel.create(tokenData2);

            expect(token1._id).not.toEqual(token2._id);
            expect(token1.token).not.toBe(token2.token);
            expect(token1.userId.toString()).toBe(token2.userId.toString());
        });
    });

    describe("CRUD Operations", () => {
        test("Should find refresh token by token string", async () => {
            const tokenData = {
                userId: testUserId,
                token: "findable-token-123",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            await RefreshTokenModel.create(tokenData);

            const foundToken = await RefreshTokenModel.findOne({ token: tokenData.token });

            expect(foundToken).toBeTruthy();
            expect(foundToken?.token).toBe(tokenData.token);
            expect(foundToken?.userId.toString()).toBe(testUserId.toString());
        });

        test("Should find all tokens for a specific user", async () => {
            const tokens = [
                {
                    userId: testUserId,
                    token: "user-token-1",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                },
                {
                    userId: testUserId,
                    token: "user-token-2",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            ];

            await RefreshTokenModel.insertMany(tokens);

            const userTokens = await RefreshTokenModel.find({ userId: testUserId });

            expect(userTokens).toHaveLength(2);
            expect(userTokens.every(t => t.userId.toString() === testUserId.toString())).toBe(true);
        });

        test("Should delete refresh token by id", async () => {
            const tokenData = {
                userId: testUserId,
                token: "deletable-token-123",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const token = await RefreshTokenModel.create(tokenData);

            await RefreshTokenModel.findByIdAndDelete(token._id);

            const deletedToken = await RefreshTokenModel.findById(token._id);
            expect(deletedToken).toBeNull();
        });

        test("Should delete all tokens for a user", async () => {
            const tokens = [
                {
                    userId: testUserId,
                    token: "user-token-delete-1",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                },
                {
                    userId: testUserId,
                    token: "user-token-delete-2",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            ];

            await RefreshTokenModel.insertMany(tokens);

            await RefreshTokenModel.deleteMany({ userId: testUserId });

            const remainingTokens = await RefreshTokenModel.find({ userId: testUserId });
            expect(remainingTokens).toHaveLength(0);
        });

        test("Should update token expiration date", async () => {
            const tokenData = {
                userId: testUserId,
                token: "updateable-token-123",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const token = await RefreshTokenModel.create(tokenData);

            const newExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            await RefreshTokenModel.findByIdAndUpdate(token._id, { expiresAt: newExpiresAt });

            const updatedToken = await RefreshTokenModel.findById(token._id);
            expect(updatedToken?.expiresAt.getTime()).toBe(newExpiresAt.getTime());
        });
    });

    describe("User Reference", () => {
        test("Should populate user reference", async () => {
            const tokenData = {
                userId: testUserId,
                token: "populate-test-token",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            await RefreshTokenModel.create(tokenData);

            const tokenWithUser = await RefreshTokenModel
                .findOne({ token: tokenData.token })
                .populate("userId");

            expect(tokenWithUser).toBeTruthy();
            expect(tokenWithUser?.userId).toBeTruthy();
            // @ts-ignore - populated field
            expect(tokenWithUser?.userId.email).toBe("tokentest@example.com");
        });
    });

    describe("TTL Index and Expiration", () => {
        test("Should have expiresAt field set correctly", async () => {
            const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const tokenData = {
                userId: testUserId,
                token: "expiration-test-token",
                expiresAt: futureDate
            };

            const token = await RefreshTokenModel.create(tokenData);

            expect(token.expiresAt.getTime()).toBe(futureDate.getTime());
        });

        test("Should accept past expiration dates", async () => {
            const pastDate = new Date(Date.now() - 1000);
            const tokenData = {
                userId: testUserId,
                token: "expired-token",
                expiresAt: pastDate
            };

            const token = await RefreshTokenModel.create(tokenData);

            expect(token.expiresAt.getTime()).toBe(pastDate.getTime());
        });
    });

    describe("Query Operations", () => {
        test("Should find non-expired tokens", async () => {
            const tokens = [
                {
                    userId: testUserId,
                    token: "valid-token-1",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                },
                {
                    userId: testUserId,
                    token: "expired-token-1",
                    expiresAt: new Date(Date.now() - 1000)
                }
            ];

            await RefreshTokenModel.insertMany(tokens);

            const validTokens = await RefreshTokenModel.find({
                userId: testUserId,
                expiresAt: { $gt: new Date() }
            });

            expect(validTokens).toHaveLength(1);
            expect(validTokens[0].token).toBe("valid-token-1");
        });

        test("Should count tokens for a user", async () => {
            const tokens = [
                {
                    userId: testUserId,
                    token: "count-token-1",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                },
                {
                    userId: testUserId,
                    token: "count-token-2",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            ];

            await RefreshTokenModel.insertMany(tokens);

            const count = await RefreshTokenModel.countDocuments({ userId: testUserId });

            expect(count).toBe(2);
        });
    });
});
