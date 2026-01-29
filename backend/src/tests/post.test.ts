import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import UserModel from "../models/user_model";
import PostModel from "../models/post_model";

// Test database URL
const testDbUrl = process.env.DATABASE_URL || "mongodb://localhost:27017/test-db";

// Test user data
const testUser = {
    username: "postTestUser",
    email: "posttest@example.com",
    password: "Test123!@#"
};

const testUser2 = {
    username: "postTestUser2",
    email: "posttest2@example.com",
    password: "Test456!@#"
};

// Test post data
const testPost = {
    title: "Test Post Title",
    content: "This is the content of the test post."
};

describe("Post Tests", () => {
    let accessToken: string;
    let accessToken2: string;
    let userId: string;
    let userId2: string;

    // Connect to test database before all tests
    beforeAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        await mongoose.connect(testDbUrl);
    });

    // Clear collections before each test
    beforeEach(async () => {
        await UserModel.deleteMany({});
        await PostModel.deleteMany({});

        // Register test user and get tokens
        const registerRes = await request(app)
            .post("/auth/register")
            .send(testUser);
        
        accessToken = registerRes.body.token;
        const user = await UserModel.findOne({ email: testUser.email });
        userId = user?._id.toString() || "";

        // Register second test user
        const registerRes2 = await request(app)
            .post("/auth/register")
            .send(testUser2);
        
        accessToken2 = registerRes2.body.token;
        const user2 = await UserModel.findOne({ email: testUser2.email });
        userId2 = user2?._id.toString() || "";
    });

    // Close database connection after all tests
    afterAll(async () => {
        await UserModel.deleteMany({});
        await PostModel.deleteMany({});
        await mongoose.connection.close();
    });

    // ==================== CREATE POST TESTS ====================

    describe("POST /post", () => {
        test("Should create a new post when authenticated", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("_id");
            expect(response.body.title).toBe(testPost.title);
            expect(response.body.content).toBe(testPost.content);
            expect(response.body.userId).toBe(userId);

            // Verify post was created in database
            const post = await PostModel.findById(response.body._id);
            expect(post).toBeTruthy();
            expect(post?.title).toBe(testPost.title);
        });

        test("Should fail to create post without authentication", async () => {
            const response = await request(app)
                .post("/post")
                .send({
                    ...testPost,
                    userId
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Access denied");
        });

        test("Should fail to create post with invalid token", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", "Bearer invalid-token-123")
                .send({
                    ...testPost,
                    userId
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid token");
        });

        test("Should fail to create post with malformed authorization header", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", "InvalidFormat token")
                .send({
                    ...testPost,
                    userId
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid token format");
        });

        test("Should fail to create post without title", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: testPost.content,
                    userId
                });

            expect(response.status).toBe(400);
        });

        test("Should fail to create post without content", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    title: testPost.title,
                    userId
                });

            expect(response.status).toBe(400);
        });

        test("Should fail to create post without userId", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    title: testPost.title,
                    content: testPost.content
                });

            expect(response.status).toBe(400);
        });
    });

    // ==================== GET POST TESTS ====================

    describe("GET /post", () => {
        test("Should get all posts without authentication", async () => {
            // Create a post first
            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const response = await request(app)
                .get("/post");

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
            expect(response.body[0].title).toBe(testPost.title);
        });

        test("Should get posts filtered by userId", async () => {
            // Create posts for both users
            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    title: "User 1 Post",
                    content: "Content by user 1",
                    userId
                });

            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken2}`)
                .send({
                    title: "User 2 Post",
                    content: "Content by user 2",
                    userId: userId2
                });

            // Get posts filtered by user1
            const response = await request(app)
                .get(`/post?userId=${userId}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].title).toBe("User 1 Post");
        });

        test("Should return empty array when no posts exist", async () => {
            const response = await request(app)
                .get("/post");

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });
    });

    describe("GET /post/:id", () => {
        test("Should get a post by ID without authentication", async () => {
            // Create a post first
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            const response = await request(app)
                .get(`/post/${postId}`);

            expect(response.status).toBe(200);
            expect(response.body._id).toBe(postId);
            expect(response.body.title).toBe(testPost.title);
        });

        test("Should return 404 for non-existent post", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const response = await request(app)
                .get(`/post/${fakeId}`);

            expect(response.status).toBe(404);
        });

        test("Should return 400 for invalid post ID format", async () => {
            const response = await request(app)
                .get("/post/invalid-id");

            expect(response.status).toBe(400);
        });
    });

    // ==================== UPDATE POST TESTS ====================

    describe("PUT /post/:id", () => {
        test("Should update post when authenticated", async () => {
            // Create a post first
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            const response = await request(app)
                .put(`/post/${postId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    title: "Updated Title",
                    content: "Updated content"
                });

            expect(response.status).toBe(200);
            expect(response.body.title).toBe("Updated Title");
            expect(response.body.content).toBe("Updated content");

            // Verify post was updated in database
            const post = await PostModel.findById(postId);
            expect(post?.title).toBe("Updated Title");
        });

        test("Should fail to update post without authentication", async () => {
            // Create a post first
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            const response = await request(app)
                .put(`/post/${postId}`)
                .send({
                    title: "Updated Title"
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Access denied");

            // Verify post was NOT updated
            const post = await PostModel.findById(postId);
            expect(post?.title).toBe(testPost.title);
        });

        test("Should fail to update post with invalid token", async () => {
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            const response = await request(app)
                .put(`/post/${postId}`)
                .set("Authorization", "Bearer invalid-token")
                .send({
                    title: "Updated Title"
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid token");
        });

        test("Should update only title when provided", async () => {
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            const response = await request(app)
                .put(`/post/${postId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    title: "Only Title Updated"
                });

            expect(response.status).toBe(200);
            expect(response.body.title).toBe("Only Title Updated");
            expect(response.body.content).toBe(testPost.content);
        });

        test("Should return 404 for non-existent post update", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .put(`/post/${fakeId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    title: "Updated Title"
                });

            expect(response.status).toBe(404);
        });

        test("Authenticated user can update post (different user scenario)", async () => {
            // Create a post by user 1
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            // User 2 tries to update it (Note: Current implementation allows any authenticated user)
            const response = await request(app)
                .put(`/post/${postId}`)
                .set("Authorization", `Bearer ${accessToken2}`)
                .send({
                    title: "Updated by User 2"
                });

            // Current implementation allows any authenticated user to update
            expect(response.status).toBe(200);
        });
    });

    // ==================== DELETE POST TESTS ====================

    describe("DELETE /post/:id", () => {
        test("Should delete post when authenticated", async () => {
            // Create a post first
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            const response = await request(app)
                .delete(`/post/${postId}`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain("Deleted");

            // Verify post was deleted from database
            const post = await PostModel.findById(postId);
            expect(post).toBeNull();
        });

        test("Should fail to delete post without authentication", async () => {
            // Create a post first
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            const response = await request(app)
                .delete(`/post/${postId}`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Access denied");

            // Verify post was NOT deleted
            const post = await PostModel.findById(postId);
            expect(post).toBeTruthy();
        });

        test("Should fail to delete post with invalid token", async () => {
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            const postId = createRes.body._id;

            const response = await request(app)
                .delete(`/post/${postId}`)
                .set("Authorization", "Bearer invalid-token");

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid token");
        });

        test("Should return 404 for non-existent post deletion", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .delete(`/post/${fakeId}`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(404);
        });
    });

    // ==================== INTEGRATION TESTS ====================

    describe("Integration: Post Workflow", () => {
        test("Complete post lifecycle: create -> read -> update -> delete", async () => {
            // 1. Create
            const createRes = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    ...testPost,
                    userId
                });

            expect(createRes.status).toBe(201);
            const postId = createRes.body._id;

            // 2. Read
            const readRes = await request(app)
                .get(`/post/${postId}`);

            expect(readRes.status).toBe(200);
            expect(readRes.body.title).toBe(testPost.title);

            // 3. Update
            const updateRes = await request(app)
                .put(`/post/${postId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    title: "Final Title"
                });

            expect(updateRes.status).toBe(200);
            expect(updateRes.body.title).toBe("Final Title");

            // 4. Delete
            const deleteRes = await request(app)
                .delete(`/post/${postId}`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(deleteRes.status).toBe(200);

            // 5. Verify deleted
            const verifyRes = await request(app)
                .get(`/post/${postId}`);

            expect(verifyRes.status).toBe(404);
        });

        test("Multiple posts can be created by same user", async () => {
            const posts = [
                { title: "Post 1", content: "Content 1", userId },
                { title: "Post 2", content: "Content 2", userId },
                { title: "Post 3", content: "Content 3", userId }
            ];

            for (const post of posts) {
                const res = await request(app)
                    .post("/post")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .send(post);
                expect(res.status).toBe(201);
            }

            const response = await request(app)
                .get(`/post?userId=${userId}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
        });
    });

    // ==================== AUTHENTICATION EDGE CASES ====================

    describe("Authentication Edge Cases", () => {
        test("Should fail with expired token", async () => {
            // Note: This test would require mocking time or using a pre-generated expired token
            // For now, we test with an invalid format
            const response = await request(app)
                .post("/post")
                .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid")
                .send({
                    ...testPost,
                    userId
                });

            expect(response.status).toBe(401);
        });

        test("Should fail with no Authorization header", async () => {
            const response = await request(app)
                .post("/post")
                .send({
                    ...testPost,
                    userId
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("No token provided");
        });

        test("Should fail with empty Bearer token", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", "Bearer ")
                .send({
                    ...testPost,
                    userId
                });

            expect(response.status).toBe(401);
        });

        test("Should handle database errors in getAll", async () => {
            // Close database to simulate error
            await mongoose.connection.close();

            const response = await request(app).get("/post");

            expect(response.status).toBe(400);
            expect(typeof response.text).toBe("string");
            expect(response.text.length).toBeGreaterThan(0);

            // Reconnect database
            await mongoose.connect(testDbUrl);
        });

        test("Should handle database errors when filtering by userId", async () => {
            // Close database to simulate error
            await mongoose.connection.close();

            const response = await request(app).get("/post?userId=123");

            expect(response.status).toBe(400);
            expect(typeof response.text).toBe("string");
            expect(response.text.length).toBeGreaterThan(0);

            // Reconnect database
            await mongoose.connect(testDbUrl);
        });
    });
});

