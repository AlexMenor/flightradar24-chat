import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, wsLink, createWSClient, splitLink } from "@trpc/client";
import { useEffect, useRef, useState } from "react";
import { RouterOutputs, trpc } from "./trpc";
import AirplaneIcon from "~icons/mdi/airplane";

type Message = RouterOutputs["getChat"]["messages"][number];

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
    createWSClient({ url: "ws://localhost:8080/trpc" })
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
            url: "http://localhost:8080/trpc",
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

function Chat({ chatId, flightName }: { chatId: string; flightName: string }) {
  const createSession = trpc.createSession.useMutation();
  const chat = trpc.getChat.useInfiniteQuery(
    { take: 30, chatId },
    {
      retry: (n, error) => n < 3 && error.data?.code !== "UNAUTHORIZED",
      getPreviousPageParam: (lastPage) => lastPage.nextCursor,
      onError: async (err) => {
        if (err.data?.code === "UNAUTHORIZED") {
          await createSession.mutateAsync();
          chat.refetch();
        }
      },
    }
  );
  const [currentMsg, setCurrentMsg] = useState("");

  const postMessage = trpc.postMessage.useMutation();

  const [subscriptionMessages, setSubscriptionMessages] = useState<Message[]>(
    []
  );

  trpc.onNewMessage.useSubscription(
    { chatId },
    {
      onData: (message) => {
        setSubscriptionMessages((current) => current.concat(message));
      },
    }
  );

  if (chat.error?.data?.code === "UNAUTHORIZED") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center flex-col text-fr-orange">
          <AirplaneIcon className="h-10 w-10" />
          <p className="text-xl">Creating a new username</p>
        </div>
      </div>
    );
  } else if (chat.isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center flex-col text-fr-orange">
          <AirplaneIcon className="h-10 w-10" />
          <p className="text-xl">Loading chat</p>
        </div>
      </div>
    );
  } else if (chat.isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center flex-col text-fr-light">
          <p className="text-lg">An unexpected error ocurred</p>
          <p>Please try again</p>
        </div>
      </div>
    );
  }

  const preloadedMessages = chat.data.pages.flatMap((p) => p.messages);
  const allMessages = [...preloadedMessages, ...subscriptionMessages];

  async function onSend(message: string) {
    await postMessage.mutateAsync({
      content: message,
      chatId,
    });
    setCurrentMsg("");
  }
  return (
    <div className="h-full flex flex-col px-3 p-3">
      <h1 className="text-fr-orange text-xl pb-3 font-semibold">
        {flightName}
      </h1>
      <Scroller
        messages={allMessages}
        fetchPrevPage={chat.fetchPreviousPage}
        hasPrevPage={!!chat.hasPreviousPage}
        isFetchingPrevPage={chat.isFetchingPreviousPage}
      />
      <ChatBox
        content={currentMsg}
        disabled={postMessage.isLoading}
        onContentChanged={setCurrentMsg}
        onSend={onSend}
      />
    </div>
  );
}

function Scroller({
  fetchPrevPage,
  hasPrevPage,
  isFetchingPrevPage,
  messages,
}: {
  messages: Message[];
  hasPrevPage: boolean;
  fetchPrevPage: () => void;
  isFetchingPrevPage: boolean;
}) {
  const chatRef = useRef<HTMLDivElement>(null);

  const [isScrolledToTheBottom, setIsScrolledToTheBottom] = useState(true);

  useEffect(() => {
    const element = chatRef.current;
    if (element && isScrolledToTheBottom) {
      element.scroll({ top: element.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const chatElement = chatRef.current;
    if (chatElement) {
      const listener = (e: Event) => {
        const element = e.target as HTMLDivElement;
        const scrollTop = element.scrollTop;
        setIsScrolledToTheBottom(
          element.scrollHeight - element.offsetHeight - scrollTop <= 10
        );
      };
      chatElement.addEventListener("scroll", listener);
      chatElement.scrollTo({
        top: chatElement.scrollHeight,
        behavior: "auto",
      });

      return () => chatElement.removeEventListener("scroll", listener);
    }
  }, []);
  return (
    <div className="flex-1 overflow-auto space-y-1" ref={chatRef}>
      {hasPrevPage ? (
        <div className="flex justify-center">
          {isFetchingPrevPage ? (
            <div>Loading</div>
          ) : (
            <button
              onClick={fetchPrevPage}
              className="text-[10px] font-semibold"
            >
              Load more
            </button>
          )}
        </div>
      ) : null}
      {messages.map((m) => (
        <p key={m.id}>
          <span className="font-semibold">{m.sender.name}:</span> {m.content}
        </p>
      ))}
    </div>
  );
}

function ChatBox({
  content,
  onContentChanged,
  onSend,
  disabled,
}: {
  content: string;
  onContentChanged: (content: string) => void;
  onSend: (content: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex justify-between items-center mt-3">
      <textarea
        className="w-full rounded resize-none outline-none p-1 bg-neutral-600 disabled:bg-neutral-700 disabled:text-fr-light/60"
        disabled={disabled}
        onChange={(e) => onContentChanged(e.target.value)}
        onKeyDown={(e) => {
          if (e.code === "Enter") {
            e.preventDefault();
            onSend(content);
          }
        }}
        value={content}
      />
      <button
        className="ml-3 rounded bg-fr-blue h-full flex-shrink-0 w-12 disabled:bg-fr-blue/40 disabled:text-fr-light/60"
        onClick={() => onSend(content)}
        disabled={disabled || !content}
      >
        Chat
      </button>
    </div>
  );
}
