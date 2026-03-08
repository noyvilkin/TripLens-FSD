let embedContentMock: jest.Mock;
let generateContentMock: jest.Mock;

jest.mock("@google/generative-ai", () => {
    embedContentMock = jest.fn();
    generateContentMock = jest.fn();
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockImplementation(({ model }: { model: string }) => {
                if (model === "gemini-embedding-001") {
                    return { embedContent: embedContentMock };
                }
                return {
                    generateContent: generateContentMock,
                };
            }),
        })),
    };
});

const mockFind = jest.fn();
jest.mock("../models/post_model", () => ({
    __esModule: true,
    default: { find: (...args: unknown[]) => mockFind(...args) },
}));

import { generateEmbeddings, generateRAGAnswer } from "../services/ai_service";
import { smartSearch } from "../controllers/search_controller";
import { Request, Response } from "express";
import { Trip } from "../types/trip";

const createMockRes = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    return res;
};

const createMockReq = (body: Record<string, unknown> = {}) =>
    ({ body } as Request);

const toMongooseDocs = (trips: Trip[]) =>
    trips.map((t) => ({
        toObject: () => ({ ...t }),
    }));

describe("Smart Search", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GEMINI_API_KEY = "test-key";
    });

    describe("generateEmbeddings", () => {
        test("vectorizes query text via gemini-embedding-001", async () => {
            embedContentMock.mockResolvedValueOnce({
                embedding: { values: [0.1, 0.2, 0.3] },
            });

            const result = await generateEmbeddings("sunny beaches");

            expect(embedContentMock).toHaveBeenCalledWith("sunny beaches");
            expect(result).toEqual([0.1, 0.2, 0.3]);
        });

        test("returns empty array for blank input", async () => {
            const result = await generateEmbeddings("   ");
            expect(result).toEqual([]);
            expect(embedContentMock).not.toHaveBeenCalled();
        });
    });

    describe("generateRAGAnswer", () => {
        test("passes trip contexts and query to Gemini", async () => {
            generateContentMock.mockResolvedValueOnce({
                response: { text: () => "Based on the trips, Eilat is sunny!" },
            });

            const contexts = [
                "Title: Eilat Trip\nContent: Beautiful sunny beaches in southern Israel",
                "Title: Tel Aviv\nContent: Mediterranean coast with warm weather",
                "Title: Dead Sea\nContent: Hottest place, very sunny year round",
            ];

            const answer = await generateRAGAnswer("Where is it sunny?", contexts);

            expect(answer).toBe("Based on the trips, Eilat is sunny!");
            expect(generateContentMock).toHaveBeenCalledTimes(1);

            const callArg = generateContentMock.mock.calls[0][0];
            const promptText = callArg.contents[0].parts[0].text;

            expect(promptText).toContain("Where is it sunny?");
            expect(promptText).toContain("Eilat Trip");
            expect(promptText).toContain("Tel Aviv");
            expect(promptText).toContain("Dead Sea");
            expect(promptText).toContain("travel assistant");
        });
    });

    describe("smartSearch controller", () => {
        const sampleTrips: Trip[] = [
            {
                _id: "id1",
                title: "Eilat Trip",
                content: "Sunny beaches in Eilat",
                images: ["/uploads/eilat.jpg"],
                userId: "user1",
                vector: [1, 0],
            },
            {
                _id: "id2",
                title: "Tel Aviv",
                content: "Mediterranean coast",
                images: ["/uploads/tlv.jpg"],
                userId: "user2",
                vector: [0.9, 0.1],
            },
            {
                _id: "id3",
                title: "Dead Sea",
                content: "Hottest place on earth",
                images: ["/uploads/deadsea.jpg"],
                userId: "user1",
                vector: [0.8, 0.2],
            },
        ];

        test("returns 400 when query is missing", async () => {
            const req = createMockReq({});
            const res = createMockRes();

            await smartSearch(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Search query is required.",
            });
        });

        test("returns 400 for empty string query", async () => {
            const req = createMockReq({ query: "   " });
            const res = createMockRes();

            await smartSearch(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("returns empty answer when no posts pass similarity threshold", async () => {
            embedContentMock.mockResolvedValueOnce({
                embedding: { values: [0, 1] },
            });
            mockFind.mockResolvedValueOnce(
                toMongooseDocs([{ ...sampleTrips[0], vector: [0, -1] }])
            );

            const req = createMockReq({ query: "nonexistent place" });
            const res = createMockRes();

            await smartSearch(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    sources: [],
                    answer: expect.stringContaining("couldn't find"),
                })
            );
        });

        test("combines 3 trip descriptions into the RAG prompt", async () => {
            embedContentMock.mockResolvedValueOnce({
                embedding: { values: [1, 0] },
            });
            mockFind.mockResolvedValueOnce(toMongooseDocs(sampleTrips));
            generateContentMock.mockResolvedValueOnce({
                response: { text: () => "Eilat has the sunniest weather." },
            });

            const req = createMockReq({ query: "Where is it sunny in Israel?" });
            const res = createMockRes();

            await smartSearch(req, res);

            const ragCall = generateContentMock.mock.calls[0][0];
            const prompt = ragCall.contents[0].parts[0].text;
            expect(prompt).toContain("Eilat Trip");
            expect(prompt).toContain("Tel Aviv");
            expect(prompt).toContain("Dead Sea");
            expect(prompt).toContain("Where is it sunny in Israel?");

            expect(res.status).toHaveBeenCalledWith(200);
            const responseData = (res.json as jest.Mock).mock.calls[0][0];
            expect(responseData.answer).toBe("Eilat has the sunniest weather.");
            expect(responseData.sources).toHaveLength(3);
        });

        test("strips vector field from source trips in the response", async () => {
            embedContentMock.mockResolvedValueOnce({
                embedding: { values: [1, 0] },
            });
            mockFind.mockResolvedValueOnce(toMongooseDocs(sampleTrips));
            generateContentMock.mockResolvedValueOnce({
                response: { text: () => "Answer" },
            });

            const req = createMockReq({ query: "test query" });
            const res = createMockRes();

            await smartSearch(req, res);

            const responseData = (res.json as jest.Mock).mock.calls[0][0];
            for (const source of responseData.sources) {
                expect(source).not.toHaveProperty("vector");
            }
        });

        test("returns 500 when embedding generation fails", async () => {
            embedContentMock.mockResolvedValueOnce({
                embedding: { values: [] },
            });

            const req = createMockReq({ query: "test" });
            const res = createMockRes();

            const consoleSpy = jest.spyOn(console, "error").mockImplementation();
            await smartSearch(req, res);
            consoleSpy.mockRestore();

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
