import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import authMiddleware, { AuthRequest } from "../middleware/auth_middleware";

describe("Auth Middleware Tests", () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    const validSecret = process.env.JWT_SECRET || "secretkey";
    const testUserId = "507f1f77bcf86cd799439011";

    beforeEach(() => {
        // Reset mocks before each test
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        
        mockRequest = {
            headers: {}
        };
        
        mockResponse = {
            status: statusMock,
            json: jsonMock
        };
        
        mockNext = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Missing Authorization Header", () => {
        test("Should return 401 when no authorization header is provided", () => {
            mockRequest.headers = {};

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. No token provided."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should return 401 when authorization header is undefined", () => {
            mockRequest.headers = { authorization: undefined };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. No token provided."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe("Invalid Token Format", () => {
        test("Should return 401 when Bearer prefix is missing", () => {
            const token = jwt.sign({ userId: testUserId }, validSecret);
            mockRequest.headers = { authorization: token };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token format."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should return 401 when authorization header has wrong format (no space)", () => {
            mockRequest.headers = { authorization: "BearerInvalidToken" };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token format."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should return 401 when authorization header has too many parts", () => {
            mockRequest.headers = { authorization: "Bearer token extra-part" };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token format."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should return 401 when using wrong prefix (not Bearer)", () => {
            const token = jwt.sign({ userId: testUserId }, validSecret);
            mockRequest.headers = { authorization: `Basic ${token}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token format."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should return 401 when token part is empty", () => {
            mockRequest.headers = { authorization: "Bearer " };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe("Valid Token", () => {
        test("Should successfully authenticate with valid token", () => {
            const token = jwt.sign({ userId: testUserId }, validSecret);
            mockRequest.headers = { authorization: `Bearer ${token}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockRequest.userId).toBe(testUserId);
            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(statusMock).not.toHaveBeenCalled();
            expect(jsonMock).not.toHaveBeenCalled();
        });

        test("Should set userId on request object", () => {
            const token = jwt.sign({ userId: testUserId }, validSecret);
            mockRequest.headers = { authorization: `Bearer ${token}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockRequest.userId).toBeDefined();
            expect(mockRequest.userId).toBe(testUserId);
        });

        test("Should work with different valid user IDs", () => {
            const differentUserId = "507f1f77bcf86cd799439999";
            const token = jwt.sign({ userId: differentUserId }, validSecret);
            mockRequest.headers = { authorization: `Bearer ${token}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockRequest.userId).toBe(differentUserId);
            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });

    describe("Invalid Token", () => {
        test("Should return 401 for malformed token", () => {
            mockRequest.headers = { authorization: "Bearer invalid.token.here" };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should return 401 for token signed with wrong secret", () => {
            const token = jwt.sign({ userId: testUserId }, "wrong-secret");
            mockRequest.headers = { authorization: `Bearer ${token}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should return 401 for tampered token", () => {
            const token = jwt.sign({ userId: testUserId }, validSecret);
            const tamperedToken = token.slice(0, -5) + "xxxxx";
            mockRequest.headers = { authorization: `Bearer ${tamperedToken}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should return 401 for completely random string", () => {
            mockRequest.headers = { authorization: "Bearer randomstringnotavalidtoken" };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token."
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe("Expired Token", () => {
        test("Should return 401 for expired token", (done) => {
            const token = jwt.sign(
                { userId: testUserId },
                validSecret,
                { expiresIn: "1ms" }
            );

            // Wait for token to expire
            setTimeout(() => {
                mockRequest.headers = { authorization: `Bearer ${token}` };

                authMiddleware(
                    mockRequest as AuthRequest,
                    mockResponse as Response,
                    mockNext
                );

                expect(statusMock).toHaveBeenCalledWith(401);
                expect(jsonMock).toHaveBeenCalledWith({
                    error: "Access denied. Token expired."
                });
                expect(mockNext).not.toHaveBeenCalled();
                done();
            }, 100);
        });

        test("Should distinguish between expired and invalid tokens", (done) => {
            const expiredToken = jwt.sign(
                { userId: testUserId },
                validSecret,
                { expiresIn: "1ms" }
            );

            setTimeout(() => {
                mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

                authMiddleware(
                    mockRequest as AuthRequest,
                    mockResponse as Response,
                    mockNext
                );

                expect(jsonMock).toHaveBeenCalledWith({
                    error: "Access denied. Token expired."
                });
                expect(jsonMock).not.toHaveBeenCalledWith({
                    error: "Access denied. Invalid token."
                });
                done();
            }, 100);
        });
    });

    describe("Edge Cases", () => {
        test("Should handle token with extra whitespace", () => {
            const token = jwt.sign({ userId: testUserId }, validSecret);
            mockRequest.headers = { authorization: `  Bearer ${token}  ` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            // Should fail because of extra whitespace
            expect(statusMock).toHaveBeenCalledWith(401);
        });

        test("Should handle empty string token", () => {
            mockRequest.headers = { authorization: "Bearer " };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });

        test("Should handle case-sensitive Bearer prefix", () => {
            const token = jwt.sign({ userId: testUserId }, validSecret);
            mockRequest.headers = { authorization: `bearer ${token}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                error: "Access denied. Invalid token format."
            });
        });

        test("Should not modify request if authentication fails", () => {
            mockRequest.headers = { authorization: "Bearer invalid" };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockRequest.userId).toBeUndefined();
        });
    });

    describe("Token Payload Variations", () => {
        test("Should extract userId from token payload", () => {
            const payload = { userId: "unique-user-id-123" };
            const token = jwt.sign(payload, validSecret);
            mockRequest.headers = { authorization: `Bearer ${token}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockRequest.userId).toBe(payload.userId);
        });

        test("Should handle token with additional payload fields", () => {
            const payload = {
                userId: testUserId,
                email: "test@example.com",
                role: "admin"
            };
            const token = jwt.sign(payload, validSecret);
            mockRequest.headers = { authorization: `Bearer ${token}` };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(mockRequest.userId).toBe(testUserId);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe("Security Tests", () => {
        test("Should not expose secret in error messages", () => {
            mockRequest.headers = { authorization: "Bearer invalid" };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            const errorCall = jsonMock.mock.calls[0][0];
            expect(JSON.stringify(errorCall)).not.toContain(validSecret);
        });

        test("Should call response methods only once per request", () => {
            mockRequest.headers = { authorization: "Bearer invalid" };

            authMiddleware(
                mockRequest as AuthRequest,
                mockResponse as Response,
                mockNext
            );

            expect(statusMock).toHaveBeenCalledTimes(1);
            expect(jsonMock).toHaveBeenCalledTimes(1);
        });

        test("Should not call next() on authentication failure", () => {
            const invalidCases = [
                { authorization: undefined },
                { authorization: "invalid" },
                { authorization: "Bearer invalid" }
            ];

            invalidCases.forEach(headers => {
                mockRequest.headers = headers;
                (mockNext as jest.Mock).mockClear();

                authMiddleware(
                    mockRequest as AuthRequest,
                    mockResponse as Response,
                    mockNext
                );

                expect(mockNext).not.toHaveBeenCalled();
            });
        });
    });
});
