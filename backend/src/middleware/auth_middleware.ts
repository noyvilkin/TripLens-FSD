import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    userId?: string;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    // Check for presence of header
    if (!authHeader) {
        res.status(401).json({ error: "Access denied. No token provided." });
        return;
    }

    // Validate "Bearer <token>" format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        res.status(401).json({ error: "Access denied. Invalid token format." });
        return;
    }

    const token = parts[1];
    if (!token) {
        res.status(401).json({ error: "Access denied. Invalid token." });
        return;
    }

    const secret = process.env.JWT_SECRET || "secretkey";

    // Ensure secret exists 
    if (!secret) {
        console.error("JWT_SECRET is not defined in environment variables.");
        res.status(500).json({ error: "Server configuration error." });
        return;
    }

    try {
        // Verify and cast payload
        const decoded = jwt.verify(token, secret) as { userId: string };
        
        // Attach ID to request for use in controllers (e.g., Post creation)
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