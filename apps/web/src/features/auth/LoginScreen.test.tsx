/**
 * The submit button must actually submit: clicking "Zaloguj się" sends the
 * credentials to POST /api/login. The API boundary (apiFetch) is mocked.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

import { LoginScreen } from "./LoginScreen";

function renderLogin() {
	const onSuccess = vi.fn();
	const client = new QueryClient();
	render(
		<QueryClientProvider client={client}>
			<LoginScreen onSuccess={onSuccess} />
		</QueryClientProvider>,
	);
	return { onSuccess };
}

describe("LoginScreen", () => {
	it("submits credentials when the button is clicked", async () => {
		apiFetchMock.mockResolvedValue({
			deviceToken: "tok",
			account: { id: "1", firstName: "A", lastName: "B", role: "Uczeń", groupId: 8 },
		});
		const { onSuccess } = renderLogin();
		fireEvent.change(screen.getByPlaceholderText("Login Librusa"), { target: { value: "adam" } });
		fireEvent.change(screen.getByPlaceholderText("Hasło"), { target: { value: "secret" } });
		fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));
		await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
		expect(apiFetchMock).toHaveBeenCalledWith(
			"/api/login",
			expect.objectContaining({ method: "POST" }),
		);
		// The deliberate 1 s minimum-loader stay delays onSuccess past the default timeout.
		await waitFor(() => expect(onSuccess).toHaveBeenCalled(), { timeout: 3000 });
	});

	it("keeps the loader up for at least a second even when the API answers instantly", async () => {
		vi.useFakeTimers();
		apiFetchMock.mockReset();
		try {
			apiFetchMock.mockResolvedValue({
				deviceToken: "tok",
				account: { id: "1", firstName: "A", lastName: "B", role: "Uczeń", groupId: 8 },
			});
			const { onSuccess } = renderLogin();
			fireEvent.change(screen.getByPlaceholderText("Login Librusa"), { target: { value: "adam" } });
			fireEvent.change(screen.getByPlaceholderText("Hasło"), { target: { value: "secret" } });
			fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));
			await vi.advanceTimersByTimeAsync(0);
			// The API already answered, yet the loader must still be on the button.
			expect(apiFetchMock).toHaveBeenCalledTimes(1);
			expect(screen.getByRole("status")).toBeTruthy();
			expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
			expect(onSuccess).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1000);
			await vi.advanceTimersByTimeAsync(0);
			expect(onSuccess).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
