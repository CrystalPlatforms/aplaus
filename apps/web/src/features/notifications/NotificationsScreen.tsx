/**
 * Powiadomienia push: włączenie subskrypcji na tym urządzeniu + 8
 * przełączników per typ zdarzenia (Radix Switch). Preferencje są per konto
 * (serwer), subskrypcja per urządzenie/przeglądarka.
 */
import { useEffect, useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
				<p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
					Na iPhonie powiadomienia działają tylko w zainstalowanej aplikacji — dodaj ją do ekranu
					głównego w Safari (Udostępnij → Dodaj do ekranu głównego).
				</p>
			) : null}

			{error ? (
				<p
					role="alert"
					className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
				>
					{error}
				</p>
			) : null}

			<Card className="flex-row items-center justify-between gap-3 p-4">
				<span className="min-w-0">
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
					<span className="mt-1 block text-xs text-muted-foreground">
						{enabled ? "Włączone — nowa ocena dotrze w ≤ 5 minut." : "Wyłączone."}
					</span>
				</span>
				<Switch
					checked={enabled}
					disabled={busy}
					onCheckedChange={() => void toggleEnabled()}
					aria-label="Powiadomienia push na tym urządzeniu"
				/>
			</Card>

			<Card className="divide-y divide-border gap-0 overflow-hidden py-0">
				<h2 className="px-4 py-3 text-sm font-semibold">Co powiadamiać</h2>
				{(Object.keys(PUSH_TYPE_LABELS) as Array<keyof PushPreferencesState>).map((type) => (
					<div key={type} className="flex items-center justify-between gap-3 px-4 py-3.5">
						<span className="text-sm">{PUSH_TYPE_LABELS[type]}</span>
						<Switch
							checked={prefs[type]}
							disabled={!enabled}
							onCheckedChange={() => void toggleType(type)}
							aria-label={PUSH_TYPE_LABELS[type]}
						/>
					</div>
				))}
			</Card>
		</div>
	);
}
