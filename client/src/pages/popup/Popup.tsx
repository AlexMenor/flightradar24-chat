import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, wsLink, createWSClient, splitLink } from "@trpc/client";
import { useEffect, useState } from "react";
import { Chat } from "./Chat";
import { trpc } from "./trpc";

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

  function getFlightDetailsFromUrl(url: string) {
    const parsedUrl = new URL(url);

    const pathnameFragments = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathnameFragments.length < 2) {
      return null;
    }

    const flightName = pathnameFragments[0];
    if (flightName.includes(",")) {
      return null;
    }

    const flightId = pathnameFragments[1];

    return { flightName, flightId };
  }

  const flightDetails = url && getFlightDetailsFromUrl(url);
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
          {flightDetails ? (
            <Chat
              chatId={flightDetails.flightId}
              flightName={flightDetails.flightName}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p>We cannot detect flight details, please select a flight</p>
            </div>
          )}
        </div>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
