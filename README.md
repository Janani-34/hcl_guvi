# Pulsepoll

Pulsepoll is a live polling tool built for the GUVI developer internship task.

## Structure

- `app/` — React/Next.js preview UI
- `backend/` — Go + Gin HTTP service
- MongoDB Atlas stores poll definitions and ownership metadata.
- Upstash Redis stores vote counters and publishes poll-specific events. Clients subscribe through the Go SSE endpoint, so results update without refresh.

## Backend configuration

Run the service from `backend/` with:

- `MONGODB_URI` — MongoDB Atlas connection string
- `MONGODB_DATABASE` — database name (defaults to `pulsepoll`)
- `REDIS_URL` — Redis connection address
- `PORT` — optional, defaults to `8080`

The API validates question length, option count, non-empty options, poll IDs, and vote options server-side. In production, replace the simple `X-User-ID` boundary with a signed session/JWT middleware before exposing poll management routes.

## Submission checklist

1. Deploy the React frontend and Go backend.
2. Configure the Atlas and Upstash variables in the deployment environments.
3. Record the required 3–5 minute walkthrough: demonstrate create → share → vote → live results, explain the hardest challenge, and disclose AI usage.
4. Publish the public GitHub repository and live URL, then email both plus the video to `devhiring@hclguvi.com`.

Understand the fundamentals before recording: MongoDB is the durable source for poll definitions, Redis is the low-latency counter/event bus, and SSE keeps connected viewers synchronized.
