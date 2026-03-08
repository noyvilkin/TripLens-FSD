import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import UserModel, { DEFAULT_PROFILE_PIC } from "../models/user_model";

const sendError = (res: Response, message: string, code?: number) => {
    const errCode = code || 400;
    res.status(errCode).json({ error: message });
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * @swagger
 * components:
 * schemas:
 * AuthResponse:
 * type: object
 * properties:
 * accessToken:
 * type: string
 * description: The short-lived JWT access token
 */

const generateTokens = (userId: string) => {
    const tokenId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    const accessToken = jwt.sign(
        { userId }, 
        process.env.JWT_SECRET as string, 
        { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '15m' }
    );
    const refreshToken = jwt.sign(
        { userId, tokenId }, 
        process.env.JWT_REFRESH_SECRET as string, 
        { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) || '7d' }
    );
    return { accessToken, refreshToken };
}

class AuthController {
    /**
     * @swagger
     * /auth/register:
     * post:
     * summary: Register a new user
     * tags: [Auth]
     * requestBody:
     * required: true
     * content:
     * application/json:
     * schema:
     * type: object
     * properties:
     * username:
     * type: string
     * email:
     * type: string
     * password:
     * type: string
     * responses:
     * 201:
     * description: User registered successfully
     */
    async register(req: Request, res: Response) {
        try {
            const { username, email, password } = req.body;
            if (!username || !email || !password) return sendError(res, "Missing fields", 400);

            const existingUser = await UserModel.findOne({ $or: [{ email }, { username }] });
            if (existingUser) return sendError(res, "User already exists", 409);

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const user = await UserModel.create({
                username,
                email,
                password: hashedPassword,
                refreshToken: []
            });

            const { accessToken, refreshToken } = generateTokens(user._id.toString());
            user.refreshToken.push(refreshToken);
            await user.save();

            // Store refresh token in HttpOnly cookie for persistence
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.status(201).json({ accessToken });
        } catch (error) {
            sendError(res, "Registration failed");
        }
    }

    /**
     * @swagger
     * /auth/login:
     * post:
     * summary: Login user
     * tags: [Auth]
     */
    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            if (!email || !password) return sendError(res, "Email and password are required", 400);

            // Find user by email or username
            const user = await UserModel.findOne({ $or: [{ email }, { username: email }] });
            if (!user || !user.password) {
                return sendError(res, "Invalid credentials", 401);
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return sendError(res, "Invalid credentials", 401);
            }

            const { accessToken, refreshToken } = generateTokens(user._id.toString());
            user.refreshToken.push(refreshToken);
            await user.save();

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.status(200).json({ accessToken });
        } catch (error) {
            sendError(res, "Login failed");
        }
    }

    /**
     * @swagger
     * /auth/refresh:
     * post:
     * summary: Refresh access token
     * tags: [Auth]
     */
    async refresh(req: Request, res: Response) {
        const tokenFromCookie = req.cookies.refreshToken;
        if (!tokenFromCookie) return sendError(res, "No refresh token", 401);

        try {
            const decoded: any = jwt.verify(tokenFromCookie, process.env.JWT_REFRESH_SECRET!);
            const user = await UserModel.findById(decoded.userId);

            if (!user || !user.refreshToken.includes(tokenFromCookie)) {
                return sendError(res, "Invalid token", 401);
            }

            const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id.toString());
            
            user.refreshToken = user.refreshToken.filter(rt => rt !== tokenFromCookie);
            user.refreshToken.push(newRefreshToken);
            await user.save();

            res.cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.status(200).json({ accessToken });
        } catch (error) {
            sendError(res, "Session expired", 401);
        }
    }

    async googleLogin(req: Request, res: Response): Promise<void> {
        try {
            const { credential } = req.body;
            if (!credential) {
                res.status(400).json({ error: "Missing Google credential" });
                return;
            }

            if (!process.env.GOOGLE_CLIENT_ID) {
                console.error("GOOGLE_CLIENT_ID not configured");
                res.status(500).json({ error: "Server configuration error" });
                return;
            }

            // 1. validate token 
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                res.status(400).json({ error: "Invalid Google token" });
                return;
            }

            // 2. check if already exists
            let user = await UserModel.findOne({ email: payload.email });

            if (!user) {
                // if not, create new user 
                user = await UserModel.create({
                    username: payload.name || payload.email,
                    email: payload.email,
                    profilePic: DEFAULT_PROFILE_PIC,
                    refreshToken: []
                });
            }

            // 3. create tokens 
            const { accessToken, refreshToken } = generateTokens(user._id.toString());
            user.refreshToken.push(refreshToken);
            await user.save();

            // create refresh tokens
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.status(200).json({ accessToken });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Google login failed" });
        }
    }

    /**
     * @swagger
     * /auth/logout:
     * post:
     * summary: Logout user
     * tags: [Auth]
     */
    async logout(req: Request, res: Response) {
        const tokenFromCookie = req.cookies.refreshToken;
        if (!tokenFromCookie) return res.sendStatus(204);

        try {
            const decoded: any = jwt.verify(tokenFromCookie, process.env.JWT_REFRESH_SECRET!);
            const user = await UserModel.findById(decoded.userId);
            if (user) {
                user.refreshToken = user.refreshToken.filter(rt => rt !== tokenFromCookie);
                await user.save();
            }
        } catch (error) {
            // Proceed to clear cookie even if token is expired
        }

        res.clearCookie('refreshToken');
        return res.status(200).json({ message: "Logged out" });
    }
}

export default new AuthController();