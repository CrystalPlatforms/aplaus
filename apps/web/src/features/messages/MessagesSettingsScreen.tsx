/**
 * Ustawienia wiadomości (Faza 10): CRUD podpisów, etykiet i własnych grup
 * odbiorców + tester diagnostyczny. Sekcje żyją w ./settings/ (podpisy /
 * etykiety / grupy / probe) — jeden plik przekraczał limit 500 linii.
 */

import { GroupsSection } from "./settings/GroupsSection";
import { ProbeSection } from "./settings/ProbeSection";
import { SignaturesSection } from "./settings/SignaturesSection";
import { TagsSection } from "./settings/TagsSection";

/** Główny ekran: cztery sekcje zarządzania. */
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
