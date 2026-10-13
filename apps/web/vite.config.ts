import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: "autoUpdate",
			manifest: {
				name: "Aplaus",
				short_name: "Aplaus",
				description: "Nieoficjalny klient Librusa Synergia",
				lang: "pl",
				theme_color: "#0a84ff",
				background_color: "#ffffff",
				display: "standalone",
				icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
			},
		}),
	],
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	// In dev the API runs on its own port (8788), so same-origin /api calls are
	// forwarded there — the browser never needs to know the API address. In
	// production the app is served same-origin with the API, so no proxy there.
	server: {
		// Fixed port so the dev origin stays predictable (CORS allowlist in the
		// API's cors.ts lists it). Falls back to 4001+ if 4000 is taken.
		port: 4000,
		proxy: {
			"/api": "http://localhost:8788",
		},
	},
});
