import { describe, expect, it } from "vitest";
import { activeTabOf, subpageRootOf } from "./nav-items";

describe("subpageRootOf", () => {
	it("returns null on section roots", () => {
		expect(subpageRootOf("/start")).toBeNull();
		expect(subpageRootOf("/grades")).toBeNull();
		expect(subpageRootOf("/timetable")).toBeNull();
		expect(subpageRootOf("/messages")).toBeNull();
		expect(subpageRootOf("/more")).toBeNull();
	});

	it("marks subject grades as a grades subpage", () => {
		expect(subpageRootOf("/grades/subject/123")).toBe("/grades");
	});

	it("marks message detail, compose and drafts as messages subpages, but folder lists are not", () => {
		expect(subpageRootOf("/messages/inbox/abc")).toBe("/messages");
		expect(subpageRootOf("/messages/outbox/abc")).toBe("/messages");
		expect(subpageRootOf("/messages/inbox/abc/reply")).toBe("/messages");
		expect(subpageRootOf("/messages/compose")).toBe("/messages");
		expect(subpageRootOf("/messages/drafts")).toBe("/messages");
		expect(subpageRootOf("/messages/inbox")).toBeNull();
		expect(subpageRootOf("/messages/outbox")).toBeNull();
	});

	it("marks /more subpages and /settings as more subpages", () => {
		expect(subpageRootOf("/more/justifications")).toBe("/more");
		expect(subpageRootOf("/more/homework")).toBe("/more");
		expect(subpageRootOf("/more/notices/notice/9")).toBe("/more");
		expect(subpageRootOf("/settings")).toBe("/more");
	});

	it("never treats start and plan as subpages", () => {
		expect(subpageRootOf("/start")).toBeNull();
		expect(subpageRootOf("/timetable")).toBeNull();
	});

	it("returns null outside any section", () => {
		expect(subpageRootOf("/")).toBeNull();
		expect(subpageRootOf("/nope")).toBeNull();
	});
});

describe("activeTabOf", () => {
	it("maps /settings to the more tab", () => {
		expect(activeTabOf("/settings")).toBe("more");
	});

	it("maps unknown paths to grades", () => {
		expect(activeTabOf("/grades/subject/1")).toBe("grades");
	});
});
