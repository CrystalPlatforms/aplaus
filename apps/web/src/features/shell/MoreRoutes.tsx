/** Routes under /more: the menu and the school-domain subviews. */

import { Card } from "@/components/ui/card";
import { AttendanceScreen } from "@/features/attendance/AttendanceScreen";
import { ConferenceDetailScreen } from "@/features/conferences/ConferenceDetailScreen";
import { ConferencesScreen } from "@/features/conferences/ConferencesScreen";
import { HomeworkScreen } from "@/features/homework/HomeworkScreen";
import { JustificationsScreen } from "@/features/justifications/JustificationsScreen";
import { MessagesSettingsScreen } from "@/features/messages/MessagesSettingsScreen";
import { NotesScreen } from "@/features/notes/NotesScreen";
import { NoticeDetailScreen } from "@/features/notices/NoticeDetailScreen";
import { NoticesScreen } from "@/features/notices/NoticesScreen";
import { NotificationsScreen } from "@/features/notifications/NotificationsScreen";
import { SchoolScreen } from "@/features/school/SchoolScreen";
import { useAuth } from "@/lib/auth";
import { useRoute } from "@/lib/router";
import { MORE_SECTIONS, PARENT_SECTIONS } from "./nav-items";
import { ThemeSwitch } from "./ThemeSwitch";

/** Routes under /more: the menu and the school-domain subviews. */
export function MoreRoutes() {
	const { path } = useRoute();
	if (path.startsWith("/more/homework")) {
		return <HomeworkScreen />;
	}
	if (path.startsWith("/more/attendance")) {
		return <AttendanceScreen />;
	}
	if (path.startsWith("/more/notices/notice/")) {
		const id = path.split("/").pop() ?? "";
		return <NoticeDetailScreen id={id} />;
	}
	if (path.startsWith("/more/notices")) {
		return <NoticesScreen />;
	}
	if (path.startsWith("/more/notes")) {
		return <NotesScreen />;
	}
	if (path.startsWith("/more/conferences/")) {
		const id = path.split("/").pop() ?? "";
		return <ConferenceDetailScreen id={id} />;
	}
	if (path.startsWith("/more/conferences")) {
		return <ConferencesScreen />;
	}
	if (path.startsWith("/more/school")) {
		return <SchoolScreen />;
	}
	if (path.startsWith("/more/justifications")) {
		return <JustificationsScreen />;
	}
	if (path.startsWith("/more/notifications")) {
		return <NotificationsScreen />;
	}
	if (path.startsWith("/settings")) {
		// The single settings hub: appearance (theme) + all message settings.
		return (
			<div className="flex flex-col gap-6">
				<ThemeSwitch />
				<MessagesSettingsScreen />
			</div>
		);
	}
	return <MoreMenu />;
}

/** The /more menu — same list as the sidebar's Więcej group. */
function MoreMenu() {
	const { navigate } = useRoute();
	const { account } = useAuth();
	const isParent = account?.groupId === 5;
	const sections = isParent ? [...MORE_SECTIONS, ...PARENT_SECTIONS] : MORE_SECTIONS;
	return (
		<Card className="divide-y divide-border gap-0 overflow-hidden py-0">
			{sections.map((s) => (
				<button
					key={s.id}
					type="button"
					onClick={() => navigate(s.path)}
					className="w-full px-4 py-4 text-left text-sm font-medium"
				>
					{s.label}
				</button>
			))}
		</Card>
	);
}
