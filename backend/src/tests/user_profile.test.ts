import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import UserModel from "../models/user_model";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";

jest.mock("../services/ai_service", () => ({
    generateEmbeddings: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    generateImageSemanticContext: jest.fn().mockResolvedValue("travel, people, destination"),
    cosineSimilarity: jest.fn().mockReturnValue(0.9)
}));

const testDbUrl = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/triplens_test";

const testUser1 = {
    username: "johndoe",
    email: "john@example.com",
    password: "Password123"
};

const testUser2 = {
    username: "janedoe",
    email: "jane@example.com",
    password: "Password456"
};

describe("User Profile & Media Management Tests", () => {
    let user1Id: string;
    let user2Id: string;
    let user1Token: string;
    let user2Token: string;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "test-secret";
        }
        if (!process.env.JWT_REFRESH_SECRET) {
            process.env.JWT_REFRESH_SECRET = "refresh-secret-test";
        }
        
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(testDbUrl);
        }
    });

    beforeEach(async () => {
        // Clean up database
        await UserModel.deleteMany({});

        // Register test users
        const response1 = await request(app)
            .post("/auth/register")
            .send(testUser1);
        
        const response2 = await request(app)
            .post("/auth/register")
            .send(testUser2);

        user1Token = response1.body.accessToken;
        user2Token = response2.body.accessToken;

        const user1 = await UserModel.findOne({ email: testUser1.email });
        const user2 = await UserModel.findOne({ email: testUser2.email });

        user1Id = user1!._id.toString();
        user2Id = user2!._id.toString();
    });

    afterEach(async () => {
        // Clean up uploaded files
        const uploadsDir = path.join(__dirname, "../../uploads/profiles");
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(uploadsDir, file));
            });
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe("GET /user/profile/:userId - Get Public Profile", () => {
        test("Should retrieve public profile for a user", async () => {
            const response = await request(app)
                .get(`/user/profile/${user1Id}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("id", user1Id);
            expect(response.body).toHaveProperty("username", testUser1.username);
            expect(response.body).toHaveProperty("profilePic");
            expect(response.body).toHaveProperty("createdAt");

            // Should NOT expose sensitive data
            expect(response.body).not.toHaveProperty("email");
            expect(response.body).not.toHaveProperty("password");
            expect(response.body).not.toHaveProperty("refreshToken");
        });

        test("Should return 404 for non-existent user", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const response = await request(app)
                .get(`/user/profile/${fakeId}`);

            expect(response.status).toBe(404);
            expect(response.text).toBe("User not found");
        });

        test("Should return 400 for invalid user ID format", async () => {
            const response = await request(app)
                .get("/user/profile/invalid-id");

            expect(response.status).toBe(400);
        });
    });

    describe("PUT /user/:userId - Update Profile", () => {
        test("Should update username successfully", async () => {
            const newUsername = "johndoe_updated";
            
            const response = await request(app)
                .put(`/user/${user1Id}`)
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ username: newUsername });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("username", newUsername);
            expect(response.body).toHaveProperty("id", user1Id);
            expect(response.body).toHaveProperty("updatedAt");

            // Verify database was updated
            const updatedUser = await UserModel.findById(user1Id);
            expect(updatedUser?.username).toBe(newUsername);
        });

        test("Should upload and update profile image", async () => {
            // Create a test image file
            const testImagePath = path.join(__dirname, "test-image.png");
            const testImageBuffer = Buffer.from("fake-image-content");
            fs.writeFileSync(testImagePath, testImageBuffer);

            try {
                const response = await request(app)
                    .put(`/user/${user1Id}`)
                    .set("Authorization", `Bearer ${user1Token}`)
                    .attach("profileImage", testImagePath);

                expect(response.status).toBe(200);
                expect(response.body.profilePic).toMatch(/^\/uploads\/profiles\//);
                expect(response.body.profilePic).toMatch(/\.(png|jpg|jpeg|webp)$/);

                // Verify database was updated
                const updatedUser = await UserModel.findById(user1Id);
                expect(updatedUser?.profilePic).toBeTruthy();
                expect(updatedUser?.profilePic).toMatch(/^\/uploads\/profiles\//);
            } finally {
                // Clean up test image
                if (fs.existsSync(testImagePath)) {
                    fs.unlinkSync(testImagePath);
                }
            }
        });

        test("Should update both username and profile image", async () => {
            const newUsername = "john_with_pic";
            const testImagePath = path.join(__dirname, "test-image2.png");
            fs.writeFileSync(testImagePath, Buffer.from("fake-image-2"));

            try {
                const response = await request(app)
                    .put(`/user/${user1Id}`)
                    .set("Authorization", `Bearer ${user1Token}`)
                    .field("username", newUsername)
                    .attach("profileImage", testImagePath);

                expect(response.status).toBe(200);
                expect(response.body.username).toBe(newUsername);
                expect(response.body.profilePic).toMatch(/^\/uploads\/profiles\//);
            } finally {
                if (fs.existsSync(testImagePath)) {
                    fs.unlinkSync(testImagePath);
                }
            }
        });

        test("Should fail when user tries to edit another user's profile", async () => {
            const response = await request(app)
                .put(`/user/${user2Id}`)
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ username: "hacker" });

            expect(response.status).toBe(403);
            expect(response.text).toContain("You can only edit your own profile");
        });

        test("Should fail without authentication token", async () => {
            const response = await request(app)
                .put(`/user/${user1Id}`)
                .send({ username: "newname" });

            expect(response.status).toBe(401);
        });

        test("Should reject username that is too short", async () => {
            const response = await request(app)
                .put(`/user/${user1Id}`)
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ username: "ab" });

            expect(response.status).toBe(400);
            expect(response.text).toContain("between 3 and 30 characters");
        });

        test("Should reject username that is too long", async () => {
            const response = await request(app)
                .put(`/user/${user1Id}`)
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ username: "a".repeat(31) });

            expect(response.status).toBe(400);
            expect(response.text).toContain("between 3 and 30 characters");
        });

        test("Should reject username with invalid characters", async () => {
            const response = await request(app)
                .put(`/user/${user1Id}`)
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ username: "user@name!" });

            expect(response.status).toBe(400);
            expect(response.text).toContain("alphanumeric characters and underscores");
        });

        test("Should reject duplicate username", async () => {
            const response = await request(app)
                .put(`/user/${user1Id}`)
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ username: testUser2.username });

            expect(response.status).toBe(409);
            expect(response.text).toContain("Username already taken");
        });

        test("Should fail when no fields provided for update", async () => {
            const response = await request(app)
                .put(`/user/${user1Id}`)
                .set("Authorization", `Bearer ${user1Token}`)
                .send({});

            expect(response.status).toBe(400);
            expect(response.text).toContain("No valid fields to update");
        });

        test("Should reject invalid username type", async () => {
            const response = await request(app)
                .put(`/user/${user1Id}`)
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ username: 12345 });

            expect(response.status).toBe(400);
            expect(response.text).toContain("Username must be a string");
        });

        test("Should return 404 for non-existent user", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const fakeToken = jwt.sign(
                { id: fakeId, email: "fake@test.com" },
                process.env.JWT_SECRET!,
                { expiresIn: "1h" }
            );

            const response = await request(app)
                .put(`/user/${fakeId}`)
                .set("Authorization", `Bearer ${fakeToken}`)
                .send({ username: "newname" });

            expect(response.status).toBe(404);
            expect(response.text).toBe("User not found");
        });
    });

    describe("GET /post?userId=:userId - Get User-Specific Posts", () => {
        test("Should retrieve posts for a specific user", async () => {
            const testImageBuffer = Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
                "base64"
            );
            // Create posts for user1
            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${user1Token}`)
                .field("title", "User 1 Post 1")
                .field("content", "Content 1")
                .attach("images", testImageBuffer, "test.png");

            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${user1Token}`)
                .field("title", "User 1 Post 2")
                .field("content", "Content 2")
                .attach("images", testImageBuffer, "test.png");

            // Create post for user2
            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${user2Token}`)
                .field("title", "User 2 Post")
                .field("content", "Content")
                .attach("images", testImageBuffer, "test.png");

            // Get posts for user1
            const response = await request(app)
                .get(`/post?userId=${user1Id}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            expect(response.body[0].title).toMatch(/User 1 Post/);
            expect(response.body[1].title).toMatch(/User 1 Post/);
        });

        test("Should return empty array for user with no posts", async () => {
            const response = await request(app)
                .get(`/post?userId=${user1Id}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });
    });

    describe("File Upload Validation", () => {
        test("Should reject file larger than 5MB", async () => {
            const testImagePath = path.join(__dirname, "large-image.png");
            // Create a 6MB file
            const largeBuffer = Buffer.alloc(6 * 1024 * 1024, "x");
            fs.writeFileSync(testImagePath, largeBuffer);

            try {
                const response = await request(app)
                    .put(`/user/${user1Id}`)
                    .set("Authorization", `Bearer ${user1Token}`)
                    .attach("profileImage", testImagePath);

                expect(response.status).toBe(400);
            } finally {
                if (fs.existsSync(testImagePath)) {
                    fs.unlinkSync(testImagePath);
                }
            }
        });
    });
});
