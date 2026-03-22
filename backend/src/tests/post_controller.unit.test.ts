import { Request, Response } from "express";

const mockFind = jest.fn();
const mockFindById = jest.fn();

jest.mock("../models/post_model", () => ({
    __esModule: true,
    default: {
        find: (...args: unknown[]) => mockFind(...args),
        findById: (...args: unknown[]) => mockFindById(...args),
        findByIdAndUpdate: jest.fn(),
        countDocuments: jest.fn(),
        updateOne: jest.fn(),
        create: jest.fn(),
    },
}));

jest.mock("../models/user_model", () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
    },
}));

const mockGenerateEmbeddings = jest.fn();
const mockCosineSimilarity = jest.fn();
const mockGenerateImageSemanticContext = jest.fn();

jest.mock("../services/ai_service", () => ({
    generateEmbeddings: (...args: unknown[]) => mockGenerateEmbeddings(...args),
    cosineSimilarity: (...args: unknown[]) => mockCosineSimilarity(...args),
    generateImageSemanticContext: (...args: unknown[]) => mockGenerateImageSemanticContext(...args),
}));

import postController from "../controllers/post_controller";

const createMockRes = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    return res;
};

describe("Post Controller Unit", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("smartSearch returns 400 when query is missing", async () => {
        const req = { query: {} } as unknown as Request;
        const res = createMockRes();

        await postController.smartSearch(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith("Search query is required.");
    });

    test("smartSearch returns ranked posts on success", async () => {
        mockGenerateEmbeddings.mockResolvedValueOnce([1, 0]);
        mockFind.mockResolvedValueOnce([
            { toObject: () => ({ title: "A", vector: [1, 0] }) },
            { toObject: () => ({ title: "B", vector: [0, 1] }) },
        ]);
        mockCosineSimilarity
            .mockReturnValueOnce(0.95)
            .mockReturnValueOnce(0.2);

        const req = { query: { q: "sunny" } } as unknown as Request;
        const res = createMockRes();

        await postController.smartSearch(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ title: "A", similarity: 0.95 }),
            ])
        );
    });

    test("smartSearch returns 500 when AI search fails", async () => {
        mockGenerateEmbeddings.mockRejectedValueOnce(new Error("boom"));

        const req = { query: { q: "sunny" } } as unknown as Request;
        const res = createMockRes();

        await postController.smartSearch(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith("AI Search failed. Please check your API key.");
    });

    test("toggleLike returns 401 when user is missing", async () => {
        const req = { params: { id: "post1" } } as unknown as Request;
        const res = createMockRes();

        await postController.toggleLike(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "User ID is required" });
    });

    test("toggleLike returns 404 when post is missing", async () => {
        mockFindById.mockResolvedValueOnce(null);

        const req = {
            params: { id: "post1" },
            user: { _id: "user1" },
        } as unknown as Request;
        const res = createMockRes();

        await postController.toggleLike(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Post not found" });
    });
});
