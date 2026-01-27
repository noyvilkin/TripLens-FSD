import { Request, Response } from "express";
import BaseController from "./base_controller";
import UserModel, { IUser } from "../models/user_model";

class UserController extends BaseController<IUser> {
    constructor() {
        super(UserModel);
        // Bind the custom method to ensure 'this' context is preserved
        this.getByUsername = this.getByUsername.bind(this);
    }

    // Override getAll to handle optional email filter
    async getAll(req: Request, res: Response): Promise<void> {
        const emailFilter = req.query.email as string | undefined;
        try {
            if (emailFilter) {
                // If email query exists: /user?email=example@mail.com
                const users = await this.model.find({ email: emailFilter });
                res.status(200).send(users);
            } else {
                // Standard Get All: /user
                super.getAll(req, res);
            }
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }

    // Get user by username
    async getByUsername(req: Request, res: Response): Promise<void> {
        try {
            const user = await this.model.findOne({ username: req.params.username });
            if (user) res.status(200).send(user);
            else res.status(404).send("User not found");
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }
}

export default new UserController();