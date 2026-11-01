/**
 * Pull-to-refresh (issue #27): treść podąża za palcem (pull w px z oporem),
 * puszczenie powyżej progu odświeża, poniżej wraca do 0; gest od samego góry
 * strony; podczas odświeżania kolejne gesty są ignorowane.
 */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePullToRefresh } from "./usePullToRefresh";

/** jsdom nie zna TouchEvent — syntetyczne zdarzenie z jednym dotykiem. */
function touch(type: string, clientY: number) {
	const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
		touches: Array<{ clientY: number }>;
	};
	Object.defineProperty(event, "touches", { value: [{ clientY }] });
	return event;
}

function Harness({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
	const { progress, pull, holding, refreshing } = usePullToRefresh(onRefresh);
	return (
		<div>
			<span data-testid="progress">{progress}</span>
			<span data-testid="pull">{pull}</span>
			<span data-testid="holding">{String(holding)}</span>
			<span data-testid="refreshing">{String(refreshing)}</span>
		</div>
	);
}

function pullDown(from: number, to: number) {
	act(() => {
		window.dispatchEvent(touch("touchstart", from));
		window.dispatchEvent(touch("touchmove", to));
	});
}

describe("usePullToRefresh", () => {
	it("content follows the finger with resistance and blocks native refresh", () => {
		render(<Harness onRefresh={vi.fn()} />);
		pullDown(100, 200); // delta 100 px, opór 0.45 → pull 45
		expect(screen.getByTestId("pull").textContent).toBe("45");
		expect(Number(screen.getByTestId("progress").textContent)).toBeGreaterThan(0);
		expect(screen.getByTestId("holding").textContent).toBe("true");
		// touchmove preventDefault = brak natywnego pull-to-refresh/bounce
		const blocked = touch("touchmove", 220);
		act(() => {
			window.dispatchEvent(blocked);
		});
		expect(blocked.defaultPrevented).toBe(true);
	});

	it("release above the threshold refreshes and keeps the refreshing state", async () => {
		let resolveRefresh: (() => void) | undefined;
		const onRefresh = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveRefresh = resolve;
				}),
		);
		render(<Harness onRefresh={onRefresh} />);
		pullDown(0, 200); // pull 90 > próg 70
		act(() => {
			window.dispatchEvent(touch("touchend", 200));
		});
		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId("refreshing").textContent).toBe("true");
		// loader pozostaje podczas trzymania/odświeżania (progress = 1)
		expect(Number(screen.getByTestId("progress").textContent)).toBe(1);
		await act(async () => {
			resolveRefresh?.();
		});
		expect(screen.getByTestId("refreshing").textContent).toBe("false");
		expect(screen.getByTestId("pull").textContent).toBe("0");
	});

	it("release below the threshold springs back without refreshing", () => {
		const onRefresh = vi.fn();
		render(<Harness onRefresh={onRefresh} />);
		pullDown(0, 120); // pull 54 < próg 70
		act(() => {
			window.dispatchEvent(touch("touchend", 120));
		});
		expect(onRefresh).not.toHaveBeenCalled();
		expect(screen.getByTestId("pull").textContent).toBe("0");
		expect(screen.getByTestId("refreshing").textContent).toBe("false");
	});

	it("ignores gestures when the page is scrolled down", () => {
		const onRefresh = vi.fn();
		render(<Harness onRefresh={onRefresh} />);
		const scrollY = Object.getOwnPropertyDescriptor(window, "scrollY");
		Object.defineProperty(window, "scrollY", { value: 50, configurable: true });
		try {
			pullDown(0, 200);
			act(() => {
				window.dispatchEvent(touch("touchend", 200));
			});
			expect(screen.getByTestId("pull").textContent).toBe("0");
			expect(onRefresh).not.toHaveBeenCalled();
		} finally {
			if (scrollY) Object.defineProperty(window, "scrollY", scrollY);
		}
	});

	it("upward drag resets the pull", () => {
		render(<Harness onRefresh={vi.fn()} />);
		pullDown(100, 180); // delta 80 → pull 36
		act(() => {
			window.dispatchEvent(touch("touchmove", 40)); // delta ujemna
		});
		expect(screen.getByTestId("pull").textContent).toBe("0");
	});

	it("ignores new gestures while refreshing", async () => {
		let resolveRefresh: (() => void) | undefined;
		const onRefresh = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveRefresh = resolve;
				}),
		);
		render(<Harness onRefresh={onRefresh} />);
		pullDown(0, 200);
		act(() => {
			window.dispatchEvent(touch("touchend", 200));
		});
		pullDown(0, 300); // gest w trakcie odświeżania
		expect(screen.getByTestId("pull").textContent).toBe("0");
		await act(async () => {
			resolveRefresh?.();
		});
	});
});
