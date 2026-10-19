/**
 * Shell navigation model, shared by the mobile bottom bar (5 tabs) and the
 * desktop sidebar (full navigation). Icons come from react-icons/lu (Lucide
 * style), imported per icon.
 */
import type { ComponentType } from "react";
import {
	LuBell,
	LuBookOpen,
	LuCalendarDays,
	LuDownload,
	LuEllipsis,
	LuFileCheck,
	LuGraduationCap,
	LuHouse,
	LuMail,
	LuMegaphone,
	LuSchool,
	LuSettings,
	LuStickyNote,
	LuUserCheck,
	LuUsers,
} from "react-icons/lu";

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
	{ id: "start", label: "Start", path: "/start", Icon: LuHouse, tab: "start" },
	{ id: "grades", label: "Oceny", path: "/grades", Icon: LuGraduationCap, tab: "grades" },
	{ id: "plan", label: "Plan", path: "/timetable", Icon: LuCalendarDays, tab: "plan" },
	{ id: "messages", label: "Wiadomości", path: "/messages", Icon: LuMail, tab: "messages" },
	{ id: "more", label: "Więcej", path: "/more", Icon: LuEllipsis, tab: "more" },
];

/** Sections under /more, rendered in the sidebar for desktop users. */
export const MORE_SECTIONS: NavItem[] = [
	{
		id: "homework",
		label: "Zadania domowe",
		path: "/more/homework",
		Icon: LuBookOpen,
		tab: "more",
	},
	{
		id: "attendance",
		label: "Frekwencja",
		path: "/more/attendance",
		Icon: LuUserCheck,
		tab: "more",
	},
	{ id: "notices", label: "Ogłoszenia", path: "/more/notices", Icon: LuMegaphone, tab: "more" },
	{ id: "notes", label: "Uwagi", path: "/more/notes", Icon: LuStickyNote, tab: "more" },
	{
		id: "conferences",
		label: "Zebrania z rodzicami",
		path: "/more/conferences",
		Icon: LuUsers,
		tab: "more",
	},
	{ id: "school", label: "Szkoła i klasa", path: "/more/school", Icon: LuSchool, tab: "more" },
	{
		id: "messages-settings",
		label: "Wiadomości — ustawienia",
		path: "/more/messages-settings",
		Icon: LuSettings,
		tab: "more",
	},
	{
		id: "install",
		label: "Instalacja aplikacji",
		path: "/more/install",
		Icon: LuDownload,
		tab: "more",
	},
	{
		id: "notifications",
		label: "Powiadomienia push",
		path: "/more/notifications",
		Icon: LuBell,
		tab: "more",
	},
];

/** Parent-only section (Librus groupId 5). */
export const PARENT_SECTIONS: NavItem[] = [
	{
		id: "justifications",
		label: "Usprawiedliwienia",
		path: "/more/justifications",
		Icon: LuFileCheck,
		tab: "more",
	},
];

/** Maps a path to its tab; defaults to grades for paths like /grades/subject. */
export function activeTabOf(path: string): NavItem["tab"] {
	if (path.startsWith("/start")) return "start";
	if (path.startsWith("/timetable")) return "plan";
	if (path.startsWith("/messages")) return "messages";
	if (path.startsWith("/more")) return "more";
	return "grades";
}
