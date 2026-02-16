import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Send, Sparkles, Bot, Mic, Plus, Clock, MoreVertical } from "lucide-react";
import { chatWithAgentApi, type Photo } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";

const suggestedQueries = [
  "Show photos",
  "Show John photos",
  "Send Mom pictures on whatsapp",
  "Find my latest uploads",
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: string;
  photos?: Photo[];
};

const AIAssistant = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      role: "assistant",
      text: "AI Assistant is online. Ask me to fetch photos or log a delivery action.",
    },
  ]);

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

      if (response.result.data?.navigate && response.result.data?.targetUrl) {
        setTimeout(() => {
          navigate(response.result.data.targetUrl as string);
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

  return (
    <div className="animate-fade-in flex h-[calc(100vh-7rem)] gap-6">
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">AI Assistant</p>
              <p className="text-xs text-success">● SYSTEM ONLINE</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent" type="button">
              <Clock className="h-4 w-4" />
            </button>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent" type="button">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((msg) => (
            <div key={msg.id}>
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
                          <div key={photo._id} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border">
                            <img
                              src={resolvePhotoUrl(photo.imageUrl || photo.path, photo.filename)}
                              alt={photo.filename || "Assistant result photo"}
                              className="h-full w-full object-cover transition-transform hover:scale-110"
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
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="rounded-xl rounded-tl-none border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                <span className="animate-pulse-soft">● ● ●</span> Drishyamitra is thinking...
              </div>
            </div>
          )}
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
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent" type="button">
              <Plus className="h-5 w-5" />
            </button>
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
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent" type="button">
              <Mic className="h-5 w-5" />
            </button>
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

      <div className="hidden w-72 space-y-6 xl:block">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-bold uppercase text-muted-foreground">Agent Capability</h3>
          <div className="mt-3 space-y-2 text-sm text-foreground">
            <p>1. Fetch photos by person intent</p>
            <p>2. Trigger delivery log simulation</p>
            <p>3. Route unknown intents to assistant reply</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
