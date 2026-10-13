/**
 * LoginBanner: "Zalogowano jako <imię — rola>". Rendered at the three moments
 * the account context is (re)established: after login (initial render),
 * after switching accounts (re-render with the other account) and after a
 * silent renewal (re-render with the refreshed account).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginBanner } from "./LoginBanner";

describe("LoginBanner", () => {
	it("renders name and role after login (first mount)", () => {
		render(<LoginBanner firstName="Adam" lastName="Testowy" roleLabel="Uczeń" />);
		expect(screen.getByTestId("login-banner").textContent).toContain(
			"Zalogowano jako Adam Testowy",
		);
		expect(screen.getByTestId("login-banner").textContent).toContain("Uczeń");
	});

	it("renders the other account after switching (re-render)", () => {
		const { rerender } = render(
			<LoginBanner firstName="Adam" lastName="Testowy" roleLabel="Uczeń" />,
		);
		rerender(<LoginBanner firstName="Filip" lastName="Rodzic" roleLabel="Rodzic" />);
		expect(screen.getByTestId("login-banner").textContent).toContain(
			"Zalogowano jako Filip Rodzic",
		);
		expect(screen.getByTestId("login-banner").textContent).toContain("Rodzic");
		expect(screen.getByTestId("login-banner").textContent).not.toContain("Adam");
	});

	it("keeps rendering after a silent renewal (same account, fresh jar)", () => {
		const { rerender } = render(
			<LoginBanner firstName="Adam" lastName="Testowy" roleLabel="Uczeń" />,
		);
		rerender(<LoginBanner firstName="Adam" lastName="Testowy" roleLabel="Uczeń" />);
		expect(screen.getByTestId("login-banner").textContent).toContain(
			"Zalogowano jako Adam Testowy",
		);
	});

	it("stays quiet when the account has no name yet", () => {
		render(<LoginBanner firstName="" lastName="" roleLabel="" />);
		const banner = screen.getByTestId("login-banner");
		expect(banner.textContent).not.toContain("Zalogowano jako");
	});
});
