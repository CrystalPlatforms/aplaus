/** Routes under /more: the menu and the school-domain subviews. */

import { StickyBack } from "@/components/StickyBack";
import { AttendanceScreen } from "@/features/attendance/AttendanceScreen";
import { ConferenceDetailScreen } from "@/features/conferences/ConferenceDetailScreen";
import { ConferencesScreen } from "@/features/conferences/ConferencesScreen";
import { HomeworkScreen } from "@/features/homework/HomeworkScreen";
import { InstallScreen } from "@/features/install/InstallScreen";
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
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<HomeworkScreen />
			</div>
		);
	}
	if (path.startsWith("/more/attendance")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<AttendanceScreen />
			</div>
		);
	}
	if (path.startsWith("/more/notices/notice/")) {
		const id = path.split("/").pop() ?? "";
		return (
			<div>
				<StickyBack to="/more/notices" label="Ogłoszenia" />
				<NoticeDetailScreen id={id} />
			</div>
		);
	}
	if (path.startsWith("/more/notices")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<NoticesScreen />
			</div>
		);
	}
	if (path.startsWith("/more/notes")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<NotesScreen />
			</div>
		);
	}
	if (path.startsWith("/more/conferences/")) {
		const id = path.split("/").pop() ?? "";
		return (
			<div>
				<StickyBack to="/more/conferences" label="Zebrania" />
				<ConferenceDetailScreen id={id} />
			</div>
		);
	}
	if (path.startsWith("/more/conferences")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<ConferencesScreen />
			</div>
		);
	}
	if (path.startsWith("/more/school")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<SchoolScreen />
			</div>
		);
	}
	if (path.startsWith("/more/justifications")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<JustificationsScreen />
			</div>
		);
	}
	if (path.startsWith("/more/install")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<InstallScreen />
			</div>
		);
	}
	if (path.startsWith("/more/notifications")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<NotificationsScreen />
			</div>
		);
	}
	if (path.startsWith("/more/messages-settings")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
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
		<div className="space-y-4">
			<ThemeSwitch />
			<div className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800">
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
			</div>
		</div>
	);
}
