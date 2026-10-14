/**
 * Kompozytor wiadomości (Fazy 9–10): odbiorcy (typy + accountId), temat,
 * treść, podpisy, zapis szkicu
 * (newOne/reply/forward) i wysyłka. Wysyłka jest wyraźną akcją użytkownika —
 * po błędzie pokazujemy komunikat i to użytkownik decyduje o ponownej próbie
 * (proxy powtarza wyłącznie odnowienie sesji M przy 401, które na pewno
 * niczego nie dostarczyło — nigdy nie ma ślepego retry samej wysyłki).
 * Załączniki wyłączone w UI (HITL r.3): ta szkoła nie ma skonfigurowanego dysku
 * (cloudStorageIsConfigured=false), Librus odrzuca pliki także u siebie; proxy API
 * zostaje dla szkół z włączonym dyskiem.
 */

import type {
	DraftRecord,
	MessageReceiver,
	ReceiverEntry,
	ReceiverType,
} from "@repo/librus-client";
import { useEffect, useRef, useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { ViewLoader } from "@/components/ViewLoader";
import { useRoute } from "@/lib/router";
import {
	useCreateDraft,
	useCustomGroups,
	useDraft,
	useMessageDetail,
	useReceivers,
	useReceiverTypes,
	useSendMessage,
	useSignatures,
	useUpdateDraft,
} from "./queries";

/** Where a reply/forward context comes from. */
export interface ComposeContext {
	folder: "inbox" | "outbox";
	id: string;
}

export function ComposeScreen({
	draftId,
	replyTo,
	forwardOf,
}: {
	draftId?: string;
	replyTo?: ComposeContext;
	forwardOf?: ComposeContext;
}) {
	const { navigate } = useRoute();
	const types = useReceiverTypes();
	const groups = useCustomGroups();
	const existing = useDraft(draftId ?? "");
	const existingRef = useRef<DraftRecord | null>(null);
	const contextMessage = useMessageDetail(
		replyTo?.folder ?? forwardOf?.folder ?? "inbox",
		replyTo?.id ?? forwardOf?.id ?? "",
	);

	const [receivers, setReceivers] = useState<MessageReceiver[]>([]);
	const [typeId, setTypeId] = useState("");
	const [search, setSearch] = useState("");
	const receiversList = useReceivers(typeId);
	const [topic, setTopic] = useState("");
	const [content, setContent] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const createDraft = useCreateDraft();
	const updateDraft = useUpdateDraft();
	const sendMessage = useSendMessage();
	const signatures = useSignatures();

	// Default the receiver type to Wychowawcy (pierwsza kategoria).
	useEffect(() => {
		if (typeId === "") setTypeId("tutors");
	}, [typeId]);

	// Load-once population when editing a draft (refetches don't clobber the form).
	useEffect(() => {
		if (!draftId) return;
		if (existing.data === undefined || existing.isLoading) return;
		if (existingRef.current !== null) return;
		const draft = existing.data;
		if (draft === null) {
			setError("Szkic nie istnieje lub został usunięty.");
			return;
		}
		existingRef.current = draft;
		setReceivers(draft.receivers);
		setTopic(draft.topic);
		setContent(draft.body);
	}, [draftId, existing.data, existing.isLoading]);

	// Reply/forward prefill from the context message (load-once).
	useEffect(() => {
		if (!replyTo && !forwardOf) return;
		if (contextMessage.isLoading || contextMessage.data === undefined) return;
		if (existingRef.current !== null) return;
		const msg = contextMessage.data;
		if (msg === null) {
			setError("Nie udało się wczytać wiadomości-źródła.");
			return;
		}
		existingRef.current = {} as DraftRecord;
		const marker = forwardOf ? "Fwd" : "Re";
		const originalTopic = msg.topic === "" ? "(bez tematu)" : msg.topic;
		setTopic(`${marker}: ${originalTopic}`);
		const quote = [
			"",
			"",
			"----",
			`W dniu ${msg.sendDate ?? "?"} ${msg.senderName ?? "?"} napisał:`,
			msg.content,
		].join("\n");
		setContent(quote);
	}, [replyTo, forwardOf, contextMessage.data, contextMessage.isLoading]);

	/** Dodaje/usuwa osobę z listy wybranych odbiorców (picker zamiast accountId). */
	function toggleReceiver(entry: ReceiverEntry) {
		setReceivers((prev) => {
			const exists = prev.some((r) => r.typeId === entry.typeId && r.accountId === entry.accountId);
			return exists
				? prev.filter((r) => !(r.typeId === entry.typeId && r.accountId === entry.accountId))
				: [...prev, { typeId: entry.typeId, accountId: entry.accountId }];
		});
	}

	/** Filtr listy po wyszukanym fragmencie nazwy lub accountId. */
	function filteredReceivers(): ReceiverEntry[] {
		const list = receiversList.data ?? [];
		const needle = search.trim().toLowerCase();
		if (needle === "") return list;
		return list.filter(
			(entry) => entry.name.toLowerCase().includes(needle) || entry.accountId.includes(needle),
		);
	}

	function formBody() {
		// Załączniki wyłączone (HITL r.3) — wiadomości zawsze jadą bez plików.
		return { receivers, topic, content, storageId: null };
	}

	/** The update route keys off the draft's variant (newOne/reply/forward). */
	function variantOf(draft: DraftRecord | null): "newOne" | "reply" | "forward" {
		if (draft?.type === "reply") return "reply";
		if (draft?.type === "forward") return "forward";
		return "newOne";
	}

	async function onSaveDraft() {
		setError(null);
		setNotice(null);
		const context = contextIds();
		if (draftId === undefined) {
			try {
				const created = await createDraft.mutateAsync({ ...formBody(), ...context });
				navigate(`/messages/compose/${created.identifier}`);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Nie udało się zapisać szkicu.");
			}
			return;
		}
		try {
			await updateDraft.mutateAsync({
				variant: variantOf(existing.data ?? null),
				id: draftId,
				body: formBody(),
			});
			setNotice("Szkic zapisany.");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się zapisać szkicu.");
		}
	}

	/** Reply/forward context ids for the wire — strings per contract. */
	function contextIds(): { repliedToMessageId?: string; forwardedMessageId?: string } {
		// An editing session inherits the context of the loaded draft.
		const draft = existingRef.current;
		const replyId = replyTo?.id ?? draft?.parentMessageIdentifier;
		const fwdOf =
			forwardOf?.id ?? (draft?.type === "forward" ? draft.parentMessageIdentifier : undefined);
		const isReply = replyTo !== undefined || draft?.type === "reply";
		const isFwd = forwardOf !== undefined || draft?.type === "forward";
		return isReply && typeof replyId === "string" && replyId !== ""
			? { repliedToMessageId: replyId }
			: isFwd && typeof fwdOf === "string" && fwdOf !== ""
				? { forwardedMessageId: fwdOf }
				: {};
	}

	async function onSend() {
		setError(null);
		setNotice(null);
		if (receivers.length === 0) {
			setError("Dodaj co najmniej jednego odbiorcę.");
			return;
		}
		if (topic.trim() === "" || content.trim() === "") {
			setError("Uzupełnij temat i treść.");
			return;
		}
		try {
			await sendMessage.mutateAsync({ ...formBody(), ...contextIds() });
			navigate("/messages/outbox");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się wysłać wiadomości.");
		}
	}

	if (draftId !== undefined && existing.isLoading) return <ViewLoader />;

	return (
		<div className="flex flex-col gap-4">
			{error && (
				<p
					role="alert"
					className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300"
				>
					{error}
				</p>
			)}
			{notice && <p className="text-xs text-green-700 dark:text-green-400">{notice}</p>}

			<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4 flex flex-col gap-3">
				<div>
					<label htmlFor="rcv-type" className="block text-xs font-semibold text-neutral-500 mb-1">
						Typ odbiorcy
					</label>
					<select
						id="rcv-type"
						value={typeId}
						onChange={(e) => setTypeId(e.target.value)}
						className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
					>
						<option value="tutors">Wychowawcy</option>
						<option value="school-employees">Kadra szkoły</option>
						{(groups.data ?? []).map((g) => (
							<option key={`group-${g.id}`} value={`group-${g.id}`}>
								Grupa: {g.name}
							</option>
						))}
					</select>
					<input
						aria-label="Szukaj odbiorcy"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Szukaj odbiorcy…"
						className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm mt-2"
					/>
					{receiversList.isLoading ? (
						<p className="text-xs text-neutral-400 mt-2">
							<ButtonSpinner />
							Ładowanie odbiorców…
						</p>
					) : receiversList.isError ? (
						<p className="text-xs text-red-500 mt-2">
							Nie udało się pobrać listy odbiorców dla tego typu.
						</p>
					) : (
						<ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800">
							{filteredReceivers().map((entry) => {
								const selected = receivers.some(
									(r) => r.typeId === entry.typeId && r.accountId === entry.accountId,
								);
								return (
									<li key={`${entry.typeId}-${entry.accountId}`}>
										<button
											type="button"
											aria-pressed={selected}
											onClick={() => toggleReceiver(entry)}
											className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${
												selected
													? "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300"
													: ""
											}`}
										>
											<span className="truncate">{entry.name}</span>
											<span aria-hidden="true">{selected ? "✓" : "+"}</span>
										</button>
									</li>
								);
							})}
							{filteredReceivers().length === 0 && (
								<li className="px-3 py-3 text-sm text-neutral-400">
									Brak odbiorców dla tej kategorii (Librus nie udostępnia jej z tego konta).
								</li>
							)}
						</ul>
					)}
					{receivers.length > 0 && (
						<ul className="flex flex-wrap gap-1.5 mt-2">
							{receivers.map((r, index) => (
								<li key={`${r.typeId}-${r.accountId}-${index}`}>
									<button
										type="button"
										aria-label={`Usuń odbiorcę ${r.accountId}`}
										onClick={() => setReceivers(receivers.filter((_, i) => i !== index))}
										className="rounded-full bg-neutral-200 dark:bg-neutral-800 px-2.5 py-1 text-xs flex items-center gap-1"
									>
										<span>
											{labelOf(types.data, r.typeId)} · {r.accountId}
										</span>
										<span aria-hidden="true">×</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				<div>
					<label htmlFor="topic" className="block text-xs font-semibold text-neutral-500 mb-1">
						Temat
					</label>
					<input
						id="topic"
						value={topic}
						onChange={(e) => setTopic(e.target.value)}
						className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
					/>
				</div>

				<div>
					<label htmlFor="content" className="block text-xs font-semibold text-neutral-500 mb-1">
						Treść
					</label>
					<textarea
						id="content"
						value={content}
						onChange={(e) => setContent(e.target.value)}
						rows={8}
						className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
					/>
				</div>

				{/* Podpis: wybór wstawia treść podpisu pod wiadomością (select resetuje się po wyborze). */}
				{(signatures.data?.length ?? 0) > 0 && (
					<div>
						<label htmlFor="sig" className="block text-xs font-semibold text-neutral-500 mb-1">
							Podpis
						</label>
						<select
							id="sig"
							value=""
							onChange={(e) => {
								const hit = signatures.data?.find((s) => s.id === e.target.value);
								if (!hit?.content) return;
								setContent((prev) => `${prev}\n\n--\n${hit.content}`);
							}}
						>
							<option value="">Wybierz podpis</option>
							{(signatures.data ?? []).map((s) => (
								<option key={s.id} value={s.id}>
									{s.name}
								</option>
							))}
						</select>
					</div>
				)}

				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => void onSaveDraft()}
						disabled={createDraft.isPending || updateDraft.isPending}
						className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2.5 text-sm font-medium disabled:opacity-50"
					>
						{createDraft.isPending || updateDraft.isPending ? (
							<>
								<ButtonSpinner />
								Zapisywanie…
							</>
						) : (
							"Zapisz szkic"
						)}
					</button>
					<button
						type="button"
						onClick={() => void onSend()}
						disabled={sendMessage.isPending}
						className="flex-1 rounded-xl bg-green-700 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
					>
						{sendMessage.isPending ? (
							<>
								<ButtonSpinner />
								Wysyłanie…
							</>
						) : (
							"Wyślij"
						)}
					</button>
				</div>
			</section>
		</div>
	);
}

/** Statyczne etykiety kategorii, których nie ma w słowniku typów Librusa. */
const STATIC_TYPE_LABELS: Record<string, string> = {
	"school-employees": "Kadra szkoły",
	teachers: "Nauczyciel",
	tutors: "Wychowawca",
};

function labelOf(types: ReceiverType[] | undefined, typeId: string): string {
	const hit = types?.find((t) => t.id === typeId);
	return hit?.name ?? STATIC_TYPE_LABELS[typeId] ?? typeId;
}
