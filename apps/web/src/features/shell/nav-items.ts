/**
 * Shell navigation model, shared by the mobile bottom bar (5 tabs) and the
 * desktop sidebar (full navigation). Icons come from @tabler/icons-react
 * (Tabler, outline, stroke-width 2) — one icon source for the whole app.
 */

import {
	IconBell,
	IconBook,
	IconCalendarMonth,
	IconDots,
	IconFileCheck,
	IconHome,
	IconList,
	IconMail,
	IconNote,
	IconSchool,
	IconSettings,
	IconSpeakerphone,
	IconUserCheck,
	IconUsers,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

type NavIcon = ComponentType<{
	className?: string;
	"aria-hidden"?: boolean | "true" | "false";
}>;

export interface NavItem {
	id: string;
	label: string;
	path: string;
	Icon: NavIcon;
	/** Tab id of the top-level tab this entry belongs to (for active states). */
	tab: "start" | "grades" | "plan" | "messages" | "more";
}

/** The five mobile tabs. */
export const TABS: Array<NavItem & { tab: "start" | "grades" | "plan" | "messages" | "more" }> = [
	{ id: "start", label: "Start", path: "/start", Icon: IconHome, tab: "start" },
	{ id: "grades", label: "Oceny", path: "/grades", Icon: IconList, tab: "grades" },
	{ id: "plan", label: "Plan", path: "/timetable", Icon: IconCalendarMonth, tab: "plan" },
	{ id: "messages", label: "Wiadomości", path: "/messages", Icon: IconMail, tab: "messages" },
	{ id: "more", label: "Więcej", path: "/more", Icon: IconDots, tab: "more" },
];

/** Sections under /more, rendered in the sidebar for desktop users. */
export const MORE_SECTIONS: NavItem[] = [
	{
		id: "homework",
		label: "Zadania domowe",
		path: "/more/homework",
		Icon: IconBook,
		tab: "more",
	},
	{
		id: "attendance",
		label: "Frekwencja",
		path: "/more/attendance",
		Icon: IconUserCheck,
		tab: "more",
	},
	{
		id: "notices",
		label: "Ogłoszenia",
		path: "/more/notices",
		Icon: IconSpeakerphone,
		tab: "more",
	},
	{ id: "notes", label: "Uwagi", path: "/more/notes", Icon: IconNote, tab: "more" },
	{
		id: "conferences",
		label: "Zebrania z rodzicami",
		path: "/more/conferences",
		Icon: IconUsers,
		tab: "more",
	},
	{ id: "school", label: "Szkoła i klasa", path: "/more/school", Icon: IconSchool, tab: "more" },
	{
		id: "settings",
		label: "Ustawienia",
		path: "/settings",
		Icon: IconSettings,
		tab: "more",
	},
	{
		id: "notifications",
		label: "Powiadomienia push",
		path: "/more/notifications",
		Icon: IconBell,
		tab: "more",
	},
];

/** Parent-only section (Librus groupId 5). */
export const PARENT_SECTIONS: NavItem[] = [
	{
		id: "justifications",
		label: "Usprawiedliwienia",
		path: "/more/justifications",
		Icon: IconFileCheck,
		tab: "more",
	},
];

/** Maps a path to its tab; defaults to grades for paths like /grades/subject. */
export function activeTabOf(path: string): NavItem["tab"] {
	if (path.startsWith("/start")) return "start";
	if (path.startsWith("/timetable")) return "plan";
	if (path.startsWith("/messages")) return "messages";
	if (path.startsWith("/settings")) return "more";
	if (path.startsWith("/more")) return "more";
	return "grades";
}

/**
 * Korzeń sekcji, gdy path jest jej PODSTRONĄ (detal, kompozycja, ustawienia —
 * ikona tej sekcji w bottom barze zamienia się wtedy w ←). Null na korzeniu
 * sekcji albo poza nią. Foldery wiadomości bez ID (/messages/inbox, /outbox)
 * to wciąż lista — nie podstrona. /settings podlega tabowi „Więcej".
 */
export function subpageRootOf(path: string): string | null {
	const tab = activeTabOf(path);
	if (tab === "start" || tab === "plan") return null;
	if (tab === "grades") {
		return path.startsWith("/grades/") ? "/grades" : null;
	}
	if (tab === "messages") {
		const isList =
			path === "/messages" || path === "/messages/inbox" || path === "/messages/outbox";
		return isList ? null : "/messages";
	}
	// tab === "more": /settings też należy do „Więcej".
	if (path === "/settings") return "/more";
	if (path === "/more" || path === "/more/") return null;
	return path.startsWith("/more/") ? "/more" : null;
}
