import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import UserModel from "../models/user_model";
import PostModel from "../models/post_model";
import CommentModel from "../models/comment_model";

// Test database URL
const testDbUrl = process.env.DATABASE_URL || "mongodb://localhost:27017/test-db";

// Test user data
const testUser = {
    username: "commentTestUser",
    email: "commenttest@example.com",
    password: "Test123!@#"
};

const testUser2 = {
    username: "commentTestUser2",
    email: "commenttest2@example.com",
    password: "Test456!@#"
};

describe("Comment Tests", () => {
    let accessToken: string;
    let accessToken2: string;
    let userId: string;
    let userId2: string;
    let postId: string;
    let postId2: string;

    // Connect to test database before all tests
    beforeAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        await mongoose.connect(testDbUrl);
    });

    // Clear collections before each test
    beforeEach(async () => {
        await CommentModel.deleteMany({});
        await PostModel.deleteMany({});
        await UserModel.deleteMany({});

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

        // Create test posts
        const postRes = await request(app)
            .post("/post")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
                title: "Test Post for Comments",
                content: "This post will have comments",
                userId
            });
        postId = postRes.body._id;

        const postRes2 = await request(app)
            .post("/post")
            .set("Authorization", `Bearer ${accessToken2}`)
            .send({
                title: "Another Test Post",
                content: "Another post for comments",
                userId: userId2
            });
        postId2 = postRes2.body._id;
    });

    // Close database connection after all tests
    afterAll(async () => {
        await CommentModel.deleteMany({});
        await PostModel.deleteMany({});
        await UserModel.deleteMany({});
        await mongoose.connection.close();
    });

    // ==================== CREATE COMMENT TESTS ====================

    describe("POST /comment", () => {
        test("Should create a new comment when authenticated", async () => {
            const response = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "This is a test comment",
                    userId,
                    postId
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("_id");
            expect(response.body.content).toBe("This is a test comment");
            expect(response.body.userId).toBe(userId);
            expect(response.body.postId).toBe(postId);

            // Verify comment was created in database
            const comment = await CommentModel.findById(response.body._id);
            expect(comment).toBeTruthy();
            expect(comment?.content).toBe("This is a test comment");
        });

        test("Should fail to create comment without authentication", async () => {
            const response = await request(app)
                .post("/comment")
                .send({
                    content: "This is a test comment",
                    userId,
                    postId
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Access denied");
        });

        test("Should fail to create comment with invalid token", async () => {
            const response = await request(app)
                .post("/comment")
                .set("Authorization", "Bearer invalid-token-123")
                .send({
                    content: "This is a test comment",
                    userId,
                    postId
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Invalid token");
        });

        test("Should fail to create comment without content", async () => {
            const response = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    userId,
                    postId
                });

            expect(response.status).toBe(400);
        });

        test("Should fail to create comment without userId", async () => {
            const response = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Test comment",
                    postId
                });

            expect(response.status).toBe(400);
        });

        test("Should fail to create comment without postId", async () => {
            const response = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Test comment",
                    userId
                });

            expect(response.status).toBe(400);
        });

        test("User can comment on another user's post", async () => {
            const response = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Commenting on user2's post",
                    userId,
                    postId: postId2
                });

            expect(response.status).toBe(201);
            expect(response.body.postId).toBe(postId2);
        });
    });

    // ==================== GET COMMENT TESTS ====================

    describe("GET /comment", () => {
        test("Should get all comments without authentication", async () => {
            // Create a comment first
            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Test comment",
                    userId,
                    postId
                });

            const response = await request(app)
                .get("/comment");

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
            expect(response.body[0].content).toBe("Test comment");
        });

        test("Should get comments filtered by postId", async () => {
            // Create comments on different posts
            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Comment on post 1",
                    userId,
                    postId
                });

            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Comment on post 2",
                    userId,
                    postId: postId2
                });

            // Get comments filtered by postId
            const response = await request(app)
                .get(`/comment?postId=${postId}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].content).toBe("Comment on post 1");
        });

        test("Should get comments filtered by userId", async () => {
            // Create comments by different users
            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Comment by user 1",
                    userId,
                    postId
                });

            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken2}`)
                .send({
                    content: "Comment by user 2",
                    userId: userId2,
                    postId
                });

            // Get comments filtered by userId
            const response = await request(app)
                .get(`/comment?userId=${userId}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].content).toBe("Comment by user 1");
        });

        test("Should get comments filtered by both postId and userId", async () => {
            // Create multiple comments
            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "User1 on Post1",
                    userId,
                    postId
                });

            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "User1 on Post2",
                    userId,
                    postId: postId2
                });

            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken2}`)
                .send({
                    content: "User2 on Post1",
                    userId: userId2,
                    postId
                });

            // Get comments filtered by both
            const response = await request(app)
                .get(`/comment?postId=${postId}&userId=${userId}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].content).toBe("User1 on Post1");
        });

        test("Should return empty array when no comments exist", async () => {
            const response = await request(app)
                .get("/comment");

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });
    });

    describe("GET /comment/:id", () => {
        test("Should get a comment by ID without authentication", async () => {
            // Create a comment first
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Test comment",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            const response = await request(app)
                .get(`/comment/${commentId}`);

            expect(response.status).toBe(200);
            expect(response.body._id).toBe(commentId);
            expect(response.body.content).toBe("Test comment");
        });

        test("Should return 404 for non-existent comment", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const response = await request(app)
                .get(`/comment/${fakeId}`);

            expect(response.status).toBe(404);
        });

        test("Should return 400 for invalid comment ID format", async () => {
            const response = await request(app)
                .get("/comment/invalid-id");

            expect(response.status).toBe(400);
        });
    });

    // ==================== UPDATE COMMENT TESTS ====================

    describe("PUT /comment/:id", () => {
        test("Should update comment when authenticated", async () => {
            // Create a comment first
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Original comment",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            const response = await request(app)
                .put(`/comment/${commentId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Updated comment"
                });

            expect(response.status).toBe(200);
            expect(response.body.content).toBe("Updated comment");

            // Verify comment was updated in database
            const comment = await CommentModel.findById(commentId);
            expect(comment?.content).toBe("Updated comment");
        });

        test("Should fail to update comment without authentication", async () => {
            // Create a comment first
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Original comment",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            const response = await request(app)
                .put(`/comment/${commentId}`)
                .send({
                    content: "Updated comment"
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Access denied");

            // Verify comment was NOT updated
            const comment = await CommentModel.findById(commentId);
            expect(comment?.content).toBe("Original comment");
        });

        test("Should fail to update comment with invalid token", async () => {
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Original comment",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            const response = await request(app)
                .put(`/comment/${commentId}`)
                .set("Authorization", "Bearer invalid-token")
                .send({
                    content: "Updated comment"
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid token");
        });

        test("Should return 404 for non-existent comment update", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .put(`/comment/${fakeId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Updated comment"
                });

            expect(response.status).toBe(404);
        });

        test("Authenticated user can update comment (different user scenario)", async () => {
            // Create a comment by user 1
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Original comment",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            // User 2 tries to update it (Note: Current implementation allows any authenticated user)
            const response = await request(app)
                .put(`/comment/${commentId}`)
                .set("Authorization", `Bearer ${accessToken2}`)
                .send({
                    content: "Updated by User 2"
                });

            // Current implementation allows any authenticated user to update
            expect(response.status).toBe(200);
        });
    });

    // ==================== DELETE COMMENT TESTS ====================

    describe("DELETE /comment/:id", () => {
        test("Should delete comment when authenticated", async () => {
            // Create a comment first
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Comment to delete",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            const response = await request(app)
                .delete(`/comment/${commentId}`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain("Deleted");

            // Verify comment was deleted from database
            const comment = await CommentModel.findById(commentId);
            expect(comment).toBeNull();
        });

        test("Should fail to delete comment without authentication", async () => {
            // Create a comment first
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Comment to delete",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            const response = await request(app)
                .delete(`/comment/${commentId}`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty("error");
            expect(response.body.error).toContain("Access denied");

            // Verify comment was NOT deleted
            const comment = await CommentModel.findById(commentId);
            expect(comment).toBeTruthy();
        });

        test("Should fail to delete comment with invalid token", async () => {
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Comment to delete",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            const response = await request(app)
                .delete(`/comment/${commentId}`)
                .set("Authorization", "Bearer invalid-token");

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("Invalid token");
        });

        test("Should return 404 for non-existent comment deletion", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .delete(`/comment/${fakeId}`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(404);
        });
    });

    // ==================== INTEGRATION TESTS ====================

    describe("Integration: Comment Workflow", () => {
        test("Complete comment lifecycle: create -> read -> update -> delete", async () => {
            // 1. Create
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Original comment",
                    userId,
                    postId
                });

            expect(createRes.status).toBe(201);
            const commentId = createRes.body._id;

            // 2. Read
            const readRes = await request(app)
                .get(`/comment/${commentId}`);

            expect(readRes.status).toBe(200);
            expect(readRes.body.content).toBe("Original comment");

            // 3. Update
            const updateRes = await request(app)
                .put(`/comment/${commentId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Final comment"
                });

            expect(updateRes.status).toBe(200);
            expect(updateRes.body.content).toBe("Final comment");

            // 4. Delete
            const deleteRes = await request(app)
                .delete(`/comment/${commentId}`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(deleteRes.status).toBe(200);

            // 5. Verify deleted
            const verifyRes = await request(app)
                .get(`/comment/${commentId}`);

            expect(verifyRes.status).toBe(404);
        });

        test("Multiple comments can be created on same post", async () => {
            const comments = [
                { content: "Comment 1", userId, postId },
                { content: "Comment 2", userId, postId },
                { content: "Comment 3", userId, postId }
            ];

            for (const comment of comments) {
                const res = await request(app)
                    .post("/comment")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .send(comment);
                expect(res.status).toBe(201);
            }

            const response = await request(app)
                .get(`/comment?postId=${postId}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
        });

        test("Multiple users can comment on same post", async () => {
            // User 1 comments
            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Comment from user 1",
                    userId,
                    postId
                });

            // User 2 comments
            await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken2}`)
                .send({
                    content: "Comment from user 2",
                    userId: userId2,
                    postId
                });

            const response = await request(app)
                .get(`/comment?postId=${postId}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
        });
    });

    // ==================== AUTHENTICATION EDGE CASES ====================

    describe("Authentication Edge Cases", () => {
        test("Should fail with expired token", async () => {
            // Note: This test uses an invalid format to simulate expired behavior
            const response = await request(app)
                .post("/comment")
                .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid")
                .send({
                    content: "Test comment",
                    userId,
                    postId
                });

            expect(response.status).toBe(401);
        });

        test("Should fail with no Authorization header", async () => {
            const response = await request(app)
                .post("/comment")
                .send({
                    content: "Test comment",
                    userId,
                    postId
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain("No token provided");
        });

        test("Should fail with empty Bearer token", async () => {
            const response = await request(app)
                .post("/comment")
                .set("Authorization", "Bearer ")
                .send({
                    content: "Test comment",
                    userId,
                    postId
                });

            expect(response.status).toBe(401);
        });

        test("Read operations should work without authentication", async () => {
            // Create a comment with authentication
            const createRes = await request(app)
                .post("/comment")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    content: "Public comment",
                    userId,
                    postId
                });

            const commentId = createRes.body._id;

            // All read operations should work without auth
            const getAllRes = await request(app).get("/comment");
            expect(getAllRes.status).toBe(200);

            const getByIdRes = await request(app).get(`/comment/${commentId}`);
            expect(getByIdRes.status).toBe(200);

            const getByPostRes = await request(app).get(`/comment?postId=${postId}`);
            expect(getByPostRes.status).toBe(200);

            const getByUserRes = await request(app).get(`/comment?userId=${userId}`);
            expect(getByUserRes.status).toBe(200);
        });

        test("Should handle database errors in getAll", async () => {
            // Close database to simulate error
            await mongoose.connection.close();

            const response = await request(app).get("/comment");

            expect(response.status).toBe(400);
            expect(typeof response.text).toBe("string");
            expect(response.text.length).toBeGreaterThan(0);

            // Reconnect database
            await mongoose.connect(testDbUrl);
        });

        test("Should handle database errors when filtering by postId", async () => {
            // Close database to simulate error
            await mongoose.connection.close();

            const response = await request(app).get("/comment?postId=123");

            expect(response.status).toBe(400);
            expect(typeof response.text).toBe("string");
            expect(response.text.length).toBeGreaterThan(0);

            // Reconnect database
            await mongoose.connect(testDbUrl);
        });

        test("Should handle database errors when filtering by userId", async () => {
            // Close database to simulate error
            await mongoose.connection.close();

            const response = await request(app).get("/comment?userId=123");

            expect(response.status).toBe(400);
            expect(typeof response.text).toBe("string");
            expect(response.text.length).toBeGreaterThan(0);

            // Reconnect database
            await mongoose.connect(testDbUrl);
        });
    });
});

