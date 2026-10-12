import type { CookieRecord } from "./cookie-jar";

export function parseSetCookie(_header: string, _requestHost: string): CookieRecord | null {
	if (!_header.trim()) return null;
	const semicolon = _header.indexOf(";");
	const pair = semicolon === -1 ? _header : _header.slice(0, semicolon);
	const equals = pair.indexOf("=");
	const name = pair.slice(0, equals).trim();
	if (!name) return null;
	const record: CookieRecord = {
		name,
		value: equals === -1 ? "" : pair.slice(equals + 1).trim(),
		domain: _requestHost,
		path: "/",
	};
	for (const attribute of _header.split(";").slice(1)) {
		applyAttribute(record, attribute);
	}
	return record;
}

function attributeValue(attribute: string, equals2: number): string {
	return attribute.slice(equals2 + 1).trim();
}

function applyAttribute(record: CookieRecord, attribute: string): void {
	const equals2 = attribute.indexOf("=");
	const key = (equals2 === -1 ? attribute : attribute.slice(0, equals2)).trim().toLowerCase();
	if (key === "domain") {
		const raw = attributeValue(attribute, equals2);
		record.domain = raw.startsWith(".") ? raw : `.${raw}`;
	}
	if (key === "path") {
		record.path = attributeValue(attribute, equals2) || "/";
	}
	if (key === "expires") {
		const parsed = Date.parse(attributeValue(attribute, equals2));
		if (Number.isFinite(parsed)) {
			record.expires = Math.floor(parsed / 1000);
		}
	}
	if (key === "max-age") {
		const seconds = Number.parseInt(attributeValue(attribute, equals2), 10);
		if (Number.isFinite(seconds)) {
			record.expires = Math.floor(Date.now() / 1000) + seconds;
		}
	}
}

/** True when a cookie applies to a request URL: domain, path and expiry. */
export function appliesTo(cookie: CookieRecord, url: URL, nowSeconds: number): boolean {
	if (cookie.expires !== undefined && cookie.expires < nowSeconds) {
		return false;
	}
	if (cookie.domain.startsWith(".")) {
		const bare = cookie.domain.slice(1);
		if (url.hostname !== bare && !url.hostname.endsWith(cookie.domain)) {
			return false;
		}
	} else if (url.hostname !== cookie.domain) {
		return false;
	}
	return url.pathname.startsWith(cookie.path);
}
