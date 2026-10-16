/**
 * Ogłoszenia szkolne: najpierw streszczenie (3 linijki), pełny widok pod
 * /more/notices/notice/:id. Statusy: zakończone (szare), nadchodzące
 * (niebieskie); aktualne ogłoszenia nie mają etykiety — norma, nie wyróżnienie.
 */

import type { SchoolNotice } from "@repo/librus-client";
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
		return <p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać ogłoszeń.</p>;
	}
	if (isLoading) return <ViewLoader />;

	const today = todayISO();
	const notices = [...(data ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));

	return (
		<div className="flex flex-col gap-3">
			{notices.length === 0 && (
				<p className="py-6 text-sm text-neutral-500 dark:text-neutral-400">Brak ogłoszeń.</p>
			)}
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
			className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4 text-left w-full"
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm font-medium">{notice.subject}</p>
				<StatusBadge status={status} />
			</div>
			<p className="text-xs text-neutral-500 dark:text-neutral-400">
				od {notice.startDate} do {notice.endDate}
			</p>
			<p className="mt-1 text-sm whitespace-pre-line line-clamp-3">{notice.content}</p>
			<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
				{notice.addedByName ?? "-"}
			</p>
		</button>
	);
}

function StatusBadge({ status }: { status: NoticeStatus }) {
	if (status === "active") return null;
	if (status === "future") {
		return (
			<span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-full px-2 py-0.5 shrink-0">
				Nadchodzące
			</span>
		);
	}
	return (
		<span className="text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-full px-2 py-0.5 shrink-0">
			Zakończone
		</span>
	);
}
