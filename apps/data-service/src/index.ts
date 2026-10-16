import { WorkerEntrypoint } from "cloudflare:workers";
import { App } from "@/hono/app";
import { assertCorsConfig } from "@/hono/middleware/cors";
import { defaultPollerDeps, runPollingCycle } from "@/hono/services/push-poller";

export default class DataService extends WorkerEntrypoint<Env> {
	constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env);
		assertCorsConfig(env);
	}

	fetch(request: Request) {
		return App.fetch(request, this.env, this.ctx);
	}

	/** Cron every 5 minutes: poll every account for changed resources, then push. */
	async scheduled(): Promise<void> {
		if (!this.env.VAPID_PUBLIC_KEY || !this.env.VAPID_PRIVATE_KEY) {
			// biome-ignore lint/suspicious/noConsole: workers logs are the cron's only observability
			console.log("[push] VAPID secrets not configured — cron skipped");
			return;
		}
		await runPollingCycle(this.env.KV, this.env, defaultPollerDeps());
	}
}
