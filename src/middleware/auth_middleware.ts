import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    userId?: string;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.status(401).json({ error: "Access denied. No token provided." });
        return;
    }

    // Expected format: "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        res.status(401).json({ error: "Access denied. Invalid token format." });
        return;
    }

    const token = parts[1];

    try {
        const secret = process.env.JWT_SECRET || "secretkey";
        const decoded = jwt.verify(token, secret) as { userId: string };
        req.userId = decoded.userId;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: "Access denied. Token expired." });
        } else {
            res.status(401).json({ error: "Access denied. Invalid token." });
        }
    }
};

export default authMiddleware;

