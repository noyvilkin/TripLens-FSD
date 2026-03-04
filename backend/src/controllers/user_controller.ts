import { Request, Response } from "express";
import BaseController from "./base_controller";
import UserModel, { IUser } from "../models/user_model";

class UserController extends BaseController<IUser> {
    constructor() {
        super(UserModel);
        // Bind the custom methods to ensure 'this' context is preserved
        this.getByUsername = this.getByUsername.bind(this);
        this.getPublicProfile = this.getPublicProfile.bind(this);
        this.updateProfile = this.updateProfile.bind(this);
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

    // Get public profile - return safe user data
    async getPublicProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.params.userId;
            const user = await this.model.findById(userId);
            
            if (!user) {
                res.status(404).send("User not found");
                return;
            }

            // Return only public profile data
            const publicProfile = {
                id: user._id,
                username: user.username,
                profilePic: user.profilePic,
                createdAt: user.createdAt
            };

            res.status(200).send(publicProfile);
        } catch (error) {
            res.status(400).send((error as Error).message);
        }
    }

    // Update user profile (authenticated user only)
    async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.params.userId;
            const authenticatedUserId = (req as any).userId;

            // Check if user exists first
            const existingUser = await this.model.findById(userId);
            if (!existingUser) {
                res.status(404).send("User not found");
                return;
            }

            // Authorization check: user can only update their own profile
            if (authenticatedUserId !== userId) {
                res.status(403).send("Unauthorized: You can only edit your own profile");
                return;
            }

            const { username } = req.body;
            const file = (req as any).file;

            // Build update object - only allow username and profilePic
            const updateData: any = {};

            // Validate and update username if provided
            if (username) {
                if (typeof username !== "string") {
                    res.status(400).send("Username must be a string");
                    return;
                }
                if (username.length < 3 || username.length > 30) {
                    res.status(400).send("Username must be between 3 and 30 characters");
                    return;
                }
                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                    res.status(400).send("Username can only contain alphanumeric characters and underscores");
                    return;
                }
                
                // Check if username already exists (case insensitive)
                if (username !== existingUser.username) {
                    const duplicateUser = await this.model.findOne({ 
                        username: { $regex: new RegExp(`^${username}$`, 'i') }
                    });
                    if (duplicateUser && duplicateUser._id.toString() !== userId) {
                        res.status(409).send("Username already taken");
                        return;
                    }
                }
                
                updateData.username = username;
            }

            // Update profilePic if file is provided
            if (file) {
                // In test mode with memory storage, simulate a filename
                if (process.env.NODE_ENV === "test" && !file.filename) {
                    const timestamp = Date.now();
                    const ext = file.originalname ? file.originalname.split('.').pop() : 'png';
                    updateData.profilePic = `/uploads/profiles/${userId}-${timestamp}.${ext}`;
                } else {
                    updateData.profilePic = `/uploads/profiles/${file.filename}`;
                }
            }
            
            // Handle explicit photo removal (empty string means remove)
            if (req.body.profileImage === '') {
                updateData.profilePic = '';
            }

            // If no updates provided
            if (Object.keys(updateData).length === 0) {
                res.status(400).send("No valid fields to update");
                return;
            }

            // Update user
            const updatedUser = await this.model.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, runValidators: true }
            );

            if (!updatedUser) {
                res.status(404).send("User not found");
                return;
            }

            // Return updated profile
            const publicProfile = {
                id: updatedUser._id,
                username: updatedUser.username,
                profilePic: updatedUser.profilePic,
                updatedAt: updatedUser.updatedAt
            };

            res.status(200).send(publicProfile);
        } catch (error) {
            if ((error as Error).message.includes("duplicate key")) {
                res.status(409).send("Username already taken");
            } else {
                res.status(400).send((error as Error).message);
            }
        }
    }
}

export default new UserController();