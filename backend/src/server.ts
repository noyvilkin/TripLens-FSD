import "dotenv/config";
import app from "./app";
import https from "https";
import http from "http";
import fs from "fs";

const port = process.env.PORT || 4000;

if (process.env.NODE_ENV !== "production") {
    console.log("development");
    http.createServer(app).listen(port, () => {
        console.log(`HTTP Server is running on http://localhost:${port}`);
    });
} else {
    console.log("PRODUCTION");
    const options = {
        key: fs.readFileSync("../client-key.pem"),
        cert: fs.readFileSync("../client-cert.pem"),
    };
    https.createServer(options, app).listen(process.env.HTTPS_PORT, () => {
        console.log(`HTTPS Server is running on port ${process.env.HTTPS_PORT}`);
    });
}
