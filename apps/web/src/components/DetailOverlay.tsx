/**
 * Responsive detail overlay on Radix Dialog: below md it docks to the
 * bottom edge (bottom sheet, rounded top); from md up it becomes a centered
 * preview (~90vw × ~85dvh). The choice is made purely in CSS — one component
 * for every breakpoint. Escape, backdrop click and the X all close through
 * one onOpenChange entry point; focus is trapped by Radix.
 */
import type { ReactNode } from "react";
import { LuX } from "react-icons/lu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const sheetClasses = cn(
	// Mobile: translate reset — the base DialogContent centers with
	// -translate-1/2, which would push the sheet half off-screen here.
	"fixed inset-x-0 bottom-0 top-auto left-0 flex w-full flex-col rounded-t-xl p-0 gap-0 max-h-[85dvh] translate-x-0 translate-y-0",
	"md:top-1/2 md:bottom-auto md:left-1/2 md:h-[85dvh] md:w-[90vw] md:max-w-[90vw] md:max-h-none md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl",
	"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-6",
	"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-6",
	"md:data-[state=open]:zoom-in-95 md:data-[state=closed]:zoom-out-95",
);

type DetailOverlayProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Rendered as the visible heading — the dialog's accessible name. */
	title: ReactNode;
	/** Optional action slot rendered in the sticky header, left of the X. */
	action?: ReactNode;
	className?: string;
	children: ReactNode;
};

export function DetailOverlay(props: DetailOverlayProps) {
	const { open, onOpenChange, title, action, className, children } = props;
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(sheetClasses, className)}
				aria-describedby={undefined}
				showCloseButton={false}
			>
				<OverlayHeader title={title} action={action} onOpenChange={onOpenChange} />
				<div data-slot="detail-overlay-body" className="min-h-0 flex-1 overflow-y-auto p-6">
					{children}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function OverlayHeader({
	title,
	action,
	onOpenChange,
}: {
	title: ReactNode;
	action?: ReactNode;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<div
			data-slot="detail-overlay-header"
			className="flex items-center justify-between gap-3 border-b px-6 py-4"
		>
			<DialogTitle className="min-w-0 truncate text-base">{title}</DialogTitle>
			{action ? <div className="shrink-0">{action}</div> : null}
			<button
				type="button"
				onClick={() => onOpenChange(false)}
				className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-1"
			>
				<LuX className="size-5" aria-hidden="true" />
				<span className="sr-only">Zamknij</span>
			</button>
		</div>
	);
}
