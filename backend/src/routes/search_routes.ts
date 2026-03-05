import express, { Router } from "express";
import { smartSearch } from "../controllers/search_controller";
import authMiddleware from "../middleware/auth_middleware";

const router: Router = express.Router();

/**
 * @swagger
 * /api/search/smart:
 *   post:
 *     summary: AI-powered smart search across trips
 *     description: |
 *       Uses RAG (Retrieval-Augmented Generation) to answer travel questions.
 *       Converts the query to a vector, finds the top 3 matching trips via
 *       MongoDB vector search, then generates a natural-language answer
 *       using Gemini 1.5-flash with the matched trip context.
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 example: "Where is it sunny in Israel?"
 *     responses:
 *       200:
 *         description: Search results with AI-generated answer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *                 sources:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *       400:
 *         description: Missing or invalid query
 *       500:
 *         description: Search or embedding failure
 *     security:
 *       - bearerAuth: []
 */
router.post("/smart", authMiddleware, smartSearch);

export default router;
