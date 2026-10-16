/**
 * Instrukcja instalacji PWA. Android (Chrome) może zainstalować jednym
 * dotknięciem, gdy przeglądarka wystawi beforeinstallprompt; iOS wymaga
 * Safari i „Dodaj do ekranu głównego" — push (faza 12) działa na iOS tylko
 * z zainstalowanej PWA.
 */
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
	const ua = navigator.userAgent;
	const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
	if (/iPad|iPhone|iPod/.test(ua) || isIpadOs) return "ios";
	if (/Android/.test(ua)) return "android";
	return "other";
}

export function InstallScreen() {
	const [platform] = useState(detectPlatform);
	const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
	const [installed, setInstalled] = useState(false);

	useEffect(() => {
		const onPrompt = (event: Event) => {
			event.preventDefault();
			setPromptEvent(event as InstallPromptEvent);
		};
		window.addEventListener("beforeinstallprompt", onPrompt);
		return () => window.removeEventListener("beforeinstallprompt", onPrompt);
	}, []);

	const install = async () => {
		if (!promptEvent) return;
		await promptEvent.prompt();
		const choice = await promptEvent.userChoice;
		if (choice.outcome === "accepted") setInstalled(true);
		setPromptEvent(null);
	};

	return (
		<div className="space-y-4">
			{installed ? (
				<p className="rounded-2xl bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 px-4 py-3 text-sm text-green-800 dark:text-green-200">
					Aplikacja została zainstalowana. Znajdziesz ją na ekranie głównym.
				</p>
			) : null}

			{platform === "android" && promptEvent && !installed ? (
				<button
					type="button"
					onClick={() => void install()}
					className="w-full rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white"
				>
					Zainstaluj aplikację
				</button>
			) : null}

			<section className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
				<h2 className="text-sm font-semibold">Android — Chrome</h2>
				<ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
					<li>Otwórz menu Chrome (trzy kropki w prawym górnym rogu).</li>
					<li>Wybierz „Zainstaluj aplikację" albo „Dodaj do ekranu głównego".</li>
					<li>Potwierdź przyciskiem „Zainstaluj".</li>
				</ol>
			</section>

			<section className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
				<h2 className="text-sm font-semibold">iPhone / iPad — Safari</h2>
				<ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
					<li>Otwórz tę stronę w Safari (nie w Chrome — iOS instaluje PWA tylko z Safari).</li>
					<li>Dotknij przycisku „Udostępnij" (kwadrat ze strzałką w górę).</li>
					<li>Wybierz „Dodaj do ekranu głównego", potem „Dodaj".</li>
				</ol>
				<p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
					Powiadomienia push na iPhonie działają dopiero z zainstalowanej aplikacji.
				</p>
			</section>
		</div>
	);
}
