export function PlaceholderScreen({ label }: { label: string }) {
	return (
		<div className="py-16 text-center text-neutral-400 text-sm">
			<p>{label} — wkrótce</p>
		</div>
	);
}
