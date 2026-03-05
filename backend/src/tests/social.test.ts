import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import UserModel from "../models/user_model";
import PostModel from "../models/post_model";

jest.mock("../services/ai_service", () => ({
    generateEmbeddings: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    cosineSimilarity: jest.fn().mockReturnValue(0.9)
}));

const testDbUrl = process.env.DATABASE_URL || "mongodb://localhost:27017/test-db";

const testUser = {
    username: "socialTestUser",
    email: "socialtest@example.com",
    password: "Test123!@#"
};

const testUser2 = {
    username: "socialTestUser2",
    email: "socialtest2@example.com",
    password: "Test456!@#"
};

const testImageBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
    "base64"
);

const createTestPost = (token: string) =>
    request(app)
        .post("/post")
        .set("Authorization", `Bearer ${token}`)
        .field("title", "Social Test Post")
        .field("content", "A post for testing social features")
        .attach("images", testImageBuffer, "test.png");

describe("Social Features Tests", () => {
    let accessToken: string;
    let accessToken2: string;
    let userId: string;
    let userId2: string;

    beforeAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        await mongoose.connect(testDbUrl);
    });

    beforeEach(async () => {
        await UserModel.deleteMany({});
        await PostModel.deleteMany({});

        const res1 = await request(app).post("/auth/register").send(testUser);
        accessToken = res1.body.accessToken || res1.body.token;
        const user1 = await UserModel.findOne({ email: testUser.email });
        userId = user1?._id.toString() || "";

        const res2 = await request(app).post("/auth/register").send(testUser2);
        accessToken2 = res2.body.accessToken || res2.body.token;
        const user2 = await UserModel.findOne({ email: testUser2.email });
        userId2 = user2?._id.toString() || "";
    });

    afterAll(async () => {
        await UserModel.deleteMany({});
        await PostModel.deleteMany({});
        await mongoose.connection.close();
    });

    // ==================== LIKE TOGGLE TESTS ====================

    describe("PATCH /post/:id/like", () => {
        test("Should add a like to a post", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            const response = await request(app)
                .patch(`/post/${postId}/like`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.likes).toContain(userId);
            expect(response.body.likes.length).toBe(1);
        });

        test("Should remove like when clicking twice (toggle off)", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            await request(app)
                .patch(`/post/${postId}/like`)
                .set("Authorization", `Bearer ${accessToken}`);

            const response = await request(app)
                .patch(`/post/${postId}/like`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.likes).not.toContain(userId);
            expect(response.body.likes.length).toBe(0);
        });

        test("Should not duplicate likes from the same user", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            await PostModel.findByIdAndUpdate(postId, { $addToSet: { likes: userId } });

            const response = await request(app)
                .patch(`/post/${postId}/like`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            const likeCount = response.body.likes.filter((id: string) => id === userId).length;
            expect(likeCount).toBeLessThanOrEqual(1);
        });

        test("Should allow multiple users to like the same post", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            await request(app)
                .patch(`/post/${postId}/like`)
                .set("Authorization", `Bearer ${accessToken}`);

            const response = await request(app)
                .patch(`/post/${postId}/like`)
                .set("Authorization", `Bearer ${accessToken2}`);

            expect(response.status).toBe(200);
            expect(response.body.likes).toContain(userId);
            expect(response.body.likes).toContain(userId2);
            expect(response.body.likes.length).toBe(2);
        });

        test("Should return 404 for non-existent post", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .patch(`/post/${fakeId}/like`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(404);
        });

        test("Should return 401 without authentication", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            const response = await request(app)
                .patch(`/post/${postId}/like`);

            expect(response.status).toBe(401);
        });
    });

    // ==================== COMMENT TESTS ====================

    describe("POST /post/:id/comment", () => {
        test("Should add a comment to a post", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            const response = await request(app)
                .post(`/post/${postId}/comment`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ text: "Great trip!" });

            expect(response.status).toBe(201);
            expect(response.body.comments.length).toBe(1);
            expect(response.body.comments[0].text).toBe("Great trip!");
            expect(response.body.comments[0].userId).toBe(userId);
            expect(response.body.comments[0].username).toBe(testUser.username);
            expect(response.body.comments[0]).toHaveProperty("createdAt");
        });

        test("Should reject empty string comments", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            const response = await request(app)
                .post(`/post/${postId}/comment`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ text: "" });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Comment text cannot be empty");
        });

        test("Should reject whitespace-only comments", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            const response = await request(app)
                .post(`/post/${postId}/comment`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ text: "   " });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Comment text cannot be empty");
        });

        test("Should reject missing text field", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            const response = await request(app)
                .post(`/post/${postId}/comment`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Comment text cannot be empty");
        });

        test("Should allow multiple comments on the same post", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            await request(app)
                .post(`/post/${postId}/comment`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ text: "First comment" });

            const response = await request(app)
                .post(`/post/${postId}/comment`)
                .set("Authorization", `Bearer ${accessToken2}`)
                .send({ text: "Second comment" });

            expect(response.status).toBe(201);
            expect(response.body.comments.length).toBe(2);
            expect(response.body.comments[0].text).toBe("First comment");
            expect(response.body.comments[1].text).toBe("Second comment");
        });

        test("Should trim comment text", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            const response = await request(app)
                .post(`/post/${postId}/comment`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ text: "  Trimmed comment  " });

            expect(response.status).toBe(201);
            expect(response.body.comments[0].text).toBe("Trimmed comment");
        });

        test("Should return 404 for non-existent post", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .post(`/post/${fakeId}/comment`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ text: "Comment on nothing" });

            expect(response.status).toBe(404);
        });

        test("Should return 401 without authentication", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            const response = await request(app)
                .post(`/post/${postId}/comment`)
                .send({ text: "Unauthenticated comment" });

            expect(response.status).toBe(401);
        });
    });

    // ==================== INTEGRATION TESTS ====================

    describe("Social Features Integration", () => {
        test("Like and comment should coexist on the same post", async () => {
            const postRes = await createTestPost(accessToken);
            const postId = postRes.body._id;

            await request(app)
                .patch(`/post/${postId}/like`)
                .set("Authorization", `Bearer ${accessToken}`);

            const commentRes = await request(app)
                .post(`/post/${postId}/comment`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ text: "Liked and commented!" });

            expect(commentRes.status).toBe(201);
            expect(commentRes.body.likes).toContain(userId);
            expect(commentRes.body.comments.length).toBe(1);
        });

        test("New post should have empty likes and comments", async () => {
            const postRes = await createTestPost(accessToken);

            expect(postRes.body.likes).toEqual([]);
            expect(postRes.body.comments).toEqual([]);
        });
    });
});
