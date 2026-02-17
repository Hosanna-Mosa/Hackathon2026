import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, Bot } from "lucide-react";
import { chatWithAgentApi, sendChatPhotosEmailApi, getChatHistoryApi, type Photo } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";

const suggestedQueries = [
  "Show photos",
  "Show John photos",
  "Send Mom pictures on whatsapp",
  "Find my latest uploads",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHAT_STORAGE_PREFIX = "drishyamitra_assistant_chat";
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "init",
    role: "assistant",
    text: "AI Assistant is online. Ask me to fetch photos or log a delivery action.",
  },
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: string;
  photos?: Photo[];
};

type PendingEmailRequest = {
  personId?: string;
  person?: string;
  recipientName?: string;
  photoCount?: number;
};

const parseStoredMessages = (value: string): ChatMessage[] => {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return INITIAL_MESSAGES;
    }

    const messages = parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const cast = item as Partial<ChatMessage>;
        const role = cast.role === "user" || cast.role === "assistant" ? cast.role : null;
        const text = typeof cast.text === "string" ? cast.text : "";
        if (!role || !text.trim()) {
          return null;
        }
        return {
          id: typeof cast.id === "string" && cast.id.trim() ? cast.id : `${role}-${Date.now()}`,
          role,
          text,
          action: typeof cast.action === "string" ? cast.action : undefined,
          photos: Array.isArray(cast.photos) ? cast.photos : [],
        } as ChatMessage;
      })
      .filter((item): item is ChatMessage => Boolean(item));

    return messages.length > 0 ? messages : INITIAL_MESSAGES;
  } catch (_error) {
    return INITIAL_MESSAGES;
  }
};

const AIAssistant = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [pendingEmailRequest, setPendingEmailRequest] = useState<PendingEmailRequest | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const chatStorageKey = useMemo(
    () => (user?.id ? `${CHAT_STORAGE_PREFIX}:${user.id}` : ""),
    [user?.id]
  );

  useEffect(() => {
    if (!chatStorageKey || typeof window === "undefined") {
      setMessages(INITIAL_MESSAGES);
      return;
    }

    const raw = window.localStorage.getItem(chatStorageKey);
    if (!raw) {
      setMessages(INITIAL_MESSAGES);
      return;
    }

    setMessages(parseStoredMessages(raw));
  }, [chatStorageKey]);

  useEffect(() => {
    if (!chatStorageKey || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(chatStorageKey, JSON.stringify(messages));
  }, [chatStorageKey, messages]);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const response = await getChatHistoryApi(50);
        if (!active) return;

        const rebuilt = response.history
          .slice()
          .reverse()
          .flatMap((entry) => {
            const assistantText =
              entry.status === "failed"
                ? entry.errorMessage || "Failed to process request."
                : entry.assistant?.message || "No assistant response.";
            return [
              {
                id: `history-user-${entry._id}`,
                role: "user" as const,
                text: entry.prompt,
              },
              {
                id: `history-assistant-${entry._id}`,
                role: "assistant" as const,
                text: assistantText,
                action: entry.assistant?.action,
                photos: entry.assistant?.data?.photos || [],
              },
            ];
          });

        setMessages(rebuilt.length > 0 ? rebuilt : INITIAL_MESSAGES);
      } catch (_error) {
        if (active) {
          setMessages(INITIAL_MESSAGES);
        }
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  const sendMessage = async (rawMessage?: string) => {
    const message = (rawMessage ?? input).trim();
    if (!message || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: message,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      setIsSending(true);
      const response = await chatWithAgentApi(message);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: response.result.message,
        action: response.result.action,
        photos: response.result.data?.photos || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.result.action === "request_person_email") {
        setPendingEmailRequest({
          personId: response.result.data?.personId,
          person: response.result.data?.person,
          recipientName: response.result.data?.recipientName,
          photoCount: response.result.data?.photoCount,
        });
        setEmailInput("");
        setEmailError("");
        setIsEmailDialogOpen(true);
      }

      if (response.result.data?.navigate && response.result.data?.targetUrl) {
        setTimeout(() => {
          navigate(response.result.data?.targetUrl as string);
        }, 1500);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: err instanceof Error ? err.message : "Failed to contact AI service.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const onSubmitMissingEmail = async () => {
    if (!pendingEmailRequest || isSubmittingEmail) {
      return;
    }

    const email = emailInput.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    try {
      setIsSubmittingEmail(true);
      setEmailError("");

      const response = await sendChatPhotosEmailApi({
        personId: pendingEmailRequest.personId,
        person: pendingEmailRequest.person,
        recipientName: pendingEmailRequest.recipientName,
        recipientEmail: email,
        count: pendingEmailRequest.photoCount,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-email-${Date.now()}`,
          role: "assistant",
          text: response.result.message,
          action: response.result.action,
          photos: response.result.data?.photos || [],
        },
      ]);

      setIsEmailDialogOpen(false);
      setPendingEmailRequest(null);
      setEmailInput("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send photos by email.");
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  return (
    <div className="animate-fade-in flex h-[calc(100vh-7rem)] gap-6">
      <Dialog
        open={isEmailDialogOpen}
        onOpenChange={(open) => {
          if (!isSubmittingEmail) {
            setIsEmailDialogOpen(open);
          }
          if (!open) {
            setEmailError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Email To Continue</DialogTitle>
            <DialogDescription>
              Enter an email for {pendingEmailRequest?.recipientName || pendingEmailRequest?.person || "this person"} to save it and send the photos now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="name@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void onSubmitMissingEmail();
                }
              }}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
                onClick={() => setIsEmailDialogOpen(false)}
                disabled={isSubmittingEmail}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                onClick={() => void onSubmitMissingEmail()}
                disabled={isSubmittingEmail}
              >
                {isSubmittingEmail ? "Sending..." : "Save & Send"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">AI Assistant</p>
              <p className="text-xs text-success">SYSTEM ONLINE</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((msg) => (
            <div key={msg.id} className="animate-fade-in">
              {msg.role === "assistant" ? (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="max-w-2xl rounded-xl rounded-tl-none border border-border bg-card p-4 text-sm text-foreground">
                    <p>{msg.text}</p>
                    {msg.photos && msg.photos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.photos.slice(0, 8).map((photo) => (
                          <div key={photo._id} className="relative h-24 w-24 animate-scale-up overflow-hidden rounded-lg border border-border">
                            <img
                              src={resolvePhotoUrl(photo.imageUrl || photo.path, photo.filename)}
                              alt={photo.filename || "Assistant result photo"}
                              className="h-full w-full object-cover transition-transform duration-300 ease-in-out hover:scale-110"
                            />
                          </div>
                        ))}
                        {msg.photos.length > 8 && (
                          <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-muted-foreground">
                            +{msg.photos.length - 8} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="max-w-lg rounded-xl rounded-tr-none bg-primary p-4 text-sm text-primary-foreground">
                    {msg.text}
                  </div>
                </div>
              )}
            </div>
          ))}



          {isSending && (
            <div className="animate-fade-in flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="rounded-xl rounded-tl-none border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                <span className="animate-pulse-soft">. . .</span> Drishyamitra is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {suggestedQueries.map((q) => (
            <button
              key={q}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              type="button"
              onClick={() => sendMessage(q)}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Ask Drishyamitra to find a memory..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={() => sendMessage()}
              disabled={isSending || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>

      <div className="hidden w-72 space-y-6 animate-slide-in-right xl:block">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-bold uppercase text-muted-foreground">Agent Capability</h3>
          <div className="mt-3 space-y-2 text-sm text-foreground">
            <p>1. Fetch photos by person intent</p>
            <p>2. Send person photos by email</p>
            <p>3. Ask and save missing recipient email</p>
          </div>
        </div>
      </div>
    </div >
  );
};

export default AIAssistant;
