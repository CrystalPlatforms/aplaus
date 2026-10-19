/**
 * Shell layout: desktop sidebar (md+) with full navigation, mobile bottom
 * bar with icons, top bar (account actions on mobile, Odśwież on desktop),
 * the sub-routes under /more and /messages, and the account switcher dialog.
 * A path change remounts the view block with a fade + rise animation.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Loader } from "@/components/Loader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { StickyBack } from "@/components/StickyBack";
import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import { GradesScreen } from "@/features/grades/GradesScreen";
import { SubjectGradesScreen } from "@/features/grades/SubjectGradesScreen";
import { ComposeScreen } from "@/features/messages/ComposeScreen";
import { DraftsScreen } from "@/features/messages/DraftsScreen";
import { MessageDetailScreen } from "@/features/messages/MessageDetailScreen";
import { MessagesScreen } from "@/features/messages/MessagesScreen";
import { useUnreadCount } from "@/features/messages/queries";
import { TimetableScreen } from "@/features/timetable/TimetableScreen";
import { useAuth } from "@/lib/auth";
import { useRoute } from "@/lib/router";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { AccountSwitcher } from "./AccountSwitcher";
import { BottomBar } from "./BottomBar";
import { MoreRoutes } from "./MoreRoutes";
import { activeTabOf } from "./nav-items";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
	const { account, logout } = useAuth();
	const { path, navigate } = useRoute();
	const [switcherOpen, setSwitcherOpen] = useState(false);
	const queryClient = useQueryClient();
	const refresh = useCallback(() => queryClient.invalidateQueries(), [queryClient]);
	const { progress, refreshing } = usePullToRefresh(refresh);

	useEffect(() => {
		if (path === "/") navigate("/start");
	}, [path, navigate]);

	const activeTab = activeTabOf(path);

	const isSubject = path.startsWith("/grades/subject/");
	const isMessageDetail = /^\/messages\/(inbox|outbox)\/[^/]+$/.test(path);
	const replyForward = /^\/messages\/(inbox|outbox)\/([^/]+)\/(reply|forward)$/.exec(path);
	const isCompose = path === "/messages/compose" || /^\/messages\/compose\/[^/]+$/.test(path);
	const isDraftsList = path === "/messages/drafts";
	const unread = useUnreadCount();
	const badge = account ? (unread.data?.inbox ?? 0) : 0;

	return (
		<div className="min-h-dvh bg-background text-foreground">
			<div className="md:flex">
				<Sidebar unread={badge} onSwitchAccount={() => setSwitcherOpen(true)} />
				<div className="flex-1 min-w-0">
					<TopBar
						account={account}
						logout={logout}
						onSwitchAccount={() => setSwitcherOpen(true)}
						onRefresh={refresh}
					/>
					<OfflineBanner />
					{progress > 0 || refreshing ? (
						<div
							className="sticky top-14 z-[5] flex justify-center py-2"
							style={{ opacity: refreshing ? 1 : progress }}
							aria-hidden={!refreshing}
						>
							<div style={{ transform: refreshing ? undefined : `scale(${0.4 + progress * 0.6})` }}>
								<Loader />
							</div>
						</div>
					) : null}
					<main className="pb-24 md:pb-8 px-4 pt-4 max-w-xl md:max-w-3xl mx-auto">
						{isSubject ? (
							<SubjectGradesRoute />
						) : isCompose ? (
							<ComposeRoute />
						) : isDraftsList ? (
							<div>
								<StickyBack to="/messages" label="Wiadomości" />
								<DraftsScreen />
							</div>
						) : replyForward !== null ? (
							<ReplyForwardRoute match={replyForward} />
						) : isMessageDetail ? (
							<MessageDetailRoute />
						) : (
							<>
								{activeTab === "start" && <DashboardScreen />}
								{activeTab === "grades" && <GradesScreen />}
								{activeTab === "plan" && <TimetableScreen />}
								{activeTab === "messages" && <MessagesScreen />}
								{activeTab === "more" && <MoreRoutes />}
							</>
						)}
					</main>
				</div>
			</div>
			<BottomBar activeTab={activeTab} badge={badge} />
			<AccountSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
		</div>
	);
}

/** Compose route (/messages/compose, /messages/compose/:draftId). */
function ComposeRoute() {
	const { path } = useRoute();
	const parts = path.split("/");
	const draftId = parts.length > 3 ? (parts[3] ?? undefined) : undefined;
	return (
		<div>
			<StickyBack to="/messages" label="Wiadomości" />
			<ComposeScreen draftId={draftId} />
		</div>
	);
}

/** Reply/forward route (/messages/:folder/:id/reply|forward). */
function ReplyForwardRoute({ match }: { match: RegExpExecArray }) {
	const [, rawFolder, id, action] = match;
	const folder = rawFolder === "outbox" ? ("outbox" as const) : ("inbox" as const);
	const context = { folder, id: id ?? "" };
	const actionIsForward = action === "forward";
	return (
		<div>
			<StickyBack to={`/messages/${folder}/${id}`} label="Wiadomości" />
			<ComposeScreen
				replyTo={actionIsForward ? undefined : context}
				forwardOf={actionIsForward ? context : undefined}
			/>
		</div>
	);
}

/** Message detail route (/messages/inbox/:id, /messages/outbox/:id). */
function MessageDetailRoute() {
	const { path } = useRoute();
	const parts = path.split("/");
	const folder = parts[2] === "outbox" ? "outbox" : "inbox";
	const id = parts.pop() ?? "";
	return (
		<div>
			<StickyBack to="/messages" label="Wiadomości" />
			<MessageDetailScreen folder={folder} id={id} />
		</div>
	);
}

/** Subject grades page (/grades/subject/:id) — a full view, not a drawer. */
function SubjectGradesRoute() {
	const { path } = useRoute();
	const subjectId = path.split("/").pop() ?? "";
	return (
		<div>
			<StickyBack to="/grades" label="Oceny" />
			<SubjectGradesScreen subjectId={subjectId} />
		</div>
	);
}
