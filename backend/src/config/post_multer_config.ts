import multer, { StorageEngine, FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

const uploadDir = path.join(__dirname, "../../uploads/posts");

// Only create upload directory if not in test mode
if (process.env.NODE_ENV !== "test" && !fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Use memory storage in test environment
const storage: StorageEngine = process.env.NODE_ENV === "test"
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
            cb(null, uploadDir);
        },
        filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
            const userId = (req as any).userId || "unknown";
            const timestamp = Date.now();
            const ext = path.extname(file.originalname);
            const filename = `${userId}-${timestamp}-${Math.round(Math.random() * 1e6)}${ext}`;
            cb(null, filename);
        }
    });

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(", ")}`));
    }
};

const uploadPostImages = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 6
    }
});

export default uploadPostImages;
