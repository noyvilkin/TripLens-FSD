import express, { Express } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import userRoutes from "./routes/user_routes";
import authRoutes from "./routes/auth_routes";
import postRoutes from "./routes/post_routes";
import commentRoutes from "./routes/comment_routes";


// Load environment variables
dotenv.config();
const app: Express = express();

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser clients
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options(/.*/, cors());
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // To read refresh tokens from cookies

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/user", userRoutes);
app.use("/auth", authRoutes);
app.use("/post", postRoutes);
app.use("/comment", commentRoutes);

// Database Connection
const db = mongoose.connection;
db.on("error", (error: Error) => console.error("Database Connection Error:", error));
db.once("open", () => console.log("Connected to MongoDB successfully"));

mongoose.connect(process.env.DATABASE_URL as string);

export default app;
