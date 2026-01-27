import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "FSD Assignment 2 - REST API",
            version: "1.0.0",
            description: `
## Overview
A comprehensive REST API for managing posts, comments, users, and authentication.

### Features
- **Authentication**: JWT-based authentication with access and refresh tokens
- **Posts**: Create, read, update, and delete posts
- **Comments**: Manage comments on posts
- **Users**: User management with search capabilities

### Authentication Flow
1. Register a new user or login with existing credentials
2. Receive access token and refresh token
3. Use access token in Authorization header for protected routes
4. When access token expires, use refresh token to get new tokens
5. Logout to invalidate refresh token
            `,
            contact: {
                name: "API Support"
            }
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Development server"
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Enter your JWT access token"
                }
            },
            schemas: {
                // User Schemas
                User: {
                    type: "object",
                    properties: {
                        _id: {
                            type: "string",
                            description: "User unique identifier",
                            example: "507f1f77bcf86cd799439011"
                        },
                        username: {
                            type: "string",
                            description: "Unique username",
                            example: "johndoe"
                        },
                        email: {
                            type: "string",
                            format: "email",
                            description: "User email address",
                            example: "john@example.com"
                        },
                        password: {
                            type: "string",
                            description: "Hashed password (not returned in responses)",
                            example: "$2b$10$..."
                        }
                    },
                    required: ["username", "email", "password"]
                },
                Post: {
                    type: "object",
                    properties: {
                        _id: {
                            type: "string",
                            description: "Post unique identifier",
                            example: "507f1f77bcf86cd799439012"
                        },
                        title: {
                            type: "string",
                            description: "Post title",
                            example: "My First Post"
                        },
                        content: {
                            type: "string",
                            description: "Post content/body",
                            example: "This is the content of my first post..."
                        },
                        userId: {
                            type: "string",
                            description: "ID of the user who created the post",
                            example: "507f1f77bcf86cd799439011"
                        }
                    },
                    required: ["title", "content", "userId"]
                },
             // Comment Schemas
                Comment: {
                    type: "object",
                    properties: {
                        _id: {
                            type: "string",
                            description: "Comment unique identifier",
                            example: "507f1f77bcf86cd799439013"
                        },
                        content: {
                            type: "string",
                            description: "Comment text",
                            example: "Great post! Thanks for sharing."
                        },
                        userId: {
                            type: "string",
                            description: "ID of the user who wrote the comment",
                            example: "507f1f77bcf86cd799439011"
                        },
                        postId: {
                            type: "string",
                            description: "ID of the post this comment belongs to",
                            example: "507f1f77bcf86cd799439012"
                        }
                    },
                    required: ["content", "userId", "postId"]
                }
            }
        },
        tags: [
            {
                name: "Auth",
                description: "Authentication endpoints - Register, Login, Refresh tokens, and Logout"
            },
            {
                name: "Posts",
                description: "Post management - Create, read, update, and delete posts"
            },
            {
                name: "Comments",
                description: "Comment management - Create, read, update, and delete comments on posts"
            },
            {
                name: "Users",
                description: "User management - CRUD operations for users"
            }
        ]
    },
    apis: ["./src/routes/*.ts"]
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

