import { Request, Response } from "express";
import BaseController from "./base_controller";
import PostModel, { IPost } from "../models/post_model";
import UserModel from "../models/user_model";
import fs from "fs/promises";
import { generateEmbeddings, cosineSimilarity, generateImageSemanticContext, ImageEmbeddingInput } from "../services/ai_service";

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
        this.toggleLike = this.toggleLike.bind(this);
        this.addComment = this.addComment.bind(this);
    }

    private async buildImageInputs(files: Express.Multer.File[]): Promise<ImageEmbeddingInput[]> {
        const inputs = await Promise.all(
            files.slice(0, 3).map(async (file) => {
                try {
                    const data = await fs.readFile(file.path);
                    return {
                        mimeType: file.mimetype,
                        data,
                    } as ImageEmbeddingInput;
                } catch {
                    return null;
                }
            })
        );

        return inputs.filter((input): input is ImageEmbeddingInput => input !== null);
    }

    async updateItem(req: Request, res: Response): Promise<void> {
        try {
            const { content, description } = req.body;
            if (!content && description) {
                req.body.content = description;
            }

            if (req.body.content || req.body.title) {
                const textToEmbed = [req.body.title, req.body.content].filter(Boolean).join(" - ");
                const vector = await generateEmbeddings(textToEmbed);
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

            const imageInputs = await this.buildImageInputs(files || []);
            const imageContext = await generateImageSemanticContext(imageInputs);

            const textToEmbed = [
                req.body.title,
                req.body.content || description,
                imageContext ? `Image context: ${imageContext}` : "",
            ]
                .filter(Boolean)
                .join(" - ");
            const vector = textToEmbed ? await generateEmbeddings(textToEmbed) : [];

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

    async toggleLike(req: Request, res: Response): Promise<void> {
        try {
            const postId = req.params.id;
            const userId = (req as any).userId || req.user?._id;
            if (!userId) {
                res.status(401).json({ error: "User ID is required" });
                return;
            }

            const post = await this.model.findById(postId);
            if (!post) {
                res.status(404).json({ error: "Post not found" });
                return;
            }

            const alreadyLiked = post.likes.includes(userId);
            const update = alreadyLiked
                ? { $pull: { likes: userId } }
                : { $addToSet: { likes: userId } };

            const updated = await this.model.findByIdAndUpdate(postId, update, { new: true })
                .populate("userId", "username profilePic");

            if (updated) res.status(200).json(updated);
            else res.status(404).json({ error: "Post not found" });
        } catch (error) {
            res.status(400).json({ error: (error as Error).message });
        }
    }

    async addComment(req: Request, res: Response): Promise<void> {
        try {
            const postId = req.params.id;
            const userId = (req as any).userId || req.user?._id;
            if (!userId) {
                res.status(401).json({ error: "User ID is required" });
                return;
            }

            const { text } = req.body;
            if (!text || typeof text !== "string" || text.trim().length === 0) {
                res.status(400).json({ error: "Comment text cannot be empty" });
                return;
            }

            const user = await UserModel.findById(userId);
            if (!user) {
                res.status(404).json({ error: "User not found" });
                return;
            }

            const comment = {
                userId,
                username: user.username,
                text: text.trim(),
                createdAt: new Date()
            };

            const updated = await this.model.findByIdAndUpdate(
                postId,
                { $push: { comments: comment } },
                { new: true }
            ).populate("userId", "username profilePic");

            if (updated) res.status(201).json(updated);
            else res.status(404).json({ error: "Post not found" });
        } catch (error) {
            res.status(400).json({ error: (error as Error).message });
        }
    }

    /**
     * Get All Posts with offset pagination and optional userId filtering.
     * Returns { posts, totalPages, currentPage }.
     */
    async getAll(req: Request, res: Response): Promise<void> {
        const userIdFilter = req.query.userId as string | undefined;
        const defaultLimit = parseInt(process.env.DEFAULT_PAGE_LIMIT || "10", 10);
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || defaultLimit));

        try {
            const filter = userIdFilter ? { userId: userIdFilter } : {};
            const totalPosts = await this.model.countDocuments(filter);
            const totalPages = Math.ceil(totalPosts / limit) || 1;

            const posts = await this.model
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("userId", "username profilePic");

            res.status(200).json({
                posts,
                totalPages,
                currentPage: page,
            });
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }
}

export default new PostController();