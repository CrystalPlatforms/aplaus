/**
 * Readiness checks whether the KV binding answers. No database exists in this
 * app — the KV binding is the whole persistence layer, so "ready" means "KV
 * reachable".
 */
export type KvStatus = "available" | "unavailable";

/** One cheap read against the binding; any throw means KV is not usable. */
export async function checkKv(kv: unknown): Promise<KvStatus> {
	if (!isKvLike(kv)) return "unavailable";
	try {
		await kv.get("health:probe");
		return "available";
	} catch {
		return "unavailable";
	}
}

function isKvLike(kv: unknown): kv is KVNamespace {
	return typeof kv === "object" && kv !== null && typeof (kv as KVNamespace).get === "function";
}
