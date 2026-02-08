import { GoogleGenerativeAI } from "@google/generative-ai";

let cachedModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

const getEmbeddingModel = () => {
    if (cachedModel) return cachedModel;
    const apiKey = process.env.GEMINI_API_KEY || "";
    const genAI = new GoogleGenerativeAI(apiKey);
    cachedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    return cachedModel;
};

export const generateEmbeddings = async (text: string): Promise<number[]> => {
    try {
        if (!text || !text.trim()) return [];



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

// Helper for Smart Search: Calculate similarity locally since using Local MongoDB
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