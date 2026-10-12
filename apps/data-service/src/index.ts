import { WorkerEntrypoint } from "cloudflare:workers";
import { App } from "@/hono/app";
import { assertCorsConfig } from "@/hono/middleware/cors";

export default class DataService extends WorkerEntrypoint<Env> {
	constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env);
		assertCorsConfig(env);
	}

	fetch(request: Request) {
		return App.fetch(request, this.env, this.ctx);
	}
}
