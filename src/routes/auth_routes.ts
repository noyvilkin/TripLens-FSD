import express, { Router } from "express";
import authController from "../controllers/auth_controller";

const router: Router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: |
 *       Creates a new user account with the provided credentials.
 *       Returns JWT access and refresh tokens upon successful registration.
 *       
 *       **Note**: Both username and email must be unique across the system.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *           examples:
 *             newUser:
 *               summary: New user registration
 *               value:
 *                 username: "johndoe"
 *                 email: "john@example.com"
 *                 password: "securePassword123"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       401:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Username, email and password are required"
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "User with this email or username already exists"
 */
router.post("/register", authController.register.bind(authController));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: |
 *       Authenticates a user with email and password.
 *       Returns JWT access and refresh tokens upon successful login.
 *       
 *       **Access Token**: Short-lived token for API authentication (default: 1 hour)
 *       **Refresh Token**: Long-lived token for obtaining new access tokens (default: 24 hours)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *           examples:
 *             validLogin:
 *               summary: Valid login credentials
 *               value:
 *                 email: "john@example.com"
 *                 password: "securePassword123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         description: Invalid credentials or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingFields:
 *                 summary: Missing required fields
 *                 value:
 *                   error: "Email and password are required"
 *               invalidCredentials:
 *                 summary: Invalid credentials
 *                 value:
 *                   error: "Invalid email or password"
 */
router.post("/login", authController.login.bind(authController));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: |
 *       Exchange a valid refresh token for new access and refresh tokens.
 *       The old refresh token is invalidated after use (token rotation).
 *       
 *       **Security Note**: If an invalid or already-used refresh token is detected,
 *       all refresh tokens for that user are invalidated as a security measure.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshInput'
 *           example:
 *             refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Invalid refresh token"
 */
router.post("/refresh", authController.refresh.bind(authController));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: |
 *       Invalidates the provided refresh token, effectively logging out the user
 *       from the current session. The user must provide the refresh token that
 *       was issued during login.
 *       
 *       **Note**: This only invalidates the specific refresh token provided.
 *       Other active sessions (with different refresh tokens) will remain valid.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogoutInput'
 *           example:
 *             refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *             example:
 *               message: "Logged out successfully"
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Invalid refresh token"
 */
router.post("/logout", authController.logout.bind(authController));

export default router;
