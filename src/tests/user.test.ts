import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import UserModel from "../models/user_model";

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

describe("User Endpoint Tests", () => {
    // Connect to test database before all tests
    beforeAll(async () => {
        // Small delay to avoid database connection conflicts with auth tests
        await new Promise(resolve => setTimeout(resolve, 100));
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

    describe("POST /user", () => {
        test("Should create a new user successfully", async () => {
            const newUser = {
                username: "newuser",
                email: "newuser@example.com",
                password: "NewPass123",
                refreshToken: []
            };

            const response = await request(app)
                .post("/user")
                .send(newUser);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("_id");
            expect(response.body.username).toBe(newUser.username);
            expect(response.body.email).toBe(newUser.email);
        });

        test("Should fail to create user with missing required fields", async () => {
            const response = await request(app)
                .post("/user")
                .send({
                    username: "incompleteuser"
                });

            expect(response.status).toBe(400);
        });

        test("Should fail to create user with duplicate email", async () => {
            const newUser = {
                username: "user1",
                email: "duplicate@example.com",
                password: "Pass123",
                refreshToken: []
            };

            // Create first user
            await request(app)
                .post("/user")
                .send(newUser);

            // Try to create second user with same email
            const response = await request(app)
                .post("/user")
                .send({
                    username: "user2",
                    email: "duplicate@example.com",
                    password: "Pass456",
                    refreshToken: []
                });

            expect(response.status).toBe(400);
        });

        test("Should fail to create user with duplicate username", async () => {
            const newUser = {
                username: "duplicateusername",
                email: "email1@example.com",
                password: "Pass123",
                refreshToken: []
            };

            // Create first user
            await request(app)
                .post("/user")
                .send(newUser);

            // Try to create second user with same username
            const response = await request(app)
                .post("/user")
                .send({
                    username: "duplicateusername",
                    email: "email2@example.com",
                    password: "Pass456",
                    refreshToken: []
                });

            expect(response.status).toBe(400);
        });
    });

    describe("GET /user", () => {
        test("Should get all users", async () => {
            // Create test users
            await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });
            await UserModel.create({
                username: testUser2.username,
                email: testUser2.email,
                password: testUser2.password,
                refreshToken: []
            });

            const response = await request(app)
                .get("/user");

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
        });

        test("Should return empty array when no users exist", async () => {
            const response = await request(app)
                .get("/user");

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        test("Should filter users by email query parameter", async () => {
            // Create test users
            await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });
            await UserModel.create({
                username: testUser2.username,
                email: testUser2.email,
                password: testUser2.password,
                refreshToken: []
            });

            const response = await request(app)
                .get(`/user?email=${testUser.email}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
            expect(response.body[0].email).toBe(testUser.email);
        });

        test("Should return empty array for non-existent email filter", async () => {
            await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });

            const response = await request(app)
                .get("/user?email=nonexistent@example.com");

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        test("Should handle database errors gracefully", async () => {
            // Close database to simulate error
            await mongoose.connection.close();

            const response = await request(app)
                .get("/user");

            expect(response.status).toBe(400);
            expect(typeof response.text).toBe("string");
            expect(response.text.length).toBeGreaterThan(0);

            // Reconnect for other tests
            await mongoose.connect(testDbUrl);
        });

        test("Should handle database errors when filtering by email", async () => {
            // Close database to simulate error
            await mongoose.connection.close();

            const response = await request(app).get("/user?email=test@example.com");

            expect(response.status).toBe(400);
            expect(typeof response.text).toBe("string");
            expect(response.text.length).toBeGreaterThan(0);

            // Reconnect database
            await mongoose.connect(testDbUrl);
        });
    });

    describe("GET /user/id/:id", () => {
        test("Should get user by ID", async () => {
            const user = await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });

            const response = await request(app)
                .get(`/user/id/${user._id}`);

            expect(response.status).toBe(200);
            expect(response.body._id).toBe(user._id.toString());
            expect(response.body.username).toBe(testUser.username);
            expect(response.body.email).toBe(testUser.email);
        });

        test("Should return 404 for non-existent user ID", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/user/id/${fakeId}`);

            expect(response.status).toBe(404);
            expect(response.text).toContain("Not found");
        });

        test("Should return 400 for invalid user ID format", async () => {
            const response = await request(app)
                .get("/user/id/invalid-id-format");

            expect(response.status).toBe(400);
        });
    });

    describe("GET /user/username/:username", () => {
        test("Should get user by username", async () => {
            await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });

            const response = await request(app)
                .get(`/user/username/${testUser.username}`);

            expect(response.status).toBe(200);
            expect(response.body.username).toBe(testUser.username);
            expect(response.body.email).toBe(testUser.email);
        });

        test("Should return 404 for non-existent username", async () => {
            const response = await request(app)
                .get("/user/username/nonexistentuser");

            expect(response.status).toBe(404);
            expect(response.text).toContain("not found");
        });

        test("Should be case-sensitive for username search", async () => {
            await UserModel.create({
                username: "TestUser",
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });

            const response = await request(app)
                .get("/user/username/testuser");

            expect(response.status).toBe(404);
        });

        test("Should handle database errors when searching by username", async () => {
            // Close database to simulate error
            await mongoose.connection.close();

            const response = await request(app)
                .get("/user/username/testuser");

            expect(response.status).toBe(400);

            // Reconnect for other tests
            await mongoose.connect(testDbUrl);
        });
    });

    describe("PUT /user/:id", () => {
        test("Should update user successfully", async () => {
            const user = await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });

            const updatedData = {
                username: "updatedusername",
                email: "updated@example.com"
            };

            const response = await request(app)
                .put(`/user/${user._id}`)
                .send(updatedData);

            expect(response.status).toBe(200);
            expect(response.body.username).toBe(updatedData.username);
            expect(response.body.email).toBe(updatedData.email);
        });

        test("Should return 404 when updating non-existent user", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .put(`/user/${fakeId}`)
                .send({ username: "updated" });

            expect(response.status).toBe(404);
            expect(response.text).toContain("Not found");
        });

        test("Should return 400 for invalid user ID format on update", async () => {
            const response = await request(app)
                .put("/user/invalid-id")
                .send({ username: "updated" });

            expect(response.status).toBe(400);
        });

        test("Should partially update user fields", async () => {
            const user = await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });

            const response = await request(app)
                .put(`/user/${user._id}`)
                .send({ username: "newusername" });

            expect(response.status).toBe(200);
            expect(response.body.username).toBe("newusername");
            expect(response.body.email).toBe(testUser.email); // Should remain unchanged
        });

        test("Should fail to update with duplicate email", async () => {
            // Create two users
            const user1 = await UserModel.create({
                username: "user1",
                email: "user1@example.com",
                password: "pass1",
                refreshToken: []
            });
            
            await UserModel.create({
                username: "user2",
                email: "user2@example.com",
                password: "pass2",
                refreshToken: []
            });

            // Try to update user1 with user2's email
            const response = await request(app)
                .put(`/user/${user1._id}`)
                .send({ email: "user2@example.com" });

            expect(response.status).toBe(400);
        });

        test("Should fail to update with duplicate username", async () => {
            // Create two users
            const user1 = await UserModel.create({
                username: "user1",
                email: "user1@example.com",
                password: "pass1",
                refreshToken: []
            });
            
            await UserModel.create({
                username: "user2",
                email: "user2@example.com",
                password: "pass2",
                refreshToken: []
            });

            // Try to update user1 with user2's username
            const response = await request(app)
                .put(`/user/${user1._id}`)
                .send({ username: "user2" });

            expect(response.status).toBe(400);
        });
    });

    describe("DELETE /user/:id", () => {
        test("Should delete user successfully", async () => {
            const user = await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });

            const response = await request(app)
                .delete(`/user/${user._id}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("message");
            expect(response.body.message).toContain("successfully");

            // Verify user was deleted
            const deletedUser = await UserModel.findById(user._id);
            expect(deletedUser).toBeNull();
        });

        test("Should return 404 when deleting non-existent user", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .delete(`/user/${fakeId}`);

            expect(response.status).toBe(404);
            expect(response.text).toContain("Not found");
        });

        test("Should return 400 for invalid user ID format on delete", async () => {
            const response = await request(app)
                .delete("/user/invalid-id");

            expect(response.status).toBe(400);
        });

        test("Should completely remove user from database", async () => {
            const user = await UserModel.create({
                username: testUser.username,
                email: testUser.email,
                password: testUser.password,
                refreshToken: []
            });

            await request(app)
                .delete(`/user/${user._id}`);

            const count = await UserModel.countDocuments({ _id: user._id });
            expect(count).toBe(0);
        });
    });

    describe("Integration: User Lifecycle", () => {
        test("User lifecycle: create -> get -> update -> delete", async () => {
            // 1. Create user
            const createRes = await request(app)
                .post("/user")
                .send({
                    username: "lifecycleuser",
                    email: "lifecycle@example.com",
                    password: "Life123",
                    refreshToken: []
                });

            expect(createRes.status).toBe(201);
            const userId = createRes.body._id;

            // 2. Get user by ID
            const getRes = await request(app)
                .get(`/user/id/${userId}`);

            expect(getRes.status).toBe(200);
            expect(getRes.body.username).toBe("lifecycleuser");

            // 3. Update user
            const updateRes = await request(app)
                .put(`/user/${userId}`)
                .send({ username: "updatedlifecycle" });

            expect(updateRes.status).toBe(200);
            expect(updateRes.body.username).toBe("updatedlifecycle");

            // 4. Delete user
            const deleteRes = await request(app)
                .delete(`/user/${userId}`);

            expect(deleteRes.status).toBe(200);

            // 5. Verify deletion
            const verifyRes = await request(app)
                .get(`/user/id/${userId}`);

            expect(verifyRes.status).toBe(404);
        });
    });
});
