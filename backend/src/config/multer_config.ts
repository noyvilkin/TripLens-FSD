import multer, { StorageEngine, FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

// Define upload directory
const uploadDir = path.join(__dirname, "../../uploads/profiles");

const ensureUploadDirExists = (): void => {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
};

// Ensure folder exists at startup (covers fresh deploys)
ensureUploadDirExists();

// Configure storage
const storage: StorageEngine = multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        // Re-check at request time in case folder was removed while process is running
        ensureUploadDirExists();
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
