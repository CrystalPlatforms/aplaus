/**
 * Powiadomienia push: włączenie subskrypcji na tym urządzeniu + 8
 * przełączników per typ zdarzenia. Preferencje są per konto (serwer),
 * subskrypcja per urządzenie/przeglądarka.
 */
import { useEffect, useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import {
	getPushPreferences,
	isStandalone,
	PUSH_TYPE_LABELS,
	type PushPreferencesState,
	savePushPreferences,
	subscribeToPush,
	unsubscribeToPush,
} from "@/lib/push";

const DEFAULT_PREFS: PushPreferencesState = {
	grades: true,
	messages: true,
	notices: true,
	attendance: true,
	homework: true,
	notes: true,
	timetable: true,
	conferences: true,
};

/** iOS: push działa tylko z zainstalowanej PWA. */
function useRequiresInstall(): boolean {
	return !isStandalone() && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function NotificationsScreen() {
	const [enabled, setEnabled] = useState(false);
	const [prefs, setPrefs] = useState<PushPreferencesState>(DEFAULT_PREFS);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requiresInstall = useRequiresInstall();

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const [preferences, registration] = await Promise.all([
					getPushPreferences(),
					navigator.serviceWorker.getRegistration(),
				]);
				if (cancelled) return;
				setPrefs(preferences);
				const subscription = registration ? await registration.pushManager.getSubscription() : null;
				setEnabled(subscription !== null);
			} catch {
				if (!cancelled) setError("Nie udało się pobrać ustawień powiadomień.");
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	const toggleEnabled = async () => {
		setBusy(true);
		setError(null);
		try {
			if (enabled) {
				await unsubscribeToPush();
				setEnabled(false);
			} else {
				await subscribeToPush();
				setEnabled(true);
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Nie udało się zmienić subskrypcji.");
		} finally {
			setBusy(false);
		}
	};

	const toggleType = async (type: keyof PushPreferencesState) => {
		const next = { ...prefs, [type]: !prefs[type] };
		setPrefs(next);
		try {
			await savePushPreferences(next);
		} catch {
			setPrefs(prefs);
			setError("Nie udało się zapisać ustawień.");
		}
	};

	return (
		<div className="space-y-4">
			{requiresInstall && !enabled ? (
				<p className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
					Na iPhonie powiadomienia działają tylko w zainstalowanej aplikacji — najpierw przejdź do
					„Więcej → Instalacja aplikacji".
				</p>
			) : null}

			{error ? (
				<p
					role="alert"
					className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-4 py-3 text-sm text-red-800 dark:text-red-200"
				>
					{error}
				</p>
			) : null}

			<button
				type="button"
				onClick={() => void toggleEnabled()}
				disabled={busy}
				className="w-full rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-4 text-left"
			>
				<span className="flex items-center justify-between">
					<span className="text-sm font-semibold">
						{busy ? (
							<>
								<ButtonSpinner />
								{enabled ? "Wyłączanie…" : "Włączanie…"}
							</>
						) : (
							"Powiadomienia push na tym urządzeniu"
						)}
					</span>
					<span
						aria-hidden="true"
						className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
							enabled ? "bg-blue-600" : "bg-neutral-300 dark:bg-neutral-700"
						}`}
					>
						<span
							className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
								enabled ? "translate-x-[22px]" : "translate-x-0.5"
							}`}
						/>
					</span>
				</span>
				<span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
					{enabled ? "Włączone — nowa ocena dotrze w ≤ 5 minut." : "Wyłączone."}
				</span>
			</button>

			<section className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-neutral-100 dark:divide-neutral-800">
				<h2 className="px-4 py-3 text-sm font-semibold">Co powiadamiać</h2>
				{(Object.keys(PUSH_TYPE_LABELS) as Array<keyof PushPreferencesState>).map((type) => (
					<button
						key={type}
						type="button"
						role="switch"
						aria-checked={prefs[type]}
						onClick={() => void toggleType(type)}
						disabled={!enabled}
						className="w-full px-4 py-3.5 text-left text-sm disabled:opacity-50"
					>
						<span className="flex items-center justify-between">
							{PUSH_TYPE_LABELS[type]}
							<span
								aria-hidden="true"
								className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
									prefs[type] ? "bg-blue-600" : "bg-neutral-300 dark:bg-neutral-700"
								}`}
							>
								<span
									className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
										prefs[type] ? "translate-x-[22px]" : "translate-x-0.5"
									}`}
								/>
							</span>
						</span>
					</button>
				))}
			</section>
		</div>
	);
}
