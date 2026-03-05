import { Request, Response } from "express";
import { generateEmbeddings, generateRAGAnswer, cosineSimilarity } from "../services/ai_service";
import PostModel from "../models/post_model";
import { SmartSearchResponse, Trip } from "../types/trip";

const findSimilarTrips = async (queryVector: number[], limit: number = 3): Promise<Trip[]> => {
    const allPosts = await PostModel.find();

    return allPosts
        .map((post) => {
            const doc = post.toObject() as unknown as Record<string, unknown>;
            return {
                _id: String(doc._id),
                title: doc.title,
                content: doc.content,
                images: doc.images,
                userId: String(doc.userId),
                vector: doc.vector,
                score: cosineSimilarity(queryVector, (doc.vector as number[]) || []),
                createdAt: doc.createdAt ? String(doc.createdAt) : undefined,
                updatedAt: doc.updatedAt ? String(doc.updatedAt) : undefined,
            } as Trip;
        })
        .filter((t) => (t.score ?? 0) > 0.5)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit);
};

export const smartSearch = async (req: Request, res: Response): Promise<void> => {
    const { query } = req.body;

    if (!query || typeof query !== "string" || !query.trim()) {
        res.status(400).json({ error: "Search query is required." });
        return;
    }

    try {
        const queryVector = await generateEmbeddings(query.trim());

        if (queryVector.length === 0) {
            res.status(500).json({ error: "Failed to generate query embedding." });
            return;
        }

        const sources = await findSimilarTrips(queryVector, 3);

        if (sources.length === 0) {
            const response: SmartSearchResponse = {
                answer:
                    "I couldn't find any relevant trips matching your query. " +
                    "Try rephrasing or broadening your search.",
                sources: [],
            };
            res.status(200).json(response);
            return;
        }

        const tripContexts = sources.map(
            (trip) => `Title: ${trip.title}\nContent: ${trip.content}`
        );

        const answer = await generateRAGAnswer(query.trim(), tripContexts);

        const sanitizedSources = sources.map(({ vector: _v, ...rest }) => rest);

        const response: SmartSearchResponse = {
            answer,
            sources: sanitizedSources,
        };
        res.status(200).json(response);
    } catch (error) {
        console.error("Smart search error:", error);
        res.status(500).json({ error: "Smart search failed. Please try again." });
    }
};
