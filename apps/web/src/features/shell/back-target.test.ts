/**
 * backTargetOf: every sub-route gets a back target, top-level tabs do not.
 */
import { describe, expect, it } from "vitest";
import { backTargetOf } from "./back-target";

describe("backTargetOf", () => {
	it("gives top-level tabs no back target", () => {
		for (const path of ["/start", "/grades", "/timetable", "/messages", "/more"]) {
			expect(backTargetOf(path)).toBeUndefined();
		}
	});

	it("maps the subject grades page back to Oceny", () => {
		expect(backTargetOf("/grades/subject/12")).toEqual({ to: "/grades", label: "Oceny" });
	});

	it("maps message compose, drafts and detail back to Wiadomości", () => {
		for (const path of ["/messages/compose", "/messages/drafts", "/messages/inbox/1001"]) {
			expect(backTargetOf(path)).toEqual({ to: "/messages", label: "Wiadomości" });
		}
	});

	it("maps reply and forward back to the message, not the list", () => {
		expect(backTargetOf("/messages/inbox/1001/reply")).toEqual({
			to: "/messages/inbox/1001",
			label: "Wiadomości",
		});
		expect(backTargetOf("/messages/outbox/2002/forward")).toEqual({
			to: "/messages/outbox/2002",
			label: "Wiadomości",
		});
	});

	it("maps /more sub-routes back to Więcej, detail routes to their lists", () => {
		expect(backTargetOf("/more/homework")).toEqual({ to: "/more", label: "Więcej" });
		expect(backTargetOf("/more/notices/notice/55")).toEqual({
			to: "/more/notices",
			label: "Ogłoszenia",
		});
		expect(backTargetOf("/more/conferences/7")).toEqual({
			to: "/more/conferences",
			label: "Zebrania",
		});
	});

	it("treats /settings as a top-level page — no back target", () => {
		expect(backTargetOf("/settings")).toBeUndefined();
	});
});
