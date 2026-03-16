# TripLens-FSD

## Running in Production

In production the Express backend serves the compiled React frontend on a single port (default `4000`).

### Prerequisites

- Node.js installed
- MongoDB running and `DATABASE_URL` set in `backend/.env`

### Steps

```bash
# 1. Install dependencies
cd frontend && npm install
cd ../backend && npm install

# 2. Build the frontend (outputs to frontend/dist/)
cd ../frontend && npm run build

# 3. Build the backend (compiles TypeScript to backend/dist/)
cd ../backend && npm run build

# 4. Start the server
NODE_ENV=production node dist/server.js
```

The app is now available at `http://localhost:4000`.

### How it works

- `express.static` serves the built frontend assets from `frontend/dist/`
- A catch-all middleware serves `index.html` for any unmatched GET request, enabling client-side routing (React Router)
- `compression` middleware gzips all responses to reduce transfer size
- API routes (`/auth`, `/user`, `/post`, `/comment`, `/api/search`) are registered before the catch-all and take precedence