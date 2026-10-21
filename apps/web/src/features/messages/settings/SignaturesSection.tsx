import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ViewLoader } from "@/components/ViewLoader";
import { useCreateSignature, useDeleteSignature, useSignatures } from "../queries";
import { SectionCard } from "./SectionCard";

/** Podpisy: CRUD własnych podpisów wstawianych w kompozytorze. */
export function SignaturesSection() {
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
			{error && <p className="px-4 py-2 text-xs text-destructive">{error}</p>}
			<div className="flex flex-col gap-2 px-4 py-3">
				<Input
					aria-label="Nazwa podpisu"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Nazwa podpisu"
				/>
				<Textarea
					aria-label="Treść podpisu"
					value={content}
					onChange={(e) => setContent(e.target.value)}
					rows={3}
					placeholder="Treść podpisu"
				/>
				<Button
					className="self-start"
					onClick={() => void onCreate()}
					disabled={createSignature.isPending}
				>
					{createSignature.isPending ? (
						<>
							<ButtonSpinner />
							Dodawanie…
						</>
					) : (
						"Dodaj podpis"
					)}
				</Button>
			</div>
			<ul className="divide-y divide-border">
				{(signatures.data ?? []).map((s) => (
					<li key={s.id} className="flex items-center gap-2 px-4 py-2.5">
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">{s.name}</p>
							<p className="truncate text-xs text-muted-foreground">{s.content ?? ""}</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							aria-label={`Usuń podpis ${s.name}`}
							onClick={() => void onDelete(s.id)}
							disabled={deleteSignature.isPending}
							className="h-7 shrink-0 text-xs text-destructive"
						>
							{deleteSignature.isPending && deleteSignature.variables === s.id ? (
								<>
									<ButtonSpinner />
									Usuwanie…
								</>
							) : (
								"Usuń"
							)}
						</Button>
					</li>
				))}
				{(signatures.data?.length ?? 0) === 0 && (
					<li className="px-4 py-3 text-sm text-muted-foreground">Brak podpisów.</li>
				)}
			</ul>
		</SectionCard>
	);
}
