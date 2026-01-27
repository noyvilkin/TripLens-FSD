import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel from "../models/user_model";

const sendError = (res: Response, message: string, code?: number) => {
    const errCode = code || 400;
    res.status(errCode).json({ error: message });
}

const getSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET environment variable is not defined");
    }
    return secret;
};

type Tokens = {
    token: string;
    refreshToken: string;
}

const generateToken = (userId: string): Tokens => {
    const secret: string = getSecret();
    const exp: number = parseInt(process.env.JWT_EXPIRES_IN || "3600"); // 1 hour
    const refreshexp: number = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || "86400"); // 24 hours
    const token = jwt.sign(
        { userId: userId, timestamp: Date.now() },
        secret,
        { expiresIn: exp }
    );
    const refreshToken = jwt.sign(
        { userId: userId, timestamp: Date.now() + 1 },
        secret,
        { expiresIn: refreshexp }
    );
    return { token, refreshToken };
}

class AuthController {
    // Register a new user
    async register(req: Request, res: Response): Promise<void> {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return sendError(res, "Username, email and password are required", 401);
        }

        try {
            // Check if user already exists
            const existingUser = await UserModel.findOne({ 
                $or: [{ email }, { username }] 
            });
            
            if (existingUser) {
                return sendError(res, "User with this email or username already exists", 409);
            }

            const salt = await bcrypt.genSalt(10);
            const encryptedPassword = await bcrypt.hash(password, salt);
            
            // Create user first without refresh token
            const user = await UserModel.create({ 
                username,
                email, 
                password: encryptedPassword,
                refreshToken: []
            });

            // Generate JWT tokens with actual user ID
            const tokens = generateToken(user._id.toString());

            // Update user with refresh token using findByIdAndUpdate to avoid version conflicts
            await UserModel.findByIdAndUpdate(user._id, {
                refreshToken: [tokens.refreshToken]
            });

            // Send tokens back to user
            res.status(201).json(tokens);
        } catch (error) {
            return sendError(res, (error as Error).message || "Registration failed", 400);
        }
    }

    // Login user
    async login(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body;

        if (!email || !password) {
            return sendError(res, "Email and password are required");
        }

        try {
            const user = await UserModel.findOne({ email });
            if (!user) {
                return sendError(res, "Invalid email or password");
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return sendError(res, "Invalid email or password");
            }

            // Generate JWT tokens
            const tokens = generateToken(user._id.toString());

            user.refreshToken.push(tokens.refreshToken);
            await user.save();

            // Send tokens back to user
            res.status(200).json(tokens);
        } catch (error) {
            return sendError(res, "Login failed");
        }
    }

    // Refresh access token
    async refresh(req: Request, res: Response): Promise<void> {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return sendError(res, "Refresh token is required", 401);
        }

        try {
            const secret: string = getSecret();
            const decoded: any = jwt.verify(refreshToken, secret);

            const user = await UserModel.findById(decoded.userId);
            if (!user) {
                return sendError(res, "Invalid refresh token", 401);
            }

            if (!user.refreshToken.includes(refreshToken)) {
                // Remove all refresh tokens from user
                user.refreshToken = [];
                await user.save();
                return sendError(res, "Invalid refresh token", 401);
            }

            // Generate new tokens
            const tokens = generateToken(user._id.toString());
            
            // Remove old refresh token
            user.refreshToken = user.refreshToken.filter(rt => rt !== refreshToken);
            // Add new refresh token
            user.refreshToken.push(tokens.refreshToken);
            await user.save();

            res.status(200).json(tokens);
        } catch (error) {
            return sendError(res, "Invalid refresh token", 401);
        }
    }

    // Logout user
    async logout(req: Request, res: Response): Promise<void> {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return sendError(res, "Refresh token is required", 401);
        }

        try {
            const secret: string = getSecret();
            const decoded: any = jwt.verify(refreshToken, secret);

            const user = await UserModel.findById(decoded.userId);
            if (!user) {
                return sendError(res, "Invalid refresh token", 401);
            }

            // Check if the refresh token exists in user's tokens
            if (!user.refreshToken.includes(refreshToken)) {
                return sendError(res, "Invalid refresh token", 401);
            }

            // Remove the refresh token from user's tokens (invalidate it)
            user.refreshToken = user.refreshToken.filter(rt => rt !== refreshToken);
            await user.save();

            res.status(200).json({ message: "Logged out successfully" });
        } catch (error) {
            // Even if token is expired/invalid, try to remove it if possible
            if (error instanceof jwt.JsonWebTokenError) {
                return sendError(res, "Invalid refresh token", 401);
            }
            return sendError(res, "Logout failed", 500);
        }
    }
}

export default new AuthController();