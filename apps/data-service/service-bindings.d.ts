/**
 * `worker-configuration.d.ts` is generated from the dev environment alone, so
 * wrangler types the per-environment `vars` as dev's literal values (`"dev"`,
 * `""`). The same Worker code runs in staging and production, where those values
 * differ — widen them back to strings here.
 */
interface Env extends Omit<BaseEnv, "CLOUDFLARE_ENV" | "ALLOWED_ORIGINS"> {
	CLOUDFLARE_ENV: string;
	ALLOWED_ORIGINS: string;
	/** Web push secrets (./sync-secrets.sh, see .example.vars). Absent = the
	 * cron and the public-key endpoint degrade to a skip, never a failure. */
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_KEY?: string;
}
