/**
 * Skaner kodu klienta Librusa (HITL r.9): wchodzi PRAWDZIWĄ ścieżką klienta
 * (synergia/wiadomosci3 → przekierowania → aplikacja na wiadomosci.librus.pl,
 * z sesją główną G) i skanuje HTML + paczki JS (także dynamiczne chunki)
 * wyciągając prawdziwe kontrakty: endpointy odbiorców i format `colorRgb`.
 * Raport pokazuje, co dokładnie zeskanowano — pusty wynik jest diagnozowalny.
 */
import type { CookieJar } from "./cookie-jar";
import { defaultDeps, type HttpDeps, walkRedirects } from "./http";

export interface ClientScanMatch {
	/** What the snippet proves (endpoint / colorRgb / tagi). */
	label: string;
	snippet: string;
}

interface ClientScanCandidate {
	path: string;
	status: number;
	title: string;
	/** Stary portal („Flash Player”) albo strona logowania — niekandydat. */
	kind: "stara-aplikacja" | "logowanie" | "aplikacja" | "inne";
}

export interface ClientScanResult {
	/** URL, na który dowiozła nas ścieżka synergia/wiadomosci3 (null = nie doszło). */
	landingUrl: string | null;
	entryPath: string | null;
	candidates: ClientScanCandidate[];
	entryTitle: string;
	entrySnippet: string;
	scripts: string[];
	matches: ClientScanMatch[];
}

const M_BASE = "https://wiadomosci.librus.pl/";
const UA = "librus-api-verification/1.0";

/** Fallback candidate paths on the M domain (the real app rides the G chain). */
const ENTRY_CANDIDATES = ["", "wiadomosci3", "!messages_v2", "messages_v2", "app"];

function titleOf(html: string): string {
	const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
	return match?.[1]?.trim() ?? "";
}

function kindOf(html: string): ClientScanCandidate["kind"] {
	if (/Flash Player/i.test(html)) return "stara-aplikacja";
	if (/<form[^>]+password|Zaloguj się|login_form/i.test(html)) return "logowanie";
	if (/<script/i.test(html)) return "aplikacja";
	return "inne";
}

async function fetchText(url: string, jar: CookieJar, deps: HttpDeps): Promise<string | null> {
	try {
		const walk = await walkRedirects(
			url,
			{ method: "GET", headers: { Accept: "text/html,application/json,*/*", "User-Agent": UA } },
			jar,
			deps,
		);
		const text = await walk.response.text();
		return text.length > 0 ? text : null;
	} catch {
		return null;
	}
}

/** Unique snippets, capped — the report has to stay pasteable. */
function collectMatches(
	text: string,
	patterns: { label: string; re: RegExp }[],
): ClientScanMatch[] {
	const out: ClientScanMatch[] = [];
	const seen = new Set<string>();
	for (const { label, re } of patterns) {
		const found = text.match(re) ?? [];
		for (const raw of found.slice(0, 25)) {
			const start = Math.max(0, text.indexOf(raw) - 60);
			const snippet = text.slice(start, start + raw.length + 140).replace(/\s+/g, " ");
			const key = `${label}:${snippet}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ label, snippet });
			if (out.length >= 60) return out;
		}
	}
	return out;
}

const SCAN_PATTERNS: { label: string; re: RegExp }[] = [
	{ label: "endpoint-odbiorcy", re: /api\/[A-Za-z0-9/_.${}-]*[Rr]eceiver[A-Za-z0-9/_.${}-]*/g },
	{ label: "sciezka-receiver", re: /[`"'][^`"']{0,60}receiver[^`"']{0,60}[`"']/gi },
	{ label: "colorRgb", re: /colorRgb[^,;})]{0,140}/g },
	{ label: "tags-post", re: /[`"']tags\/?[A-Za-z0-9/_.-]*[`"']/g },
	{ label: "color-field", re: /colou?r[A-Za-z]{0,12}\s*[:=][^;,)]{0,80}/g },
];

/**
 * Scans the official client's code. The primary route replays the real client
 * entry (synergia/wiadomosci3 with the G jar); the M-domain candidates stay
 * as a fallback. Never throws — the report says what was (not) scanned.
 */
export async function scanMessagesClient(
	gJar: CookieJar,
	mJar: CookieJar,
	deps: HttpDeps = defaultDeps,
): Promise<ClientScanResult> {
	const candidates: ClientScanCandidate[] = [];
	let entryPath: string | null = null;
	let html: string | null = null;
	let base = new URL("/", M_BASE);
	let landingUrl: string | null = null;

	// 1) Prawdziwa ścieżka klienta: synergia/wiadomosci3 z sesją G.
	try {
		const walk = await walkRedirects(
			"https://synergia.librus.pl/wiadomosci3",
			{ method: "GET", headers: { Accept: "text/html", "User-Agent": UA } },
			gJar,
			deps,
		);
		landingUrl = walk.url.toString();
		const text = await walk.response.text();
		const kind = kindOf(text);
		candidates.push({
			path: landingUrl,
			status: walk.response.status,
			title: titleOf(text),
			kind,
		});
		if (walk.url.hostname.endsWith("wiadomosci.librus.pl") && kind === "aplikacja") {
			html = text;
			entryPath = landingUrl;
			base = new URL(landingUrl);
		}
	} catch {
		/* łańcuch niemożliwy (np. sesja G martwa) — fallback niżej */
	}

	// 2) Fallback: kandydaci na domenie M z sesją M.
	if (html === null) {
		for (const candidate of ENTRY_CANDIDATES) {
			const text = await fetchText(new URL(candidate, M_BASE).toString(), mJar, deps);
			const kind = text === null ? "inne" : kindOf(text);
			candidates.push({
				path: candidate === "" ? "/" : `/${candidate}`,
				status: text === null ? 0 : 200,
				title: text === null ? "" : titleOf(text),
				kind,
			});
			if (text !== null && kind === "aplikacja" && entryPath === null) {
				entryPath = candidate === "" ? "/" : `/${candidate}`;
				html = text;
				base = new URL(entryPath, M_BASE);
			}
		}
	}

	const result: ClientScanResult = {
		landingUrl,
		entryPath,
		candidates,
		entryTitle: html === null ? "" : titleOf(html),
		entrySnippet:
			html === null
				? ""
				: html
						.replace(/<[^>]+>/g, " ")
						.replace(/\s+/g, " ")
						.trim()
						.slice(0, 200),
		scripts: [],
		matches: [],
	};
	if (html === null) return result;

	// Sama strona wejściowa też może nieść kontrakty (inline JS).
	result.matches.push(...collectMatches(html, SCAN_PATTERNS));

	// URL-e paczek JS z HTML: script src + modulepreload. Kolejka z
	// deduplikacją — bez zalewania jednym fragmentem (poprzednio „et.js”
	// z ogonków nazw zjadł wszystkie sloty).
	const isVendor = /react|moment|scheduler|sentry|vendor|jquery/i;
	const queue: string[] = [];
	const pushed = new Set<string>();
	const push = (candidate: string, from: string): void => {
		try {
			const url = new URL(candidate, from).toString();
			if (pushed.has(url) || isVendor.test(url)) return;
			pushed.add(url);
			queue.push(url);
		} catch {
			/* zignoruj niepoprawny URL */
		}
	};
	for (const match of html.matchAll(
		/<(?:script[^>]*?src|link[^>]*?href)=["']([^"']+\.m?js)["']/gi,
	)) {
		const src = match[1];
		if (src === undefined) continue;
		push(src, base.toString());
		if (queue.length >= 12) break;
	}

	// Paczki z logiką aplikacji to lazy chunki — skanujemy po nazewnictwie
	// Vite: Nazwa-HASH.js (myślnik + hasz odfiltrowują śmieci typu „et.js”).
	const scanned: string[] = [];
	while (queue.length > 0 && scanned.length < 40 && result.matches.length < 120) {
		const url = queue.shift();
		if (url === undefined) break;
		try {
			const response = await deps.fetch(url, { headers: { "User-Agent": UA } });
			if (!response.ok) continue;
			const text = await response.text();
			if (text.length > 12_000_000) continue;
			scanned.push(url);
			result.matches.push(...collectMatches(text, SCAN_PATTERNS));
			for (const chunk of text.matchAll(/["'`]([A-Za-z0-9_./-]*-[A-Za-z0-9_-]{3,}\.m?js)["'`]/g)) {
				const name = chunk[1];
				if (name === undefined) continue;
				push(name, url);
				if (pushed.size >= 64) break;
			}
		} catch {
			/* pojedyncza paczka może się nie pobrać — skanuj dalej */
		}
	}
	result.scripts = scanned;

	// 5) Polowanie na STARY moduł wiadomości — formularz etykiet ze zrzutów
	// użytkownika to stare HTML-owe UI (synergia + ramki iframe). Szukamy
	// formularzy (action!), polskich napisów i endpointów modules/msg.
	const huntPatterns: { label: string; re: RegExp }[] = [
		...SCAN_PATTERNS,
		{ label: "formularz", re: /<form[^>]{0,300}>/gi },
		{ label: "etykiety-html", re: /Etykiet[\s\S]{0,220}/gi },
		{ label: "stare-api", re: /modules\/(?:msg|mail)[A-Za-z0-9/_.?=&-]*/g },
	];
	for (const target of ["https://synergia.librus.pl/wiadomosci"]) {
		const text = await fetchText(target, gJar, deps);
		if (text === null) continue;
		result.matches.push(...collectMatches(text, huntPatterns));
		for (const frame of text.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
			const src = frame[1];
			if (src === undefined) continue;
			try {
				const frameText = await fetchText(new URL(src, target).toString(), gJar, deps);
				if (frameText !== null) {
					result.matches.push(...collectMatches(frameText, huntPatterns));
				}
			} catch {
				/* zły src ramki — dalej */
			}
			if (result.matches.length >= 120) break;
		}
	}
	result.matches = result.matches.slice(0, 120);
	return result;
}
