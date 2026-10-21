import { setTimetableView, useTimetableView } from "./view-store";

/**
 * Miesiąc | Dzień segmented control for the shell TopBar (desktop only —
 * the toggle is rendered inside a `hidden md:flex` slot). State lives in
 * the timetable view store so the screen reacts without prop drilling.
 */
export function ViewToggle() {
	const view = useTimetableView();
	const options = [
		{ value: "month", label: "Miesiąc" },
		{ value: "day", label: "Dzień" },
	] as const;
	return (
		<div
			role="radiogroup"
			aria-label="Widok planu lekcji"
			className="flex gap-1 rounded-lg bg-muted p-1"
		>
			{options.map((option) => (
				// biome-ignore lint/a11y/useSemanticElements: segmented option — a button with aria-checked matches the CRS segmented controls
				<button
					key={option.value}
					type="button"
					role="radio"
					aria-checked={view === option.value}
					onClick={() => setTimetableView(option.value)}
					className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
						view === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
