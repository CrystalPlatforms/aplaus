/**
 * Local stdio MCP server over @repo/librus-client — read-only tools for
 * talking to Claude about school data. Runs on the owner's machine; the
 * credentials never leave it (env vars configured in the local MCP client).
 *
 * stdout carries only the MCP protocol: every diagnostic goes to stderr.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isLibrusError } from "@repo/librus-client";
import { z } from "zod";
import { createLibrusSurface, LibrusSession } from "./librus-session";
import {
	gradesBySubject,
	schoolNotices,
	timetableForDay,
	unreadMessages,
	upcomingHomework,
} from "./tools";

const SERVER_NAME = "aplaus-librus";
const SERVER_VERSION = "0.1.0";

function fail(message: string): never {
	process.stderr.write(`${SERVER_NAME}: ${message}\n`);
	process.exit(1);
}

const login = process.env.LIBRUS_LOGIN?.trim();
const password = process.env.LIBRUS_PASSWORD;
if (!login || !password) {
	fail(
		"Brak danych logowania. Ustaw zmienne środowiskowe LIBRUS_LOGIN i LIBRUS_PASSWORD w konfiguracji klienta MCP (claude mcp add ... --env LIBRUS_LOGIN=... --env LIBRUS_PASSWORD=...).",
	);
}

/** JSON tool result: one text block with pretty JSON — readable by the model. */
function json(result: unknown): { content: Array<{ type: "text"; text: string }> } {
	return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

/** Maps every throw to an isError result with the Polish message for the user. */
function toToolResult<T>(
	promise: Promise<T>,
): Promise<
	| { content: Array<{ type: "text"; text: string }> }
	| { content: Array<{ type: "text"; text: string }>; isError: true }
> {
	return promise.then(json, (error: unknown) => ({
		content: [
			{
				type: "text",
				text: isLibrusError(error)
					? error.userMessage
					: `Nieoczekiwany błąd: ${error instanceof Error ? error.message : String(error)}`,
			},
		],
		isError: true,
	}));
}

const surface = createLibrusSurface();
const session = new LibrusSession(surface, { login, password });
const now = () => Date.now();

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

server.registerTool(
	"oceny_z_przedmiotu",
	{
		title: "Oceny z przedmiotu",
		description:
			"Oceny ucznia z Librusa. Bez argumentu zwraca wszystkie oceny; z argumentem `subject` tylko oceny z dopasowanego przedmiotu (bez ogonków, fragment nazwy wystarczy). Gdy filtr nic nie trafi, zwraca listę przedmiotów, które mają oceny.",
		inputSchema: {
			subject: z
				.string()
				.optional()
				.describe("Fragment nazwy przedmiotu, np. 'matma' albo 'biologia'"),
		},
	},
	async ({ subject }) =>
		toToolResult(session.run((jar) => gradesBySubject(surface, jar, { subject }))),
);

server.registerTool(
	"plan_na_dzien",
	{
		title: "Plan na dziś/jutro",
		description:
			"Plan lekcji na dziś albo jutro z Librusa: godziny, przedmioty, nauczyciele, sale, odwołane lekcje i zastępstwa. Pusta lista lekcji oznacza dzień wolny (weekend, ferie) — to nie jest błąd.",
		inputSchema: {
			day: z.enum(["dzis", "jutro"]).describe("'dzis' albo 'jutro'"),
		},
	},
	async ({ day }) =>
		toToolResult(session.run((jar) => timetableForDay(surface, jar, { day }, now))),
);

server.registerTool(
	"nieprzeczytane_wiadomosci",
	{
		title: "Nieprzeczytane wiadomości",
		description:
			"Nieprzeczytane wiadomości ze skrzynki Librusa — wyłącznie metadane (nadawca, temat, data); treść wiadomości nie jest pobierana.",
		inputSchema: {
			limit: z
				.number()
				.int()
				.min(1)
				.max(50)
				.optional()
				.describe("Ile nieprzeczytanych pokazać (domyślnie 10)"),
		},
	},
	async ({ limit }) => toToolResult(session.run((jar) => unreadMessages(surface, jar, { limit }))),
);

server.registerTool(
	"zadania_na_najblizszy_czas",
	{
		title: "Zadania na najbliższy czas",
		description:
			"Prace domowe i zlecenia z Librusa w horyzoncie od dziś: zadania na lekcje oraz rzeczy do oddania z terminem.",
		inputSchema: {
			days: z
				.number()
				.int()
				.min(1)
				.max(60)
				.optional()
				.describe("Horyzont w dniach od dziś (domyślnie 14)"),
		},
	},
	async ({ days }) =>
		toToolResult(session.run((jar) => upcomingHomework(surface, jar, { days }, now))),
);

server.registerTool(
	"ogloszenia",
	{
		title: "Ogłoszenia szkolne",
		description:
			"Szkolne ogłoszenia z Librusa, od najnowszych: temat, treść, okres obowiązywania, autor i status przeczytania.",
		inputSchema: {
			limit: z
				.number()
				.int()
				.min(1)
				.max(50)
				.optional()
				.describe("Ile ogłoszeń pokazać (domyślnie 20)"),
		},
	},
	async ({ limit }) => toToolResult(session.run((jar) => schoolNotices(surface, jar, { limit }))),
);

await server.connect(new StdioServerTransport());
process.stderr.write(`${SERVER_NAME}: serwer MCP uruchomiony (stdio)\n`);
