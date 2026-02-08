import { Request, Response } from "express";
import BaseController from "./base_controller";
import PostModel, { IPost } from "../models/post_model";
import { generateEmbeddings, cosineSimilarity } from "../services/ai_service";

declare global {
    namespace Express {
        interface Request {
            user?: { _id: string; [key: string]: any };
        }
    }
}

class PostController extends BaseController<IPost> {
    constructor() {
        super(PostModel);
        this.post = this.post.bind(this);
        this.smartSearch = this.smartSearch.bind(this);
    }

    async updateItem(req: Request, res: Response): Promise<void> {
        try {
            const { content, description } = req.body;
            if (!content && description) {
                req.body.content = description;
            }

            if (req.body.content) {
                const vector = await generateEmbeddings(req.body.content);
                req.body.vector = vector;
            }

            const updatedObj = await this.model.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true }
            );

            if (updatedObj) res.status(200).send(updatedObj);
            else res.status(404).send("Not found");
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }

    /**
     * Override the create method to include AI Analysis.
     * When a post is saved, it automatically generates a vector embedding.
     */
    async post(req: Request, res: Response): Promise<void> {
        try {
            const { content, description } = req.body;
            if (!content && description) {
                req.body.content = description;
            }

            const textToEmbed = req.body.content || description;
            const vector = textToEmbed ? await generateEmbeddings(textToEmbed) : [];
            
            // Add the sender ID from the authenticated user
            const authUserId = (req as any).userId || req.user?._id;
            if (authUserId) {
                req.body.userId = authUserId;
            }

            // Save the post to MongoDB
            const files = (req as any).files as Express.Multer.File[] | undefined;
            const images = files?.map((file) => `/uploads/posts/${file.filename}`) || [];

            if (images.length === 0) {
                res.status(400).send("At least one image is required");
                return;
            }

            const item = await this.model.create({
                title: req.body.title,
                content: req.body.content,
                images,
                userId: req.body.userId,
                vector
            });
            if (vector.length > 0 && (!item.vector || item.vector.length === 0)) {
                await this.model.updateOne({ _id: item._id }, { $set: { vector } });
                const refreshed = await this.model.findById(item._id);
                if (refreshed) {
                    res.status(201).send(refreshed);
                    return;
                }
            }
            res.status(201).send(item);
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }

    /**
     * AI Smart Search (RAG Logic)
     * Finds posts by meaning using Cosine Similarity.
     */
    async smartSearch(req: Request, res: Response): Promise<void> {
        const query = req.query.q as string;
        if (!query) {
            res.status(400).send("Search query is required.");
            return;
        }

        try {
            // 1. Convert user search text into a vector
            const queryVector = await generateEmbeddings(query);

            // 2. Fetch all posts to compare vectors (Local MongoDB limitation)
            const allPosts = await this.model.find();

            // 3. Rank and filter by AI similarity
            const rankedPosts = allPosts
                .map((post: any) => ({
                    ...post.toObject(),
                    similarity: cosineSimilarity(queryVector, post.vector || [])
                }))
                .filter(post => post.similarity > 0.7) // Only return relevant matches
                .sort((a, b) => b.similarity - a.similarity);

            res.status(200).send(rankedPosts);
        } catch (error) {
            res.status(500).send("AI Search failed. Please check your API key.");
        }
    }

    /**
     * Get All Posts with optional userId filtering.
     */
    async getAll(req: Request, res: Response): Promise<void> {
        const userIdFilter = req.query.userId as string | undefined;
        try {
            if (userIdFilter) {
                // Return only posts for a specific user profile
                const posts = await this.model.find({ userId: userIdFilter });
                res.status(200).send(posts);
            } else {
                // Standard Get All for the main feed
                super.getAll(req, res);
            }
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }
}

export default new PostController();