/**
 * Ambient types for webpush-webcrypto (the package ships no .d.ts).
 * Only the surface the Worker uses.
 */
declare module "webpush-webcrypto" {
	export class ApplicationServerKeys {
		static generate(): Promise<ApplicationServerKeys>;
		/** Keys as produced by toJSON(): base64url strings. */
		static fromJSON(keys: {
			publicKey: string;
			privateKey: string;
		}): Promise<ApplicationServerKeys>;
		toJSON(): Promise<{ publicKey: string; privateKey: string }>;
	}

	export interface PushRequestParts {
		headers: Record<string, string>;
		body: string | ArrayBuffer;
		endpoint: string;
	}

	export function generatePushHTTPRequest(options: {
		applicationServerKeys: ApplicationServerKeys;
		/** Serialized JSON payload; encrypted to the subscription keys. */
		payload: string;
		target: {
			endpoint: string;
			keys: { p256dh: string; auth: string };
		};
		adminContact?: string;
		ttl?: number;
		urgency?: "very-low" | "low" | "normal" | "high";
	}): Promise<PushRequestParts>;
}
