import express, { Router, Request, Response, NextFunction } from "express";
import userController from "../controllers/user_controller";
import authMiddleware from "../middleware/auth_middleware";
import uploadProfileImage from "../config/multer_config";
import multer from "multer";

const router: Router = express.Router();

// Multer error handling middleware
const handleMulterError = (err: any, _req: Request, res: Response, next: NextFunction): void => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).send("File too large. Maximum size is 5MB.");
            return;
        }
        res.status(400).send(err.message);
        return;
    } else if (err) {
        res.status(400).send(err.message);
        return;
    }
    next();
};

/**
 * @swagger
 * /user:
 *   post:
 *     summary: Create a new user
 *     description: |
 *       Creates a new user directly (without going through authentication).
 *       
 *       **Note**: For user registration with authentication tokens, use the `/auth/register` endpoint instead.
 *       This endpoint is primarily for administrative purposes.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *           examples:
 *             newUser:
 *               summary: Create a new user
 *               value:
 *                 username: "janedoe"
 *                 email: "jane@example.com"
 *                 password: "securePassword456"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid request data or duplicate user
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "E11000 duplicate key error collection: users index: email_1 dup key"
 */
router.post("/", userController.create);

/**
 * @swagger
 * /user:
 *   get:
 *     summary: Get all users or filter by email
 *     description: |
 *       Retrieves all users from the database.
 *       Optionally filter users by email using the `email` query parameter.
 *       
 *       **Examples:**
 *       - Get all users: `GET /user`
 *       - Get user by email: `GET /user?email=john@example.com`
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         required: false
 *         description: Filter users by email address
 *         example: "john@example.com"
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserResponse'
 *             examples:
 *               allUsers:
 *                 summary: Multiple users
 *                 value:
 *                   - _id: "507f1f77bcf86cd799439011"
 *                     username: "johndoe"
 *                     email: "john@example.com"
 *                   - _id: "507f1f77bcf86cd799439015"
 *                     username: "janedoe"
 *                     email: "jane@example.com"
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
router.get("/", userController.getAll);

/**
 * @swagger
 * /user/profile/{userId}:
 *   get:
 *     summary: Get user public profile
 *     description: Retrieves a single user by their unique identifier.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Not found"
 *       400:
 *         description: Invalid ID format
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
router.get("/profile/:userId", userController.getPublicProfile);

/**
 * @swagger
 * /user/id/{id}:
 *   get:
 *     summary: Get a user by ID
 *     description: Retrieves a single user by their unique identifier.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Not found"
 *       400:
 *         description: Invalid ID format
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
router.get("/id/:id", userController.getById);

/**
 * @swagger
 * /user/username/{username}:
 *   get:
 *     summary: Get a user by username
 *     description: |
 *       Retrieves a single user by their unique username.
 *       Usernames are case-sensitive.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: The username to search for
 *         example: "johndoe"
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "User not found"
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
router.get("/username/:username", userController.getByUsername);

/**
 * @swagger
 * /user/{userId}:
 *   put:
 *     summary: Update user profile (authenticated user only)
 *     description: |
 *       Allows the authenticated user to update their own profile.
 *       
 *       **Updateable Fields:**
 *       - username (3-30 characters, alphanumeric and underscore only)
 *       - profileImage (file upload via multipart/form-data)
 *       
 *       **Constraints:**
 *       - Users can only update their own profile (JWT must match userId)
 *       - Cannot update email or password via this endpoint
 *       - Username must be unique
 *       
 *       **File Upload:**
 *       - Accepted formats: JPEG, PNG, WebP
 *       - Max file size: 5MB
 *       - Use field name: `profileImage`
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to update (must match authenticated user)
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username (3-30 chars, alphanumeric + underscore)
 *                 example: "johndoe_updated"
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: Profile image file (JPEG, PNG, WebP, max 5MB)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 profilePic:
 *                   type: string
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *             example:
 *               id: "507f1f77bcf86cd799439011"
 *               username: "johndoe_updated"
 *               profilePic: "/uploads/profiles/507f1f77bcf86cd799439011-1738195200000.jpg"
 *               updatedAt: "2026-01-29T12:45:30.000Z"
 *       400:
 *         description: Invalid request data or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             examples:
 *               noFields:
 *                 value: "No valid fields to update"
 *               invalidUsername:
 *                 value: "Username must be between 3 and 30 characters"
 *               invalidChars:
 *                 value: "Username can only contain alphanumeric characters and underscores"
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Access denied. No token provided."
 *       403:
 *         description: Forbidden - User can only edit their own profile
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Unauthorized: You can only edit your own profile"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "User not found"
 *       409:
 *         description: Username already taken
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Username already taken"
 *     security:
 *       - bearerAuth: []
 */
router.put("/:userId", authMiddleware, uploadProfileImage.single("profileImage"), handleMulterError, userController.updateProfile);

/**
 * @swagger
 * /user/{id}:
 *   put:
 *     summary: Update a user
 *     description: |
 *       Updates an existing user with new data.
 *       All fields are optional - only provided fields will be updated.
 *       
 *       **Note**: Be careful when updating email or username as they must remain unique.
 *       Password should be hashed before updating if you're changing it directly.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username (must be unique)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address (must be unique)
 *           examples:
 *             updateUsername:
 *               summary: Update username only
 *               value:
 *                 username: "johndoe_updated"
 *             updateEmail:
 *               summary: Update email only
 *               value:
 *                 email: "newemail@example.com"
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Not found"
 *       400:
 *         description: Invalid request data or duplicate key error
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
router.put("/old/:id", userController.updateItem);

/**
 * @swagger
 * /user/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: |
 *       Permanently deletes a user from the database.
 *       
 *       **Warning**: This action cannot be undone. Associated posts and comments are NOT automatically deleted.
 *       Consider cleaning up related data before deleting a user.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to delete
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *             example:
 *               message: "Deleted successfully"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Not found"
 *       400:
 *         description: Invalid ID format
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
router.delete("/:id", userController.deleteItem);

export default router;
