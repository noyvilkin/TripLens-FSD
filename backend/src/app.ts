import express, { Express } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import userRoutes from "./routes/user_routes";
import authRoutes from "./routes/auth_routes";


// Load environment variables
dotenv.config();
const app: Express = express();

// Middleware
app.use(cors({ 
  origin: 'http://localhost:5173', // React URL
  credentials: true                // Allow cookies to be sent
}));
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // To read refresh tokens from cookies


// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/user", userRoutes);
app.use("/auth", authRoutes);

// Database Connection
const db = mongoose.connection;
db.on("error", (error: Error) => console.error("Database Connection Error:", error));
db.once("open", () => console.log("Connected to MongoDB successfully"));

mongoose.connect(process.env.DATABASE_URL as string);

export default app;
