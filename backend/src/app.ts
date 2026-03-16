import express, { Express, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import path from "path";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import userRoutes from "./routes/user_routes";
import authRoutes from "./routes/auth_routes";
import postRoutes from "./routes/post_routes";
import commentRoutes from "./routes/comment_routes";
import searchRoutes from "./routes/search_routes";

const isProduction = process.env.NODE_ENV === "production";

const app: Express = express();

if (isProduction) {
  app.use(compression());
}

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isProduction) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options(/.*/, cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files (uploaded images) with error handling for missing files
app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
    const filePath = path.join(__dirname, '../uploads', req.path);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File doesn't exist - return 404 instead of crashing
            res.status(404).json({ error: 'File not found' });
            return;
        }
        // File exists - serve it normally
        express.static(path.join(__dirname, '../uploads'))(req, res, next);
    });
});


// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/user", userRoutes);
app.use("/auth", authRoutes);
app.use("/post", postRoutes);
app.use("/comment", commentRoutes);
app.use("/api/search", searchRoutes);

const clientDistPath = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(clientDistPath));
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// Database Connection
const db = mongoose.connection;
db.on("error", (error: Error) => console.error("Database Connection Error:", error));
db.once("open", () => console.log("Connected to MongoDB successfully"));


mongoose.connect(process.env.DATABASE_URL as string);

export default app;
