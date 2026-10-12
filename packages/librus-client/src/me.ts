/**
 * /Me reader — account meta for the login confirmation.
 *
 * Shape per audit: `{ Me: { Account, User, Class, Refresh }, Resources, Url }`.
 * Account: Id, FirstName, LastName, GroupId (8 = student, 5 = parent), Login.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import { defaultDeps, type HttpDeps } from "./http";
import type { LibrusAccount } from "./login";

export async function readMe(jar: CookieJar, deps: HttpDeps = defaultDeps): Promise<LibrusAccount> {
	const { body } = await gatewayRequest(jar, "Me", deps);
	const envelope = body as {
		Me?: {
			Account?: Record<string, unknown>;
			User?: Record<string, unknown>;
		};
	};
	const account = envelope.Me?.Account ?? {};
	const user = envelope.Me?.User ?? {};
	const rawFirstName = account.FirstName ?? user.FirstName;
	const rawLastName = account.LastName ?? user.LastName;
	return {
		id: typeof account.Id === "number" ? account.Id : 0,
		firstName: typeof rawFirstName === "string" ? rawFirstName : "",
		lastName: typeof rawLastName === "string" ? rawLastName : "",
		login: typeof account.Login === "string" ? account.Login : "",
		groupId: typeof account.GroupId === "number" ? account.GroupId : 0,
	};
}
