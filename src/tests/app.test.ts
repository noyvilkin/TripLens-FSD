import mongoose from "mongoose";
import app from "../app";

describe("App Configuration Tests", () => {
    // Clean up after all tests
    afterAll(async () => {
        // Clean up test spies
        jest.restoreAllMocks();
        
        // Wait a bit for any pending operations
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("Database Connection", () => {
        test("Should have database connection configured", () => {
            expect(mongoose.connection).toBeDefined();
        });

        test("Should have error handler registered", () => {
            const db = mongoose.connection;
            const errorListeners = db.listeners("error");
            
            expect(errorListeners.length).toBeGreaterThan(0);
        });

        test("Should have open handler registered", () => {
            const db = mongoose.connection;
            const openListeners = db.listeners("open");
            
            expect(openListeners.length).toBeGreaterThan(0);
        });

        test("Should handle database connection errors", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
            const testError = new Error("Test database connection error");
            
            // Emit error event to trigger the error handler
            mongoose.connection.emit("error", testError);
            
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Database Connection Error:",
                testError
            );
            
            consoleErrorSpy.mockRestore();
        });

        test("Should handle database open event", () => {
            const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
            
            // Emit open event
            mongoose.connection.emit("open");
            
            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Connected to MongoDB successfully"
            );
            
            consoleLogSpy.mockRestore();
        });
    });

    describe("Express App Configuration", () => {
        test("Should be an Express application", () => {
            expect(app).toBeDefined();
            expect(typeof app).toBe("function");
        });
    });

    describe("Environment Configuration", () => {
        test("Should have DATABASE_URL configured", () => {
            expect(process.env.DATABASE_URL).toBeDefined();
            expect(process.env.DATABASE_URL).toBeTruthy();
        });
    });

    describe("Swagger Documentation", () => {
        test("Should export app for swagger documentation", () => {
            expect(app).toBeDefined();
            expect(typeof app.use).toBe("function");
        });
    });

    describe("Route Registration", () => {
        test("Should have routing capability", () => {
            expect(app).toBeDefined();
            expect(typeof app.use).toBe("function");
        });
    });

    describe("Database Error Scenarios", () => {
        test("Should handle multiple database errors", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
            
            const error1 = new Error("Connection timeout");
            const error2 = new Error("Authentication failed");
            
            mongoose.connection.emit("error", error1);
            mongoose.connection.emit("error", error2);
            
            expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenNthCalledWith(
                1,
                "Database Connection Error:",
                error1
            );
            expect(consoleErrorSpy).toHaveBeenNthCalledWith(
                2,
                "Database Connection Error:",
                error2
            );
            
            consoleErrorSpy.mockRestore();
        });

        test("Should handle error with custom message", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
            const customError = new Error("Custom database error message");
            
            mongoose.connection.emit("error", customError);
            
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Database Connection Error:",
                customError
            );
            expect(customError.message).toBe("Custom database error message");
            
            consoleErrorSpy.mockRestore();
        });

        test("Should handle error without breaking the application", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
            const testError = new Error("Non-critical error");
            
            expect(() => {
                mongoose.connection.emit("error", testError);
            }).not.toThrow();
            
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });
});
