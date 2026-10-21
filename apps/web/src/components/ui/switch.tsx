import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Radix Switch ported by hand (no CLI): token-colored track, white thumb.
 * Renders `role="switch"` + `aria-checked` for free — screens only pass
 * `checked` / `onCheckedChange` / `disabled` / `aria-label`.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				"peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					"bg-background pointer-events-none block size-5 rounded-full shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
