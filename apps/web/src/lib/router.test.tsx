/**
 * Router: navigate/goBack semantics — the goBack fallback matters for the
 * bottom-bar ← arrow (issue #28): deep-link without our history must land
 * on the fallback (section root), our own history must really go back.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RouterProvider, useRoute } from "@/lib/router";

function BackProbe({ fallback }: { fallback: string }) {
	const { path, goBack, navigate } = useRoute();
	return (
		<div>
			<span data-testid="path">{path}</span>
			<button type="button" onClick={() => goBack(fallback)}>
				back
			</button>
			<button type="button" onClick={() => navigate("/next")}>
				forward
			</button>
		</div>
	);
}

function mount(fallback: string) {
	return render(
		<RouterProvider>
			<BackProbe fallback={fallback} />
		</RouterProvider>,
	);
}

afterEach(() => {
	window.history.pushState(null, "", "/");
});

describe("router", () => {
	it("navigate pushes a growing idx into history.state", () => {
		window.history.pushState(null, "", "/");
		mount("/fallback");
		fireEvent.click(screen.getByText("forward"));
		expect(screen.getByTestId("path").textContent).toBe("/next");
		expect(window.history.state?.idx).toBe(1);
	});

	it("goBack without app history (deep-link) navigates to the fallback", () => {
		window.history.pushState(null, "", "/");
		mount("/messages");
		expect(window.history.state?.idx).toBeUndefined();
		fireEvent.click(screen.getByText("back"));
		expect(screen.getByTestId("path").textContent).toBe("/messages");
	});

	it("goBack with app history goes back instead of the fallback", async () => {
		window.history.pushState(null, "", "/");
		mount("/fallback");
		// Wejście: /next -> (navigate) /messages/inbox/abc; potem ←.
		fireEvent.click(screen.getByText("forward"));
		act(() => {
			window.history.pushState({ idx: 2 }, "", "/messages/inbox/abc");
			window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 2 } }));
		});
		expect(screen.getByTestId("path").textContent).toBe("/messages/inbox/abc");

		fireEvent.click(screen.getByText("back")); // history.back(), nie fallback
		await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/next"));
	});
});
