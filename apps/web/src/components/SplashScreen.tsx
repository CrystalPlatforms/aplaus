import { Loader } from "@/components/Loader";

/**
 * The app's only true splash, shown while the session boots: the spinner is
 * the first thing on screen, the wordmark fades in under it a beat later.
 */
export function SplashScreen() {
	return (
		<div className="min-h-dvh flex flex-col items-center justify-center gap-4" aria-busy="true">
			<Loader />
			<p className="font-display splash-title text-4xl font-bold tracking-tight">Aplaus</p>
		</div>
	);
}
