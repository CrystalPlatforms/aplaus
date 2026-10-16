/** Przełącznik motywu: jasny / ciemny / systemowy (segmented control). */
import { type Theme, useTheme } from "@/lib/theme";

const OPTIONS: Array<{ value: Theme; label: string }> = [
	{ value: "light", label: "Jasny" },
	{ value: "dark", label: "Ciemny" },
	{ value: "system", label: "System" },
];

export function ThemeSwitch() {
	const { theme, setTheme } = useTheme();
	return (
		<section className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
			<h2 className="text-sm font-semibold">Motyw</h2>
			<div
				role="radiogroup"
				aria-label="Motyw aplikacji"
				className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1"
			>
				{OPTIONS.map((option) => (
					// biome-ignore lint/a11y/useSemanticElements: segmented option — a button with aria-checked beats a hidden native radio here
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={theme === option.value}
						onClick={() => setTheme(option.value)}
						className={`rounded-lg py-2 text-xs font-medium transition-colors ${
							theme === option.value
								? "bg-white dark:bg-neutral-950 shadow-sm text-neutral-900 dark:text-neutral-100"
								: "text-neutral-600 dark:text-neutral-400"
						}`}
					>
						{option.label}
					</button>
				))}
			</div>
			<p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
				„System" podąża za ustawieniem wyglądu na urządzeniu
			</p>
		</section>
	);
}
