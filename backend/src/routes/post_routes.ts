import express, { Router, Request, Response, NextFunction } from "express";
import postController from "../controllers/post_controller";
import authMiddleware from "../middleware/auth_middleware";
import uploadPostImages from "../config/post_multer_config";

const router: Router = express.Router();

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
    uploadPostImages.array("images", 6)(req, res, (err: any) => {
        if (!err) return next();
        if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: "File too large. Max 5MB per image." });
            return;
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
            res.status(400).json({ error: "Too many files. Max 6 images allowed." });
            return;
        }
        res.status(500).json({ error: "Upload failed: " + err.message });
    });
};

/**
 * @swagger
 * /post:
 *   post:
 *     summary: Create a new post
 *     description: |
 *       Creates a new post with the provided title and content.
 *       The userId is derived from the authenticated user.
 *     tags: [Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PostInput'
 *           examples:
 *             newPost:
 *               summary: Create a new post
 *               value:
 *                 title: "My First Post"
 *                 content: "This is the content of my first post. Hello, world!"
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Post validation failed: title: Path `title` is required."
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Access denied. No token provided."
 *     security:
 *       - bearerAuth: []
 */
router.post("/", authMiddleware, handleUpload, postController.post);

/**
 * @swagger
 * /post:
 *   get:
 *     summary: Get all posts or filter by user
 *     description: |
 *       Retrieves all posts from the database.
 *       Optionally filter posts by user ID using the `userId` query parameter.
 *       
 *       **Examples:**
 *       - Get all posts: `GET /post`
 *       - Get posts by user: `GET /post?userId=507f1f77bcf86cd799439011`
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter posts by user ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: List of posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 *             examples:
 *               allPosts:
 *                 summary: Multiple posts
 *                 value:
 *                   - _id: "507f1f77bcf86cd799439012"
 *                     title: "First Post"
 *                     content: "Content of the first post"
 *                     userId: "507f1f77bcf86cd799439011"
 *                   - _id: "507f1f77bcf86cd799439013"
 *                     title: "Second Post"
 *                     content: "Content of the second post"
 *                     userId: "507f1f77bcf86cd799439011"
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
router.get("/", postController.getAll);

/**
 * @swagger
 * /post/{id}:
 *   get:
 *     summary: Get a post by ID
 *     description: Retrieves a single post by its unique identifier.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The post ID
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Post found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
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
router.get("/:id", postController.getById);

/**
 * @swagger
 * /post/{id}/like:
 *   patch:
 *     summary: Toggle like on a post
 *     description: Adds or removes the authenticated user's like from a post.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The post ID
 *     responses:
 *       200:
 *         description: Like toggled successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id/like", authMiddleware, postController.toggleLike);

/**
 * @swagger
 * /post/{id}/comment:
 *   post:
 *     summary: Add a comment to a post
 *     description: Appends a new comment to the post's comments array.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       400:
 *         description: Comment text cannot be empty
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/comment", authMiddleware, postController.addComment);

/**
 * @swagger
 * /post/{id}:
 *   put:
 *     summary: Update a post
 *     description: |
 *       Updates an existing post with new data.
 *       All fields are optional - only provided fields will be updated.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The post ID
 *         example: "507f1f77bcf86cd799439012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: New post title
 *               content:
 *                 type: string
 *                 description: New post content
 *           examples:
 *             updateTitle:
 *               summary: Update title only
 *               value:
 *                 title: "Updated Post Title"
 *             updateAll:
 *               summary: Update title and content
 *               value:
 *                 title: "Updated Title"
 *                 content: "Updated content for the post"
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Not found"
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *     security:
 *       - bearerAuth: []
 */
router.put("/:id", authMiddleware, postController.updateItem);

/**
 * @swagger
 * /post/{id}:
 *   delete:
 *     summary: Delete a post
 *     description: |
 *       Permanently deletes a post from the database.
 *       
 *       **Warning**: This action cannot be undone. Associated comments are NOT automatically deleted.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The post ID to delete
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *             example:
 *               message: "Deleted successfully"
 *       404:
 *         description: Post not found
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
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:id", authMiddleware, postController.deleteItem);

export default router;
