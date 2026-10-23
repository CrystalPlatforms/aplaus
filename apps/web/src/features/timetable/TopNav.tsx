import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/use-media-query";
import { shiftTimetableMonth, shiftTimetableWeek, useTimetableNav } from "./nav-store";
import { useTimetableView } from "./view-store";
import { monthLabel, weekRangeLabel } from "./vm";

/**
 * The week/month navigation arrows for the shell TopBar's right group
 * (rendered at the left edge of the TopBar; the Miesiąc|Dzień toggle follows at the far
 * right, rendered by the TopBar itself). Below md the timetable is always
 * the day view, so the arrows navigate weeks even when the stored
 * preference is "month".
 */
export function TimetableRangeNav() {
	const isDesktop = useMediaQuery("(min-width: 768px)");
	const view = useTimetableView();
	const nav = useTimetableNav();
	const isMonth = isDesktop && view === "month";
	return (
		<div className="flex items-center gap-1 rounded-lg bg-muted p-1">
			<Button
				variant="ghost"
				size="icon"
				className="size-7"
				aria-label={isMonth ? "Poprzedni miesiąc" : "Poprzedni tydzień"}
				onClick={() => (isMonth ? shiftTimetableMonth(-1) : shiftTimetableWeek(-1))}
			>
				<LuChevronLeft aria-hidden="true" />
			</Button>
			<span className="min-w-24 px-1 text-center text-xs font-semibold">
				{isMonth ? monthLabel(nav.month) : weekRangeLabel(nav.weekStart)}
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="size-7"
				aria-label={isMonth ? "Następny miesiąc" : "Następny tydzień"}
				onClick={() => (isMonth ? shiftTimetableMonth(1) : shiftTimetableWeek(1))}
			>
				<LuChevronRight aria-hidden="true" />
			</Button>
		</div>
	);
}
