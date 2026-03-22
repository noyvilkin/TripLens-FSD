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
                return { generateContent: generateContentMock };
            })
        }))
    };
});

import { generateEmbeddings, cosineSimilarity, generateImageSemanticContext, generateRAGAnswer } from "../services/ai_service";

describe("AI Service", () => {
    beforeEach(() => {
        embedContentMock.mockReset();
        generateContentMock.mockReset();
        process.env.GEMINI_API_KEY = "test-key";
    });

    describe("generateEmbeddings", () => {
        test("returns empty array for blank input", async () => {
            const result = await generateEmbeddings("   ");
            expect(result).toEqual([]);
            expect(embedContentMock).not.toHaveBeenCalled();
        });

        test("chunks long text and averages embeddings", async () => {
            embedContentMock
                .mockResolvedValueOnce({ embedding: { values: [1, 1] } })
                .mockResolvedValueOnce({ embedding: { values: [3, 3] } })
                .mockResolvedValueOnce({ embedding: { values: [5, 5] } });

            const longText = "a".repeat(2501); // 3 chunks with chunkSize 1000
            const result = await generateEmbeddings(longText);

            expect(embedContentMock).toHaveBeenCalledTimes(3);
            expect(result).toEqual([3, 3]);
        });

        test("returns empty array when embedding fails", async () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            embedContentMock.mockRejectedValueOnce(new Error("fail"));

            const result = await generateEmbeddings("hello");

            expect(result).toEqual([]);
            consoleSpy.mockRestore();
        });

        test("returns empty array and warns when API key is missing", async () => {
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            process.env.GEMINI_API_KEY = "";

            const result = await generateEmbeddings("hello");

            expect(result).toEqual([]);
            expect(embedContentMock).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    describe("generateImageSemanticContext", () => {
        test("returns empty string for empty image array", async () => {
            const result = await generateImageSemanticContext([]);
            expect(result).toBe("");
            expect(generateContentMock).not.toHaveBeenCalled();
        });

        test("returns empty string when API key is missing", async () => {
            process.env.GEMINI_API_KEY = "";
            const result = await generateImageSemanticContext([
                { mimeType: "image/jpeg", data: Buffer.from("abc") },
            ]);
            expect(result).toBe("");
            expect(generateContentMock).not.toHaveBeenCalled();
        });

        test("returns semantic text from model", async () => {
            generateContentMock.mockResolvedValueOnce({
                response: { text: () => "sunny, beach, coastline" },
            });

            const result = await generateImageSemanticContext([
                { mimeType: "image/jpeg", data: Buffer.from("abc") },
            ]);

            expect(result).toContain("sunny");
            expect(generateContentMock).toHaveBeenCalledTimes(1);
        });

        test("returns empty string when model call fails", async () => {
            const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            generateContentMock.mockRejectedValueOnce(new Error("vision failed"));

            const result = await generateImageSemanticContext([
                { mimeType: "image/jpeg", data: Buffer.from("abc") },
            ]);

            expect(result).toBe("");
            errorSpy.mockRestore();
        });
    });

    describe("generateRAGAnswer", () => {
        test("throws when API key is missing", async () => {
            process.env.GEMINI_API_KEY = "";
            await expect(generateRAGAnswer("where is sunny", ["Trip context"]))
                .rejects
                .toThrow("GEMINI_API_KEY is not configured");
        });

        test("returns generated answer text", async () => {
            generateContentMock.mockResolvedValueOnce({
                response: { text: () => "Try Eilat for sunshine." },
            });

            const result = await generateRAGAnswer("where is sunny", ["Title: Eilat\nContent: sunny beach"]);

            expect(result).toBe("Try Eilat for sunshine.");
            expect(generateContentMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("cosineSimilarity", () => {
        test("returns 0 for empty vectors", () => {
            expect(cosineSimilarity([], [])).toBe(0);
        });

        test("handles mismatched lengths", () => {
            expect(cosineSimilarity([1, 0], [1])).toBe(1);
        });

        test("returns 0 when magnitude is zero", () => {
            expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
        });
    });
});
