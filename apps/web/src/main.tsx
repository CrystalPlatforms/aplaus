import { registerSW } from "virtual:pwa-register";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// autoUpdate: a new worker activates as soon as it is ready; users never see
// a "new version available" prompt. Immediate: register before first render
// finishes so offline support exists from the first visit.
registerSW({ immediate: true });

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

createRoot(document.getElementById("root") ?? document.body).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</StrictMode>,
);
