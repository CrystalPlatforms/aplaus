import { Loader } from "@/components/Loader";

/**
 * Loading state of a view: only the spinner, centered on the screen — no
 * wordmark and no label. Non-interactive, so it never blocks taps on the
 * header while data loads.
 */
export function ViewLoader() {
	return (
		<div
			className="fixed inset-0 flex items-center justify-center pointer-events-none"
			aria-busy="true"
		>
			<Loader />
		</div>
	);
}
