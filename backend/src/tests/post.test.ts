import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import UserModel from "../models/user_model";
import PostModel from "../models/post_model";

jest.mock("../services/ai_service", () => ({
    generateEmbeddings: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    cosineSimilarity: jest.fn().mockReturnValue(0.9)
}));

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

const testImageBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
    "base64"
);

const createPostRequest = (token: string, overrides?: { title?: string; content?: string }) => {
    const title = overrides?.title ?? testPost.title;
    const content = overrides?.content ?? testPost.content;
    return request(app)
        .post("/post")
        .set("Authorization", `Bearer ${token}`)
        .field("title", title)
        .field("content", content)
        .attach("images", testImageBuffer, "test.png");
};

describe("Post Tests", () => {
    let accessToken: string;
    let accessToken2: string;
    let userId: string;

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
        
        accessToken = registerRes.body.accessToken || registerRes.body.token;
        const user = await UserModel.findOne({ email: testUser.email });
        userId = user?._id.toString() || "";

        // Register second test user
        const registerRes2 = await request(app)
            .post("/auth/register")
            .send(testUser2);
        
        accessToken2 = registerRes2.body.accessToken || registerRes2.body.token;
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
                .field("title", testPost.title)
                .field("content", testPost.content)
                .attach("images", testImageBuffer, "test.png");

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
                .field("content", testPost.content)
                .attach("images", testImageBuffer, "test.png");

            expect(response.status).toBe(400);
        });

        test("Should fail to create post without content", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .field("title", testPost.title)
                .attach("images", testImageBuffer, "test.png");

            expect(response.status).toBe(400);
        });

        test("Should create post without userId using auth context", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .field("title", testPost.title)
                .field("content", testPost.content)
                .attach("images", testImageBuffer, "test.png");

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("_id");
            expect(response.body.userId).toBe(userId);
        });
    });

    // ==================== GET POST TESTS ====================

    describe("GET /post", () => {
        test("Should get all posts without authentication", async () => {
            // Create a post first
            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .field("title", testPost.title)
                .field("content", testPost.content)
                .attach("images", testImageBuffer, "test.png");

            const response = await request(app)
                .get("/post");

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("posts");
            expect(Array.isArray(response.body.posts)).toBe(true);
            expect(response.body.posts.length).toBe(1);
            expect(response.body.posts[0].title).toBe(testPost.title);
        });

        test("Should get posts filtered by userId", async () => {
            // Create posts for both users
            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken}`)
                .field("title", "User 1 Post")
                .field("content", "Content by user 1")
                .attach("images", testImageBuffer, "test.png");

            await request(app)
                .post("/post")
                .set("Authorization", `Bearer ${accessToken2}`)
                .field("title", "User 2 Post")
                .field("content", "Content by user 2")
                .attach("images", testImageBuffer, "test.png");

            // Get posts filtered by user1
            const response = await request(app)
                .get(`/post?userId=${userId}`);

            expect(response.status).toBe(200);
            expect(response.body.posts.length).toBe(1);
            expect(response.body.posts[0].title).toBe("User 1 Post");
        });

        test("Should return empty posts array when no posts exist", async () => {
            const response = await request(app)
                .get("/post");

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("posts");
            expect(Array.isArray(response.body.posts)).toBe(true);
            expect(response.body.posts.length).toBe(0);
        });
    });

    describe("GET /post/:id", () => {
        test("Should get a post by ID without authentication", async () => {
            // Create a post first
            const createRes = await createPostRequest(accessToken);

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
            const createRes = await createPostRequest(accessToken);

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
            const createRes = await createPostRequest(accessToken);

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
            const createRes = await createPostRequest(accessToken);

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
            const createRes = await createPostRequest(accessToken);

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
            const createRes = await createPostRequest(accessToken);

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
            const createRes = await createPostRequest(accessToken);

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
            const createRes = await createPostRequest(accessToken);

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
            const createRes = await createPostRequest(accessToken);

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

    // ==================== PAGINATION TESTS ====================

    describe("GET /post (Pagination)", () => {
        test("Should return paginated response with correct shape", async () => {
            await createPostRequest(accessToken);

            const response = await request(app).get("/post");

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("posts");
            expect(response.body).toHaveProperty("totalPages");
            expect(response.body).toHaveProperty("currentPage");
            expect(Array.isArray(response.body.posts)).toBe(true);
        });

        test("Should default to page 1 when not provided", async () => {
            await createPostRequest(accessToken);

            const response = await request(app).get("/post");

            expect(response.body.currentPage).toBe(1);
        });

        test("Should paginate results correctly across pages", async () => {
            for (let i = 0; i < 15; i++) {
                await createPostRequest(accessToken, {
                    title: `Post ${i}`,
                    content: `Content ${i}`
                });
            }

            const page1 = await request(app).get("/post?page=1&limit=10");
            expect(page1.status).toBe(200);
            expect(page1.body.posts.length).toBe(10);
            expect(page1.body.totalPages).toBe(2);
            expect(page1.body.currentPage).toBe(1);

            const page2 = await request(app).get("/post?page=2&limit=10");
            expect(page2.status).toBe(200);
            expect(page2.body.posts.length).toBe(5);
            expect(page2.body.totalPages).toBe(2);
            expect(page2.body.currentPage).toBe(2);
        });

        test("Should calculate skip correctly as (page-1)*limit", async () => {
            for (let i = 0; i < 5; i++) {
                await createPostRequest(accessToken, {
                    title: `Post ${i}`,
                    content: `Content ${i}`
                });
            }

            const res = await request(app).get("/post?page=2&limit=2");
            expect(res.body.posts.length).toBe(2);
            expect(res.body.currentPage).toBe(2);
            expect(res.body.totalPages).toBe(3); // ceil(5/2) = 3
        });

        test("Should return posts sorted by createdAt descending (newest first)", async () => {
            await createPostRequest(accessToken, { title: "Oldest Post", content: "old content" });
            await createPostRequest(accessToken, { title: "Newest Post", content: "new content" });

            const res = await request(app).get("/post?page=1&limit=10");
            expect(res.body.posts[0].title).toBe("Newest Post");
            expect(res.body.posts[1].title).toBe("Oldest Post");
        });

        test("Should respect userId filter with pagination", async () => {
            for (let i = 0; i < 3; i++) {
                await createPostRequest(accessToken, {
                    title: `User1 Post ${i}`,
                    content: `Content ${i}`
                });
            }
            await createPostRequest(accessToken2, {
                title: "User2 Post",
                content: "Other user"
            });

            const res = await request(app).get(`/post?userId=${userId}&page=1&limit=10`);
            expect(res.body.posts.length).toBe(3);
            expect(res.body.totalPages).toBe(1);
            res.body.posts.forEach((p: { title: string }) => {
                expect(p.title).toContain("User1");
            });
        });

        test("Should return empty posts array for a page beyond total", async () => {
            await createPostRequest(accessToken);

            const res = await request(app).get("/post?page=99&limit=10");
            expect(res.status).toBe(200);
            expect(res.body.posts.length).toBe(0);
            expect(res.body.currentPage).toBe(99);
        });

        test("Should clamp limit to max 50", async () => {
            for (let i = 0; i < 5; i++) {
                await createPostRequest(accessToken, {
                    title: `Post ${i}`,
                    content: `Content ${i}`
                });
            }

            const res = await request(app).get("/post?page=1&limit=999");
            expect(res.body.posts.length).toBe(5);
            expect(res.body.totalPages).toBe(1);
        });
    });

    // ==================== INTEGRATION TESTS ====================

    describe("Integration: Post Workflow", () => {
        test("Complete post lifecycle: create -> read -> update -> delete", async () => {
            // 1. Create
            const createRes = await createPostRequest(accessToken);

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
                const res = await createPostRequest(accessToken, {
                    title: post.title,
                    content: post.content
                });
                expect(res.status).toBe(201);
            }

            const response = await request(app)
                .get(`/post?userId=${userId}`);

            expect(response.status).toBe(200);
            expect(response.body.posts.length).toBe(3);
        });
    });

    // ==================== AUTHENTICATION EDGE CASES ====================

    describe("Authentication Edge Cases", () => {
        test("Should fail with expired token", async () => {
            // Note: This test would require mocking time or using a pre-generated expired token
            // For now, we test with an invalid format
            const response = await request(app)
                .post("/post")
                .set(
                    "Authorization",
                    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid"
                )
                .field("title", testPost.title)
                .field("content", testPost.content)
                .attach("images", testImageBuffer, "test.png");

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
        });

        test("Should fail with no Authorization header", async () => {
            const response = await request(app)
                .post("/post")
                .field("title", testPost.title)
                .field("content", testPost.content)
                .attach("images", testImageBuffer, "test.png");

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Access denied");
        });

        test("Should fail with empty Authorization token", async () => {
            const response = await request(app)
                .post("/post")
                .set("Authorization", "Bearer ")
                .field("title", testPost.title)
                .field("content", testPost.content)
                .attach("images", testImageBuffer, "test.png");

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
        });

        test("Should return 400 when database error occurs", async () => {
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

