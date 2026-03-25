import { GoogleGenerativeAI } from "@google/generative-ai";

let cachedEmbeddingModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;
let cachedGenAI: GoogleGenerativeAI | null = null;

const getGenAI = (): GoogleGenerativeAI => {
    if (cachedGenAI) return cachedGenAI;
    const apiKey = process.env.GEMINI_API_KEY || "";
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    return cachedGenAI;
};

const getEmbeddingModel = () => {
    if (cachedEmbeddingModel) return cachedEmbeddingModel;
    cachedEmbeddingModel = getGenAI().getGenerativeModel({ model: "gemini-embedding-001" });
    return cachedEmbeddingModel;
};

export interface ImageEmbeddingInput {
    mimeType: string;
    data: Buffer;
}

export const generateImageSemanticContext = async (images: ImageEmbeddingInput[]): Promise<string> => {
    try {
        if (!images.length) return "";

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || !apiKey.trim()) {
            return "";
        }

        const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
        const limitedImages = images.slice(0, 3);

        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
            {
                text:
                    "Analyze these trip photos and return concise travel-relevant clues. " +
                    "Focus on weather, setting, activity, and landscape keywords. " +
                    "Return one short line with comma-separated tags.",
            },
            ...limitedImages.map((image) => ({
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.data.toString("base64"),
                },
            })),
        ];

        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
        });

        const text = result.response.text().trim();
        if (!text) return "";
        return text.slice(0, 400);
    } catch (error) {
        console.error("Image semantic context generation error:", error);
        return "";
    }
};

export const generateEmbeddings = async (text: string): Promise<number[]> => {
    try {
        if (!text || !text.trim()) return [];

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || !apiKey.trim()) {
            console.warn("GEMINI_API_KEY not found in environment variables. Skipping embedding generation.");
            return [];
        }

        // Chunking: split long text into manageable pieces to preserve context.
        // Using ~1000 chars per chunk to stay within token limits safely.
        const chunkSize = 1000;
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }

        const embeddings: number[][] = [];
        for (const chunk of chunks) {
            const result = await getEmbeddingModel().embedContent(chunk);
            embeddings.push(result.embedding.values);
        }

        if (embeddings.length === 0) return [];

        // Average embeddings across chunks to create a single vector
        const vectorLength = embeddings[0].length;
        const summed = new Array(vectorLength).fill(0);
        for (const vec of embeddings) {
            for (let i = 0; i < vectorLength; i += 1) {
                summed[i] += vec[i] || 0;
            }
        }
        return summed.map((value) => value / embeddings.length);
    } catch (error) {
        console.error("Gemini Embedding Error:", error);
        return [];
    }
};

// Helper for Smart Search: Calculate similarity locally as fallback
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (!vecA.length || !vecB.length) return 0;

    const length = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < length; i += 1) {
        const a = vecA[i] || 0;
        const b = vecB[i] || 0;
        dotProduct += a * b;
        magA += a * a;
        magB += b * b;
    }

    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
};

const RAG_SYSTEM_PROMPT =
    "You are TripLens — a friendly travel assistant helping users discover community trips.\n\n" +
    "Rules:\n" +
    "- Keep answers short and conversational (2-4 sentences).\n" +
    "- Never use markdown bold (**text**) or any heading-style formatting.\n" +
    "- Do not force trip titles into your answer. Mention them only if it flows naturally.\n" +
    "- Focus on why a trip matches the user's intent — highlight experiences, scenery, or activities.\n" +
    "- When several trips fit, briefly compare them so the user can pick.\n" +
    "- If nothing matches, say so honestly and suggest broadening the search.";

export const generateRAGAnswer = async (
    query: string,
    tripContexts: string[]
): Promise<string> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });

    const contextBlock = tripContexts
        .map((ctx, i) => `--- Trip ${i + 1} ---\n${ctx}`)
        .join("\n\n");

    const result = await model.generateContent({
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: `${RAG_SYSTEM_PROMPT}\n\nTrip Context:\n${contextBlock}\n\nUser Question: ${query}`,
                    },
                ],
            },
        ],
    });

    return result.response.text();
};