/**
 * The `x-baner` anti-bot header the OAuth login endpoint expects even though no
 * browser User-Agent is sent (protocol detail confirmed by the audit).
 *
 * Value shape: `<random>_<unix-milliseconds>`, where every character of both
 * parts has its Unicode code point shifted by +20.
 */
export function encodeBanerPart(value: string): string {
	let encoded = "";
	for (const char of value) {
		const code = char.codePointAt(0);
		if (code === undefined) continue;
		encoded += String.fromCodePoint(code + 20);
	}
	return encoded;
}

export function buildBaner(nowMs: number, randomPart: string): string {
	return `${encodeBanerPart(randomPart)}_${encodeBanerPart(String(nowMs))}`;
}

/** A random 15-digit decimal string — the "random value" half of the header. */
export function randomBanerPart(
	getRandomValues: (array: Uint8Array) => Uint8Array = crypto.getRandomValues.bind(crypto),
): string {
	const bytes = new Uint8Array(8);
	getRandomValues(bytes);
	let value = 0n;
	for (const byte of bytes) {
		value = (value << 8n) | BigInt(byte);
	}
	const min15Digits = 100000000000000n;
	const range = 900000000000000n;
	return (min15Digits + (value % range)).toString();
}
