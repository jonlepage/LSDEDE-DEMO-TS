import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	base: "/LSDEDE-DEMO-TS/",
	server: {
		port: 8080,
		open: true,
		proxy: {
			// Reverse-proxy PostHog ingestion so ad blockers don't block requests.
			// Requests to /ingest/... are forwarded to us.i.posthog.com/...
			"/ingest/static": {
				target: "https://us-assets.i.posthog.com",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/ingest\/static/, "/static"),
			},
			"/ingest": {
				target: "https://us.i.posthog.com",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/ingest/, ""),
			},
		},
	},
});
