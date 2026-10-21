/**
 * Pure timetable view-model: month grid arithmetic and stable per-subject
 * colors (the redesign's three-view support, sesja "aplaus 23,24").
 */
import { describe, expect, it } from "vitest";
import {
	examKindOf,
	monthGrid,
	monthLabel,
	monthOf,
	shiftMonth,
	subjectColor,
	weekRangeLabel,
	weeksOfMonth,
} from "./vm";

describe("timetable vm — month helpers", () => {
	it("lists the week starts covering the whole month", () => {
		// 2026-11-01 is a Sunday — the grid opens with the prior Monday.
		expect(weeksOfMonth("2026-11")).toEqual([
			"2026-10-26",
			"2026-11-02",
			"2026-11-09",
			"2026-11-16",
			"2026-11-23",
			"2026-11-30",
		]);
	});

	it("builds a Monday-Friday grid with inMonth flags (no weekend)", () => {
		const grid = monthGrid("2026-11");
		expect(grid.length).toBe(6 * 5);
		expect(grid[0]).toEqual({ date: "2026-10-26", inMonth: false });
		expect(grid[4]).toEqual({ date: "2026-10-30", inMonth: false });
		expect(grid[5]).toEqual({ date: "2026-11-02", inMonth: true });
		// 2026-11-01 is a Sunday — it has no cell at all.
		expect(grid.some((c) => c.date === "2026-11-01")).toBe(false);
		expect(grid.some((c) => c.date === "2026-11-28" || c.date === "2026-11-29")).toBe(false);
		expect(grid[25]).toEqual({ date: "2026-11-30", inMonth: true });
		expect(grid[29]).toEqual({ date: "2026-12-04", inMonth: false });
	});

	it("shifts months across the year boundary and labels in Polish", () => {
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftMonth("2026-01", -1)).toBe("2025-12");
		expect(monthLabel("2026-10")).toBe("Październik 2026");
		expect(monthOf("2026-10-14")).toBe("2026-10");
	});

	it("keeps the week range label stable", () => {
		expect(weekRangeLabel("2026-10-12")).toBe("12.10 – 18.10");
	});
});

describe("timetable vm — exam classification (month calendar)", () => {
	it("classifies kartkówki as quizzes and sprawdziany as tests", () => {
		expect(examKindOf("Sprawdzian")).toBe("test");
		expect(examKindOf("Sprawdzian półroczny")).toBe("test");
		expect(examKindOf("Kartkówka")).toBe("quiz");
		expect(examKindOf("kartkówka")).toBe("quiz");
	});

	it("ignores every other grade category", () => {
		expect(examKindOf("Odpowiedź ustna")).toBeNull();
		expect(examKindOf("Praca domowa")).toBeNull();
		expect(examKindOf(null)).toBeNull();
	});
});

describe("timetable vm — subject colors", () => {
	it("gives the same subject the same color everywhere", () => {
		expect(subjectColor("Matematyka")).toEqual(subjectColor("Matematyka"));
	});

	it("gives different subjects different hues", () => {
		const a = subjectColor("Matematyka").color;
		const b = subjectColor("Historia").color;
		const c = subjectColor("Biologia").color;
		expect(new Set([a, b, c]).size).toBe(3);
	});

	it("falls back to neutral for unnamed lessons", () => {
		expect(subjectColor(null).color).toContain("0.02 260");
		expect(subjectColor("   ").tint).toContain("/ 0.2");
	});

	it("produces oklch strings usable as inline styles", () => {
		const { color, tint } = subjectColor("Wychowanie fizyczne");
		expect(color).toMatch(/^oklch\(0\.72 0\.15 \d+\)$/);
		expect(tint).toMatch(/^oklch\(0\.72 0\.15 \d+ \/ 0\.2\)$/);
	});
});
