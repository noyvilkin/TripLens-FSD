import { Request, Response } from "express";
import BaseController from "./base_controller";
import PostModel, { IPost } from "../models/post_model";

class PostController extends BaseController<IPost> {
    constructor() {
        super(PostModel);
    }

    // Override or extend getAll to handle ?userId=<user_id>
    async getAll(req: Request, res: Response): Promise<void> {
        const userIdFilter = req.query.userId as string | undefined;
        try {
            if (userIdFilter) {
                // If userId query exists: /post?userId=123
                const posts = await this.model.find({ userId: userIdFilter });
                res.status(200).send(posts);
            } else {
                // Standard Get All: /post
                super.getAll(req, res);
            }
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }
}

export default new PostController();
