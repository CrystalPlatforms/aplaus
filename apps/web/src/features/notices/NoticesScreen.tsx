/**
 * Ogłoszenia szkolne: najpierw streszczenie (3 linijki), pełny widok pod
 * /more/notices/notice/:id. Statusy: zakończone (Badge secondary), nadchodzące
 * (Badge z tekstem primary); aktualne ogłoszenia nie mają etykiety — norma,
 * nie wyróżnienie.
 */

import type { SchoolNotice } from "@repo/librus-client";
import { Badge } from "@/components/ui/badge";
import { ViewLoader } from "@/components/ViewLoader";
import { todayISO } from "@/features/dashboard/vm";
import { useRoute } from "@/lib/router";
import { useNotices } from "./queries";

type NoticeStatus = "past" | "active" | "future";

function noticeStatus(notice: SchoolNotice, today: string): NoticeStatus {
	if (notice.startDate === "") return "active";
	if (notice.startDate > today) return "future";
	if (notice.endDate !== "" && notice.endDate < today) return "past";
	return "active";
}

export function NoticesScreen() {
	const { data, isLoading, isError } = useNotices();
	const { navigate } = useRoute();

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać ogłoszeń.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	const today = todayISO();
	const notices = [...(data ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));

	return (
		<div className="flex flex-col gap-3">
			{notices.length === 0 && <p className="py-6 text-sm text-muted-foreground">Brak ogłoszeń.</p>}
			{notices.map((notice) => (
				<NoticeItem
					key={notice.id}
					notice={notice}
					status={noticeStatus(notice, today)}
					onOpen={() => navigate(`/more/notices/notice/${notice.id}`)}
				/>
			))}
		</div>
	);
}

function NoticeItem({
	notice,
	status,
	onOpen,
}: {
	notice: SchoolNotice;
	status: NoticeStatus;
	onOpen: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onOpen}
			className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm"
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm font-medium">{notice.subject}</p>
				<StatusBadge status={status} />
			</div>
			<p className="text-xs text-muted-foreground">
				od {notice.startDate} do {notice.endDate}
			</p>
			<p className="mt-1 text-sm whitespace-pre-line line-clamp-3">{notice.content}</p>
			<p className="mt-1 text-xs text-muted-foreground">{notice.addedByName ?? "-"}</p>
		</button>
	);
}

function StatusBadge({ status }: { status: NoticeStatus }) {
	if (status === "active") return null;
	if (status === "future") {
		return (
			<Badge variant="secondary" className="shrink-0 text-primary">
				Nadchodzące
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="shrink-0">
			Zakończone
		</Badge>
	);
}
