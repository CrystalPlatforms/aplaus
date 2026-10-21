import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViewLoader } from "@/components/ViewLoader";
import { useCreateTag, useDeleteTag, useTags } from "../queries";
import { SectionCard } from "./SectionCard";

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

const selectClasses =
	"flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs capitalize";

/** Etykiety: koloryzowane znaczniki wiadomości (paleta Librusa). */
export function TagsSection() {
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
			{error && <p className="px-4 py-2 text-xs text-destructive">{error}</p>}
			<div className="flex gap-2 px-4 py-3">
				<Input
					aria-label="Nazwa etykiety"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Nowa etykieta"
					className="flex-1"
				/>
				<Button
					className="shrink-0 self-start"
					onClick={() => void onCreate()}
					disabled={createTag.isPending}
				>
					{createTag.isPending ? (
						<>
							<ButtonSpinner />
							Dodawanie…
						</>
					) : (
						"Dodaj"
					)}
				</Button>
			</div>
			<div className="flex items-center gap-2 px-4 pb-3">
				<select
					aria-label="Kolor etykiety"
					value={color}
					onChange={(e) => setColor(e.target.value)}
					className={selectClasses}
				>
					{TAG_PALETTE.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
				<span
					aria-hidden="true"
					className="size-7 shrink-0 rounded-full border border-border"
					style={{ backgroundColor: color }}
				/>
			</div>
			<ul className="divide-y divide-border">
				{(tags.data ?? []).map((t) => (
					<li key={t.id} className="flex items-center gap-2 px-4 py-2.5">
						{t.color && (
							<span
								aria-hidden="true"
								className="size-3.5 shrink-0 rounded-full border border-border"
								style={{ backgroundColor: `#${t.color}` }}
							/>
						)}
						<span className="flex-1 truncate text-sm">{t.name}</span>
						<Button
							variant="ghost"
							size="sm"
							aria-label={`Usuń etykietę ${t.name}`}
							onClick={() => void onDelete(t.id)}
							disabled={deleteTag.isPending}
							className="h-7 shrink-0 text-xs text-destructive"
						>
							{deleteTag.isPending && deleteTag.variables === t.id ? (
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
				{(tags.data?.length ?? 0) === 0 && (
					<li className="px-4 py-3 text-sm text-muted-foreground">Brak etykiet.</li>
				)}
			</ul>
		</SectionCard>
	);
}
