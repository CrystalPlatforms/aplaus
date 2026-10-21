import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Jedna sekcja ustawień = karta z tytułem i podziałem między dziećmi. */
export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Card className="divide-y divide-border gap-0 overflow-hidden py-0">
			<h2 className="px-4 py-3 text-sm font-semibold">{title}</h2>
			{children}
		</Card>
	);
}
