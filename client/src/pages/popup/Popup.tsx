import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, wsLink, createWSClient, splitLink } from "@trpc/client";
import { useEffect, useState } from "react";
import { Chat } from "./Chat";
import { trpc } from "./trpc";

type FlightDetails =
  | { status: "not-fr24" }
  | { status: "no-flight-selected" }
  | { status: "ok"; flightName: string; flightId: string };

export default function Popup() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUrl() {
      const [currentTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      return currentTab.url ?? null;
    }

    fetchUrl().then(setUrl);
  }, []);

  function getFlightDetailsFromUrl(url: string): FlightDetails {
    const parsedUrl = new URL(url);

    if (parsedUrl.host !== "www.flightradar24.com") {
      return { status: "not-fr24" };
    }

    const pathnameFragments = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathnameFragments.length < 2) {
      return { status: "no-flight-selected" };
    }

    const flightName = pathnameFragments[0];
    if (flightName.includes(",")) {
      return { status: "no-flight-selected" };
    }

    const flightId = pathnameFragments[1];

    return { status: "ok", flightName, flightId };
  }

  const flightDetails: FlightDetails = url
    ? getFlightDetailsFromUrl(url)
    : { status: "not-fr24" };

  const [queryClient] = useState(() => new QueryClient());
  const [wsClient] = useState(() =>
    createWSClient({ url: import.meta.env.VITE_WS_ENDPOINT })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition(op) {
            return op.type === "subscription";
          },
          true: wsLink({ client: wsClient }),
          false: httpBatchLink({
            url: import.meta.env.VITE_HTTP_ENDPOINT,
          }),
        }),
      ],
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <div className="h-full bg-fr-gray font-sans text-fr-light">
          {flightDetails.status === "ok" ? (
            <Chat
              chatId={flightDetails.flightId}
              flightName={flightDetails.flightName}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm">
              {flightDetails.status === "not-fr24" ? (
                <p>
                  This extension only works in{" "}
                  <a
                    className="underline"
                    target="_blank"
                    rel="noreferrer noopener"
                    href="https://www.flightradar24.com"
                  >
                    flightradar24
                  </a>
                </p>
              ) : (
                <p>We cannot detect flight details, please select a flight</p>
              )}
            </div>
          )}
        </div>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
