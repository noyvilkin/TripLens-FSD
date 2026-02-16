import express, { Router } from "express";
import commentController from "../controllers/comment_controller";
import authMiddleware from "../middleware/auth_middleware";

const router: Router = express.Router();

/**
 * @swagger
 * /comment:
 *   post:
 *     summary: Create a new comment
 *     description: |
 *       Creates a new comment on a post.
 *       Both userId and postId must reference existing users and posts in the system.
 *     tags: [Comments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentInput'
 *           examples:
 *             newComment:
 *               summary: Create a new comment
 *               value:
 *                 content: "Great post! Thanks for sharing."
 *                 userId: "507f1f77bcf86cd799439011"
 *                 postId: "507f1f77bcf86cd799439012"
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example: "Comment validation failed: content: Path `content` is required."
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
router.post("/", authMiddleware, commentController.create);

/**
 * @swagger
 * /comment:
 *   get:
 *     summary: Get all comments with optional filters
 *     description: |
 *       Retrieves comments from the database.
 *       Supports filtering by postId and/or userId.
 *       
 *       **Filter Examples:**
 *       - Get all comments: `GET /comment`
 *       - Get comments on a post: `GET /comment?postId=507f1f77bcf86cd799439012`
 *       - Get comments by user: `GET /comment?userId=507f1f77bcf86cd799439011`
 *       - Combined filter: `GET /comment?postId=...&userId=...`
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: postId
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter comments by post ID
 *         example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter comments by user ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *             examples:
 *               multipleComments:
 *                 summary: Multiple comments
 *                 value:
 *                   - _id: "507f1f77bcf86cd799439013"
 *                     content: "Great post!"
 *                     userId: "507f1f77bcf86cd799439011"
 *                     postId: "507f1f77bcf86cd799439012"
 *                   - _id: "507f1f77bcf86cd799439014"
 *                     content: "Thanks for sharing!"
 *                     userId: "507f1f77bcf86cd799439015"
 *                     postId: "507f1f77bcf86cd799439012"
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
router.get("/", commentController.getAll);

/**
 * @swagger
 * /comment/{id}:
 *   get:
 *     summary: Get a comment by ID
 *     description: Retrieves a single comment by its unique identifier.
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The comment ID
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Comment found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Comment not found
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
router.get("/:id", commentController.getById);

/**
 * @swagger
 * /comment/{id}:
 *   put:
 *     summary: Update a comment
 *     description: |
 *       Updates an existing comment.
 *       Typically only the content field should be updated.
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The comment ID
 *         example: "507f1f77bcf86cd799439013"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated comment text
 *           examples:
 *             updateContent:
 *               summary: Update comment content
 *               value:
 *                 content: "Updated comment text - even better than before!"
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Comment not found
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
router.put("/:id", authMiddleware, commentController.updateItem);

/**
 * @swagger
 * /comment/{id}:
 *   delete:
 *     summary: Delete a comment
 *     description: |
 *       Permanently deletes a comment from the database.
 *       
 *       **Warning**: This action cannot be undone.
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The comment ID to delete
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *             example:
 *               message: "Deleted successfully"
 *       404:
 *         description: Comment not found
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
router.delete("/:id", authMiddleware, commentController.deleteItem);

export default router;
