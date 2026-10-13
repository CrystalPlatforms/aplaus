import { useMemo, useState } from "react";
import { ViewLoader } from "@/components/ViewLoader";
import { useAttendance } from "./queries";
import { attendanceSemesters, computeAttendanceStats } from "./stats";

export function AttendanceScreen() {
	const { data, isLoading, isError } = useAttendance();
	const [semester, setSemester] = useState<number | null>(null);

	const attendances = data?.attendances ?? [];
	const types = data?.types ?? [];
	const semesters = useMemo(() => attendanceSemesters(attendances), [attendances]);
	const activeSemester = semester ?? semesters[0] ?? null;
	const stats = useMemo(
		() => computeAttendanceStats(attendances, types, activeSemester ?? undefined),
		[attendances, types, activeSemester],
	);
	const perType = stats.perType;

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać frekwencji.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	return (
		<div className="flex flex-col gap-4">
			{semesters.length > 1 && (
				<div className="flex rounded-xl bg-neutral-200/70 dark:bg-neutral-900 p-1">
					{semesters.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setSemester(s)}
							className={`flex-1 py-2 text-sm font-medium rounded-lg ${
								activeSemester === s ? "bg-white dark:bg-neutral-800 shadow" : "text-neutral-500"
							}`}
						>
							Semestr {s}
						</button>
					))}
				</div>
			)}

			<StatsCard stats={stats} />

			{perType.length > 0 && (
				<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4">
					<h2 className="text-sm font-semibold mb-2">Rozbicie po typach</h2>
					<ul className="flex flex-col gap-1">
						{perType.map((t) => (
							<li key={t.id} className="text-sm flex justify-between">
								<span>{t.name}</span>
								<span className="font-semibold">{t.count}</span>
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800">
				<h2 className="px-4 pt-3 pb-1 text-sm font-semibold">Lista wpisów</h2>
				{!isLoading &&
					attendances.filter((a) => activeSemester === null || a.semester === activeSemester)
						.length === 0 && (
						<p className="px-4 py-6 text-sm text-neutral-400">Brak wpisów w tym semestrze.</p>
					)}
				<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
					{attendances
						.filter((a) => activeSemester === null || a.semester === activeSemester)
						.map((a) => (
							<li key={a.id} className="px-4 py-2.5 flex items-center justify-between">
								<span>
									<span className="block text-sm font-medium">{typeOf(types, a.typeId)}</span>
									<span className="block text-xs text-neutral-500">
										{a.date.slice(0, 10)} {a.lessonNo ? `· lekcja ${a.lessonNo}` : ""}
									</span>
								</span>
								<AttendanceDot typeId={a.typeId} types={types} />
							</li>
						))}
				</ul>
			</section>
		</div>
	);
}

function typeOf(types: { id: number; name: string }[], typeId: number | null): string {
	return types.find((t) => t.id === typeId)?.name ?? "Nieznany typ";
}

function StatsCard({ stats }: { stats: ReturnType<typeof computeAttendanceStats> }) {
	return (
		<div className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4">
			<div className="grid grid-cols-2 gap-4">
				<Stat label="Obecności" value={stats.presence} />
				<Stat label="Usprawiedliwione" value={stats.excused} />
				<Stat label="Nieusprawiedliwione" value={stats.unexcused} />
				<Stat label="Spóźnienia" value={stats.lateness} />
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div>
			<p className="text-xs text-neutral-500">{label}</p>
			<p className="text-2xl font-bold">{value}</p>
		</div>
	);
}

function AttendanceDot({
	typeId,
	types,
}: {
	typeId: number | null;
	types: { id: number; colorHex: string | null }[];
}) {
	const color = types.find((t) => t.id === typeId)?.colorHex ?? null;
	return (
		<span
			className="ml-3 shrink-0 w-3 h-3 rounded-full border border-neutral-300 dark:border-neutral-700"
			style={color ? { backgroundColor: color } : undefined}
			aria-hidden="true"
		/>
	);
}
