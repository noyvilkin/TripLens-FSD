let embedContentMock: jest.Mock;

jest.mock("@google/generative-ai", () => {
    embedContentMock = jest.fn();
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                embedContent: embedContentMock
            })
        }))
    };
});

import { generateEmbeddings, cosineSimilarity } from "../services/ai_service";

describe("AI Service", () => {
    beforeEach(() => {
        embedContentMock.mockReset();
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
