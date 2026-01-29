import { Request, Response } from "express";
import BaseController from "./base_controller";
import CommentModel, { ICommentDocument } from "../models/comment_model";

interface CommentQuery {
    postId?: string;
    userId?: string;
}

class CommentController extends BaseController<ICommentDocument> {
    constructor() {
        super(CommentModel);
    }

    // Override getAll to handle ?postId=<post_id> and ?userId=<user_id>
    async getAll(req: Request, res: Response): Promise<void> {
        const { postId, userId } = req.query as CommentQuery;
        try {
            // Build filter object based on query parameters
            const filter: Partial<CommentQuery> = {};
            if (postId) filter.postId = postId;
            if (userId) filter.userId = userId;

            // If there are filters, use them; otherwise get all comments
            if (Object.keys(filter).length > 0) {
                const comments = await this.model.find(filter);
                res.status(200).send(comments);
            } else {
                // Get all comments
                super.getAll(req, res);
            }
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }
}

export default new CommentController();

