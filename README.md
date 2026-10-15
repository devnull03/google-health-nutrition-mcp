# Google Health Nutrition MCP

TypeScript MCP server scaffold exposing `log_food` and `read_nutrition`. It calls a configurable Health Connect bridge API and uses a Google OAuth bearer token. This is not a direct Google Health Connect cloud integration.

## Important platform limitation

Google Health Connect is an Android on-device health data store accessed through the Health Connect Android SDK; it does not provide a general-purpose Google-hosted REST API for this server to call. Therefore this repository expects a separately deployed Android/client bridge (or your own backend) that reads/writes Health Connect data and exposes the routes below. The bridge must enforce user consent and map these request/response formats to Health Connect records. The MCP server cannot itself grant Health Connect permissions or access a user's device data.

Expected bridge routes:
- `POST /v1/nutrition/food`: accepts food name, timestamp, serving quantity/unit and optional nutrition totals.
- `GET /v1/nutrition?startDate=...&endDate=...`: returns matching nutrition records.

## Requirements and setup

- Node.js 22+ and npm, or Docker Compose.
- A Google Cloud project and OAuth 2.0 credentials for the bridge's Google identity flow, if applicable. Create an OAuth client under APIs & Services → Credentials, configure the appropriate application type and authorized redirect URIs, and request only scopes required by the APIs your bridge actually uses. Health Connect permissions are granted by the Android app at runtime, not by a Google Cloud OAuth scope. Do not assume a Google Health Connect REST scope exists.
- Implement/deploy the bridge described above. `HEALTH_API_BASE_URL` points to it.

```sh
cp .env.example .env
# Edit .env with a short-lived OAuth access token and bridge URL.
npm install
npm run build
npm start
```

The MCP server uses stdio transport. For local development use `npm run dev`.

## Environment variables

- `GOOGLE_ACCESS_TOKEN`: OAuth 2.0 access token accepted by your bridge. This scaffold does not implement the authorization-code/token refresh flow; provide a token securely or add a suitable OAuth client/token provider. Never commit `.env` or long-lived secrets.
- `HEALTH_API_BASE_URL`: base URL of the bridge service.

## Docker

```sh
cp .env.example .env
# Configure .env first
docker compose build
```

Compose runs the stdio server container. An MCP client that launches stdio processes can run it with a compatible Docker command; configure the client's stdio transport to execute `docker compose run --rm -T nutrition-mcp` from this directory and ensure the bridge URL is reachable from the container (for example, use the host's Docker-reachable address rather than localhost where appropriate). Keep the client config secrets outside version control.

## MCP client connection

Build and launch `node dist/index.js` as an MCP stdio server (or use the Docker command above). Example generic client configuration:

```json
{
  "mcpServers": {
    "google-health-nutrition": {
      "command": "node",
      "args": ["/absolute/path/to/google-health-nutrition-mcp/dist/index.js"],
      "env": {
        "GOOGLE_ACCESS_TOKEN": "YOUR_TOKEN",
        "HEALTH_API_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

The server provides `log_food` and `read_nutrition`. Adapt the bridge paths, payloads, OAuth validation, and data mapping to your actual Health Connect implementation before use. Nutrition and health information is sensitive; use TLS, least-privilege access, secure token storage, and explicit user consent.
