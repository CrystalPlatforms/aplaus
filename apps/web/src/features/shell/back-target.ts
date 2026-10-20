/**
 * Maps a path to its TopBar back target — the single "Wróć" button in the
 * header. Top-level tabs have no back target (undefined).
 */
export type BackTarget = { to: string; label: string };

export function backTargetOf(path: string): BackTarget | undefined {
	if (path.startsWith("/grades/subject/")) return { to: "/grades", label: "Oceny" };
	// Reply/forward goes back to the message it started from, not the list.
	if (/^\/messages\/(inbox|outbox)\/[^/]+\/(reply|forward)$/.test(path)) {
		const match = /^\/messages\/((?:inbox|outbox)\/[^/]+)\//.exec(path);
		return { to: `/messages/${match?.[1] ?? ""}`, label: "Wiadomości" };
	}
	if (path.startsWith("/messages/")) return { to: "/messages", label: "Wiadomości" };
	// Detail routes must be checked before their list prefixes.
	if (path.startsWith("/more/notices/notice/")) return { to: "/more/notices", label: "Ogłoszenia" };
	if (path.startsWith("/more/conferences/")) return { to: "/more/conferences", label: "Zebrania" };
	if (path.startsWith("/more/")) return { to: "/more", label: "Więcej" };
	return undefined;
}
