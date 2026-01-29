import multer, { StorageEngine, FileFilterCallback } from "multer";
import path from "path";
import { Request } from "express";

// Define upload directory
const uploadDir = path.join(__dirname, "../../uploads/profiles");

// Configure storage
const storage: StorageEngine = multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, uploadDir);
    },
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        // Generate filename: userId-timestamp.ext
        const userId = (req as any).userId || "unknown";
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `${userId}-${timestamp}${ext}`;
        cb(null, filename);
    }
});

// File filter - only allow images
const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(", ")}`));
    }
};

// Create multer instance with configuration
const uploadProfileImage = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
});

export default uploadProfileImage;
