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
			// injectManifest: the service worker source lives in src/sw.ts so it can
			// handle web push (issue #13) on top of the precached app shell.
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.ts",
			registerType: "autoUpdate",
			manifest: {
				id: "/",
				name: "Aplaus",
				short_name: "Aplaus",
				description: "Nieoficjalny klient Librusa Synergia",
				lang: "pl",
				theme_color: "#0a84ff",
				background_color: "#ffffff",
				display: "standalone",
				icons: [
					{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
					{
						src: "/icon-maskable-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			injectManifest: {
				// Precache the app shell only. API responses live in the IndexedDB
				// offline cache (lib/offline-cache.ts), never in the precache.
				globPatterns: ["**/*.{js,css,html,png,woff2}"],
			},
			// Serve the worker in dev too — push subscription (serviceWorker.ready)
			// would otherwise wait forever during local testing. type: "module" is
			// required: the dev worker keeps its ESM imports, and the plugin's
			// default registration would try to load it as a classic script and
			// die silently on the import statement.
			devOptions: { enabled: true, type: "module" },
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
