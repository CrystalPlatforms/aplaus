/**
 * Ustawienia wiadomości (Faza 10): CRUD podpisów, etykiet i własnych grup
 * odbiorców. Kontrakty Librusa są z kodu klienta (HITL per operacja); UI
 * celowo zwięzłe — jedna sekcja na zasób.
 */

import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { ViewLoader } from "@/components/ViewLoader";
import {
	useClientScan,
	useCreateGroup,
	useCreateSignature,
	useCreateTag,
	useCustomGroups,
	useDeleteGroup,
	useDeleteSignature,
	useDeleteTag,
	useMessagesProbe,
	useReceiverTypes,
	useSignatures,
	useTags,
} from "./queries";

/** Główny ekran: trzy sekcje zarządzania. */
export function MessagesSettingsScreen() {
	return (
		<div className="flex flex-col gap-6">
			<SignaturesSection />
			<TagsSection />
			<GroupsSection />
			<ProbeSection />
		</div>
	);
}

/** Jedna sekcja = karta z listą i formularzem dodawania. */
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800">
			<h2 className="px-4 py-3 text-sm font-semibold">{title}</h2>
			{children}
		</section>
	);
}

function SignaturesSection() {
	const signatures = useSignatures();
	const createSignature = useCreateSignature();
	const deleteSignature = useDeleteSignature();
	const [name, setName] = useState("");
	const [content, setContent] = useState("");
	const [error, setError] = useState<string | null>(null);

	if (signatures.isLoading) return <ViewLoader />;

	async function onCreate() {
		setError(null);
		if (name.trim() === "" || content.trim() === "") {
			setError("Podaj nazwę i treść podpisu.");
			return;
		}
		try {
			await createSignature.mutateAsync({
				name: name.trim(),
				content,
				defaultForNewThreads: false,
				defaultForReplies: false,
			});
			setName("");
			setContent("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się dodać podpisu.");
		}
	}

	async function onDelete(id: string) {
		setError(null);
		try {
			await deleteSignature.mutateAsync(id);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się usunąć podpisu.");
		}
	}

	return (
		<SectionCard title="Podpisy">
			{error && <p className="px-4 py-2 text-xs text-red-500">{error}</p>}
			<div className="px-4 py-3 flex flex-col gap-2">
				<input
					aria-label="Nazwa podpisu"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Nazwa podpisu"
					className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
				/>
				<textarea
					aria-label="Treść podpisu"
					value={content}
					onChange={(e) => setContent(e.target.value)}
					rows={3}
					placeholder="Treść podpisu"
					className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
				/>
				<button
					type="button"
					onClick={() => void onCreate()}
					disabled={createSignature.isPending}
					className="self-start rounded-xl bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900 disabled:opacity-50"
				>
					{createSignature.isPending ? (
						<>
							<ButtonSpinner />
							Dodawanie…
						</>
					) : (
						"Dodaj podpis"
					)}
				</button>
			</div>
			<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
				{(signatures.data ?? []).map((s) => (
					<li key={s.id} className="px-4 py-2.5 flex items-center gap-2">
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium truncate">{s.name}</p>
							<p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
								{s.content ?? ""}
							</p>
						</div>
						<button
							type="button"
							aria-label={`Usuń podpis ${s.name}`}
							onClick={() => void onDelete(s.id)}
							disabled={deleteSignature.isPending}
							className="shrink-0 text-sm text-red-600 dark:text-red-400 disabled:opacity-50"
						>
							{deleteSignature.isPending && deleteSignature.variables === s.id ? (
								<>
									<ButtonSpinner />
									Usuwanie…
								</>
							) : (
								"Usuń"
							)}
						</button>
					</li>
				))}
				{(signatures.data?.length ?? 0) === 0 && (
					<li className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
						Brak podpisów.
					</li>
				)}
			</ul>
		</SectionCard>
	);
}

/** Paleta Librusa (zrzut oficjalnego formularza): nazwy kolorów CSS. */
const TAG_PALETTE = [
	"khaki",
	"lightskyblue",
	"lightsteelblue",
	"aliceblue",
	"azure",
	"beige",
	"blanchedalmond",
	"cornsilk",
	"darkgray",
	"darkkhaki",
	"darkseagreen",
	"gainsboro",
	"goldenrod",
	"lavender",
	"lightsalmon",
	"limegreen",
	"mediumaquamarine",
	"silver",
	"tan",
	"blue",
	"mediumslateblue",
	"mediumorchid",
	"lightpink",
	"deeppink",
	"crimson",
	"red",
	"darkorange",
	"gold",
	"greenyellow",
	"lawngreen",
];

function TagsSection() {
	const tags = useTags();
	const createTag = useCreateTag();
	const deleteTag = useDeleteTag();
	const [name, setName] = useState("");
	const [color, setColor] = useState("khaki");
	const [error, setError] = useState<string | null>(null);

	if (tags.isLoading) return <ViewLoader />;

	async function onCreate() {
		setError(null);
		if (name.trim() === "") return;
		try {
			await createTag.mutateAsync({ name: name.trim(), colorRgb: color });
			setName("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się dodać etykiety.");
		}
	}

	async function onDelete(id: string) {
		setError(null);
		try {
			await deleteTag.mutateAsync(id);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się usunąć etykiety.");
		}
	}

	return (
		<SectionCard title="Etykiety">
			{error && <p className="px-4 py-2 text-xs text-red-500">{error}</p>}
			<div className="px-4 py-3 flex gap-2">
				<input
					aria-label="Nazwa etykiety"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Nowa etykieta"
					className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
				/>
				<button
					type="button"
					onClick={() => void onCreate()}
					disabled={createTag.isPending}
					className="shrink-0 rounded-xl bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900 disabled:opacity-50"
				>
					{createTag.isPending ? (
						<>
							<ButtonSpinner />
							Dodawanie…
						</>
					) : (
						"Dodaj"
					)}
				</button>
			</div>
			<div className="px-4 pb-3 flex items-center gap-2">
				<select
					aria-label="Kolor etykiety"
					value={color}
					onChange={(e) => setColor(e.target.value)}
					className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm capitalize"
				>
					{TAG_PALETTE.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
				<span
					aria-hidden="true"
					className="size-7 shrink-0 rounded-full border border-neutral-300 dark:border-neutral-700"
					style={{ backgroundColor: color }}
				/>
			</div>
			<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
				{(tags.data ?? []).map((t) => (
					<li key={t.id} className="px-4 py-2.5 flex items-center gap-2">
						{t.color && (
							<span
								aria-hidden="true"
								className="size-3.5 shrink-0 rounded-full border border-neutral-300 dark:border-neutral-700"
								style={{ backgroundColor: `#${t.color}` }}
							/>
						)}
						<span className="flex-1 text-sm truncate">{t.name}</span>
						<button
							type="button"
							aria-label={`Usuń etykietę ${t.name}`}
							onClick={() => void onDelete(t.id)}
							disabled={deleteTag.isPending}
							className="shrink-0 text-sm text-red-600 dark:text-red-400 disabled:opacity-50"
						>
							{deleteTag.isPending && deleteTag.variables === t.id ? (
								<>
									<ButtonSpinner />
									Usuwanie…
								</>
							) : (
								"Usuń"
							)}
						</button>
					</li>
				))}
				{(tags.data?.length ?? 0) === 0 && (
					<li className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
						Brak etykiet.
					</li>
				)}
			</ul>
		</SectionCard>
	);
}

function GroupsSection() {
	const groups = useCustomGroups();
	const createGroup = useCreateGroup();
	const deleteGroup = useDeleteGroup();
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	if (groups.isLoading) return <ViewLoader />;

	async function onCreate() {
		setError(null);
		if (name.trim() === "") return;
		try {
			await createGroup.mutateAsync(name.trim());
			setName("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się dodać grupy.");
		}
	}

	async function onDelete(id: string) {
		setError(null);
		try {
			await deleteGroup.mutateAsync(id);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się usunąć grupy.");
		}
	}

	return (
		<SectionCard title="Grupy odbiorców">
			<p className="px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400">
				Grupa zapisuje zestaw odbiorców pod jedną nazwą. Tworzenie i usuwanie grup działa tutaj —
				wybieranie całej grupy w kompozytorze dodamy, gdy Librus potwierdzi listę odbiorców (testem
				poniżej).
			</p>
			{error && <p className="px-4 py-2 text-xs text-red-500">{error}</p>}
			<div className="px-4 py-3 flex gap-2">
				<input
					aria-label="Nazwa grupy"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Nowa grupa odbiorców"
					className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
				/>
				<button
					type="button"
					onClick={() => void onCreate()}
					disabled={createGroup.isPending}
					className="shrink-0 rounded-xl bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900 disabled:opacity-50"
				>
					{createGroup.isPending ? (
						<>
							<ButtonSpinner />
							Dodawanie…
						</>
					) : (
						"Dodaj"
					)}
				</button>
			</div>
			<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
				{(groups.data ?? []).map((g) => (
					<li key={g.id} className="px-4 py-2.5 flex items-center gap-2">
						<span className="flex-1 text-sm truncate">{g.name}</span>
						<button
							type="button"
							aria-label={`Usuń grupę ${g.name}`}
							onClick={() => void onDelete(g.id)}
							disabled={deleteGroup.isPending}
							className="shrink-0 text-sm text-red-600 dark:text-red-400 disabled:opacity-50"
						>
							{deleteGroup.isPending && deleteGroup.variables === g.id ? (
								<>
									<ButtonSpinner />
									Usuwanie…
								</>
							) : (
								"Usuń"
							)}
						</button>
					</li>
				))}
				{(groups.data?.length ?? 0) === 0 && (
					<li className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">Brak grup.</li>
				)}
			</ul>
		</SectionCard>
	);
}

/** Tester diagnostyczny (HITL r.3): odpytuje kandydujące endpointy Librusa żywą sesją M. */
function ProbeSection() {
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
			<div className="px-4 py-3 flex flex-col gap-2">
				<p className="text-xs text-neutral-500 dark:text-neutral-400">
					Sprawdza, które endpointy Librusa odpowiadają na tym koncie (lista odbiorców, etykiety,
					grupy). Test może utworzyć pozycje próbne „Probe-Aplaus” — usuń je potem z list powyżej.
				</p>
				<select
					aria-label="Kategoria odbiorców do testu"
					value={chosen}
					onChange={(e) => setTypeId(e.target.value)}
					className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
				>
					{(types.data ?? []).map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
				<button
					type="button"
					onClick={() => void run()}
					disabled={probe.isPending || chosen === ""}
					className="self-start rounded-xl bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900 disabled:opacity-50"
				>
					{probe.isPending ? (
						<>
							<ButtonSpinner />
							Sprawdzam…
						</>
					) : (
						"Uruchom test"
					)}
				</button>
				{probe.isError && (
					<p className="text-xs text-red-500">
						{probe.error instanceof Error ? probe.error.message : "Test nie udał się."}
					</p>
				)}
				{sessionExpired && (
					<p
						role="alert"
						className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
					>
						Sesja Librusa wygasła — wyloguj się i zaloguj ponownie, potem uruchom test jeszcze raz.
					</p>
				)}
				{rows.length > 0 && (
					<div className="flex flex-col gap-2">
						<pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-neutral-100 p-3 text-[10px] leading-4 dark:bg-neutral-800">
							{report}
						</pre>
						<button
							type="button"
							onClick={() => {
								void navigator.clipboard.writeText(report);
								setCopied(true);
							}}
							className="self-start rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm"
						>
							Kopiuj wynik
						</button>
						{copied && (
							<p className="text-xs text-green-700 dark:text-green-400">
								Skopiowano — wklej wynik w rozmowie.
							</p>
						)}
					</div>
				)}
				<hr className="border-neutral-200 dark:border-neutral-800" />
				<p className="text-xs text-neutral-500 dark:text-neutral-400">
					Skaner kodu klienta Librusa pobiera paczkę JS oficjalnej aplikacji wiadomości (Twoją
					sesją) i szuka w niej prawdziwych endpointów odbiorców oraz formatu koloru etykiet —
					dokładnie to samo źródło, z którego korzystał audyt.
				</p>
				<button
					type="button"
					onClick={() => void scan.mutateAsync(undefined)}
					disabled={scan.isPending}
					className="self-start rounded-xl bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{scan.isPending ? (
						<>
							<ButtonSpinner />
							Skanowanie…
						</>
					) : (
						"Skanuj kod klienta Librusa"
					)}
				</button>
				{scan.isError && (
					<p className="text-xs text-red-500">
						{scan.error instanceof Error ? scan.error.message : "Skan nie udał się."}
					</p>
				)}
				{scan.data !== undefined && (
					<div className="flex flex-col gap-2">
						<pre>{scanReport}</pre>
						{(scan.data?.matches.length ?? 0) === 0 && (
							<p className="text-xs text-amber-600 dark:text-amber-400">
								Skaner nic nie znalazł — najpewniej sesja wygasła i skan trafił na stronę logowania.
								Zaloguj się ponownie i spróbuj jeszcze raz.
							</p>
						)}
						<button
							type="button"
							onClick={() => {
								void navigator.clipboard.writeText(scanReport);
								setCopied(true);
							}}
							className="self-start rounded-xl border border-neutral-300 px-3 py-2 text-sm"
						>
							Kopiuj wynik skanera
						</button>
					</div>
				)}
			</div>
		</SectionCard>
	);
}
