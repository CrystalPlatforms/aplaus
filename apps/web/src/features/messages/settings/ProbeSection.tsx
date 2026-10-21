import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { useClientScan, useMessagesProbe, useReceiverTypes } from "../queries";
import { SectionCard } from "./SectionCard";

const selectClasses =
	"w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs";

/** Tester diagnostyczny (HITL r.3): odpytuje kandydujące endpointy Librusa żywą sesją M. */
export function ProbeSection() {
	const types = useReceiverTypes();
	const probe = useMessagesProbe();
	const scan = useClientScan();
	const [typeId, setTypeId] = useState("");
	const [copied, setCopied] = useState(false);
	const chosen = typeId !== "" ? typeId : (types.data?.[0]?.id ?? "");
	const rows = probe.data ?? [];
	const report = rows.map((r) => `${r.method} /${r.path} → ${r.status} ${r.body}`).join("\n");
	const scanReport = [
		scan.data?.landingUrl !== null && scan.data?.landingUrl !== undefined
			? `START (synergia/wiadomosci3 →): ${scan.data.landingUrl}`
			: "START: (ścieżka synergia/wiadomosci3 nie dowiozła — sesja G martwa?)",
		...(scan.data?.candidates ?? []).map(
			(c) => `KANDYDAT ${c.path} → ${c.status} [${c.kind}] ${c.title}`,
		),
		scan.data?.entryPath !== null && scan.data?.entryPath !== undefined
			? `WEJŚCIE: ${scan.data.entryPath} — "${scan.data.entryTitle}" | ${scan.data.entrySnippet}`
			: "WEJŚCIE: (brak strony aplikacji — sesja może być martwa)",
		...(scan.data?.scripts ?? []).map((s) => `JS: ${s}`),
		...(scan.data?.matches ?? []).map((m) => `[${m.label}] ${m.snippet}`),
	].join("\n");
	// Wszystkie 401 = wygasła sesja M (i nie dało się jej odnowić) — tester
	// mierzy wtedy stronę logowania, nie Librusa.
	const sessionExpired = rows.length > 0 && rows.every((r) => r.status === 401);

	async function run() {
		setCopied(false);
		if (chosen !== "") await probe.mutateAsync(chosen);
	}

	return (
		<SectionCard title="Tester diagnostyczny Librusa">
			<div className="flex flex-col gap-2 px-4 py-3">
				<p className="text-xs text-muted-foreground">
					Sprawdza, które endpointy Librusa odpowiadają na tym koncie (lista odbiorców, etykiety,
					grupy). Test może utworzyć pozycje próbne „Probe-Aplaus” — usuń je potem z list powyżej.
				</p>
				<select
					aria-label="Kategoria odbiorców do testu"
					value={chosen}
					onChange={(e) => setTypeId(e.target.value)}
					className={selectClasses}
				>
					{(types.data ?? []).map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
				<Button
					className="self-start"
					onClick={() => void run()}
					disabled={probe.isPending || chosen === ""}
				>
					{probe.isPending ? (
						<>
							<ButtonSpinner />
							Sprawdzam…
						</>
					) : (
						"Uruchom test"
					)}
				</Button>
				{probe.isError && (
					<p className="text-xs text-destructive">
						{probe.error instanceof Error ? probe.error.message : "Test nie udał się."}
					</p>
				)}
				{sessionExpired && (
					<p
						role="alert"
						className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
					>
						Sesja Librusa wygasła — wyloguj się i zaloguj ponownie, potem uruchom test jeszcze raz.
					</p>
				)}
				{rows.length > 0 && (
					<div className="flex flex-col gap-2">
						<pre className="max-h-72 overflow-auto rounded-xl bg-muted p-3 text-[0.625rem] leading-4 break-all whitespace-pre-wrap">
							{report}
						</pre>
						<Button
							variant="outline"
							size="sm"
							className="self-start"
							onClick={() => {
								void navigator.clipboard.writeText(report);
								setCopied(true);
							}}
						>
							Kopiuj wynik
						</Button>
						{copied && <p className="text-xs text-primary">Skopiowano — wklej wynik w rozmowie.</p>}
					</div>
				)}
				<hr className="border-border" />
				<p className="text-xs text-muted-foreground">
					Skaner kodu klienta Librusa pobiera paczkę JS oficjalnej aplikacji wiadomości (Twoją
					sesją) i szuka w niej prawdziwych endpointów odbiorców oraz formatu koloru etykiet —
					dokładnie to samo źródło, z którego korzystał audyt.
				</p>
				<Button
					className="self-start"
					onClick={() => void scan.mutateAsync(undefined)}
					disabled={scan.isPending}
				>
					{scan.isPending ? (
						<>
							<ButtonSpinner />
							Skanowanie…
						</>
					) : (
						"Skanuj kod klienta Librusa"
					)}
				</Button>
				{scan.isError && (
					<p className="text-xs text-destructive">
						{scan.error instanceof Error ? scan.error.message : "Skan nie udał się."}
					</p>
				)}
				{scan.data !== undefined && (
					<div className="flex flex-col gap-2">
						<pre>{scanReport}</pre>
						{(scan.data?.matches.length ?? 0) === 0 && (
							<p className="text-xs text-destructive">
								Skaner nic nie znalazł — najpewniej sesja wygasła i skan trafił na stronę logowania.
								Zaloguj się ponownie i spróbuj jeszcze raz.
							</p>
						)}
						<Button
							variant="outline"
							size="sm"
							className="self-start"
							onClick={() => {
								void navigator.clipboard.writeText(scanReport);
								setCopied(true);
							}}
						>
							Kopiuj wynik skanera
						</Button>
					</div>
				)}
			</div>
		</SectionCard>
	);
}
