/** Przełącznik motywu: jasny / ciemny / systemowy (segmented control). */
import { Card } from "@/components/ui/card";
import { type Theme, useTheme } from "@/lib/theme";

const OPTIONS: Array<{ value: Theme; label: string }> = [
	{ value: "light", label: "Jasny" },
	{ value: "dark", label: "Ciemny" },
	{ value: "system", label: "System" },
];

export function ThemeSwitch() {
	const { theme, setTheme } = useTheme();
	return (
		<Card className="gap-0 p-4">
			<h2 className="text-sm font-semibold">Motyw</h2>
			<div
				role="radiogroup"
				aria-label="Motyw aplikacji"
				className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
			>
				{OPTIONS.map((option) => (
					// biome-ignore lint/a11y/useSemanticElements: segmented option — a button with aria-checked beats a hidden native radio here
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={theme === option.value}
						onClick={() => setTheme(option.value)}
						className={`rounded-md py-2 text-xs font-medium transition-colors ${
							theme === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
						}`}
					>
						{option.label}
					</button>
				))}
			</div>
			<p className="mt-2 text-xs text-muted-foreground">
				„System" podąża za ustawieniem wyglądu na urządzeniu
			</p>
		</Card>
	);
}
