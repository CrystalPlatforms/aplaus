/**
 * Detail overlay on Radix Dialog: a CENTERED preview on every breakpoint —
 * like the desktop one — so the dimmed, blurred backdrop stays visible
 * around the sheet. Sizes are viewport-based and adapt to the phone
 * (~92vw × ~85dvh below md, ~90vw × ~85dvh from md up); the choice is made
 * purely in CSS. Escape, backdrop click and the X all close through one
 * onOpenChange entry point; focus is trapped by Radix.
 */
import type { ReactNode } from "react";
import { LuX } from "react-icons/lu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const sheetClasses = cn(
	// Centered on every breakpoint: the blurred backdrop stays visible around
	// the sheet. Viewport-based sizes adapt to the phone (dvh/vw). sm:/md:
	// max-w repeats the unprefixed value — responsive variants would otherwise
	// win over it in the stylesheet order.
	"fixed top-1/2 left-1/2 z-50 flex h-[85dvh] w-[92vw] max-w-[92vw] sm:max-w-[92vw] md:w-[90vw] md:max-w-[90vw] flex-col rounded-xl p-0 gap-0 -translate-x-1/2 -translate-y-1/2",
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
			className="flex items-center justify-between gap-3 px-6 py-4"
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
