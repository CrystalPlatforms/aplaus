import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViewLoader } from "@/components/ViewLoader";
import { useCreateGroup, useCustomGroups, useDeleteGroup } from "../queries";
import { SectionCard } from "./SectionCard";

/** Grupy odbiorców: zestaw odbiorców pod jedną nazwą. */
export function GroupsSection() {
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
			<p className="px-4 py-2 text-xs text-muted-foreground">
				Grupa zapisuje zestaw odbiorców pod jedną nazwą. Tworzenie i usuwanie grup działa tutaj —
				wybieranie całej grupy w kompozytorze dodamy, gdy Librus potwierdzi listę odbiorców (testem
				poniżej).
			</p>
			{error && <p className="px-4 py-2 text-xs text-destructive">{error}</p>}
			<div className="flex gap-2 px-4 py-3">
				<Input
					aria-label="Nazwa grupy"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Nowa grupa odbiorców"
					className="flex-1"
				/>
				<Button
					className="shrink-0 self-start"
					onClick={() => void onCreate()}
					disabled={createGroup.isPending}
				>
					{createGroup.isPending ? (
						<>
							<ButtonSpinner />
							Dodawanie…
						</>
					) : (
						"Dodaj"
					)}
				</Button>
			</div>
			<ul className="divide-y divide-border">
				{(groups.data ?? []).map((g) => (
					<li key={g.id} className="flex items-center gap-2 px-4 py-2.5">
						<span className="flex-1 truncate text-sm">{g.name}</span>
						<Button
							variant="ghost"
							size="sm"
							aria-label={`Usuń grupę ${g.name}`}
							onClick={() => void onDelete(g.id)}
							disabled={deleteGroup.isPending}
							className="h-7 shrink-0 text-xs text-destructive"
						>
							{deleteGroup.isPending && deleteGroup.variables === g.id ? (
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
				{(groups.data?.length ?? 0) === 0 && (
					<li className="px-4 py-3 text-sm text-muted-foreground">Brak grup.</li>
				)}
			</ul>
		</SectionCard>
	);
}
