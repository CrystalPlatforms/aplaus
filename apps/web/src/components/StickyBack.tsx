/**
 * Back button pinned under the sticky header — visible while scrolling.
 * Styled with CRS-Theme tokens.
 */
import { LuChevronLeft } from "react-icons/lu";
import { useRoute } from "@/lib/router";

export function StickyBack({ to, label }: { to: string; label: string }) {
	const { navigate } = useRoute();
	return (
		<div className="sticky top-14 z-[5] -mx-4 px-4 py-2 bg-background/80 backdrop-blur border-b border-border">
			<button
				type="button"
				onClick={() => navigate(to)}
				className="text-sm font-medium text-primary flex items-center gap-1"
			>
				<LuChevronLeft className="size-4" aria-hidden="true" />
				{label}
			</button>
		</div>
	);
}
