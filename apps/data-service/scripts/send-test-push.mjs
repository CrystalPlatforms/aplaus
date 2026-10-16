/**
 * Testowy web push do lokalnie zarejestrowanych subskrypcji (KV dev).
 * Użycie (z repo root):
 *   pnpm run --filter data-service send:push
 *   pnpm run --filter data-service send:push /grades "Nowa ocena" "Tapnij, aby zobaczyć oceny."
 * Wysyła do WSZYSTKICH subskrypcji w lokalnym KV, raportuje statusy.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, "..");

const [url = "/grades", title = "Aplaus — test push", body = "Tapnij, aby otworzyć widok Oceny."] =
	process.argv.slice(2);

const wrangler = (args) =>
	execFileSync("npx", ["wrangler", ...args], { cwd: pkgDir, encoding: "utf8" });

const names = JSON.parse(
	wrangler(["kv", "key", "list", "--binding", "KV", "--local", "--env", "dev"]),
)
	.map((entry) => entry.name)
	.filter((name) => name.startsWith("pushsub:"));

if (names.length === 0) {
	console.error("Brak subskrypcji w lokalnym KV — włącz powiadomienia w apce (localhost:4000).");
	process.exit(1);
}

const vapid = Object.fromEntries(
	readFileSync(join(pkgDir, ".dev.vars"), "utf8")
		.split("\n")
		.filter((line) => line.startsWith("VAPID_"))
		.map((line) => {
			const idx = line.indexOf("=");
			return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
		}),
);

const { ApplicationServerKeys, generatePushHTTPRequest } = await import("webpush-webcrypto");
const { setWebCrypto } = await import("webpush-webcrypto");
const nodeCrypto = await import("node:crypto");
setWebCrypto(nodeCrypto.webcrypto);

const keys = await ApplicationServerKeys.fromJSON({
	publicKey: vapid.VAPID_PUBLIC_KEY,
	privateKey: vapid.VAPID_PRIVATE_KEY,
});

const payload = JSON.stringify({ title, body, url });

for (const name of names) {
	const record = JSON.parse(
		wrangler(["kv", "key", "get", name, "--binding", "KV", "--local", "--env", "dev"]),
	);
	const request = await generatePushHTTPRequest({
		applicationServerKeys: keys,
		payload,
		target: {
			endpoint: record.endpoint,
			keys: { p256dh: record.keys.p256dh, auth: record.keys.auth },
		},
		urgency: "normal",
		ttl: 3600,
	});
	const response = await fetch(request.endpoint, {
		method: "POST",
		headers: request.headers,
		body: request.body,
	});
	console.log(`${name} -> ${response.status} ${response.statusText}`);
}
