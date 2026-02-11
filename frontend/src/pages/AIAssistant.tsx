import { useState } from "react";
import { Send, Sparkles, Bot, Mic, Plus, Clock, MoreVertical, ExternalLink } from "lucide-react";
import photo1 from "@/assets/photo-1.jpg";
import photo3 from "@/assets/photo-3.jpg";
import person1 from "@/assets/person-1.jpg";
import person2 from "@/assets/person-2.jpg";
import person3 from "@/assets/person-3.jpg";

const suggestedQueries = [
  "Show John photos",
  "Send Mom pictures",
  'Filter by "Summer"',
  "Group by faces",
];

const AIAssistant = () => {
  const [input, setInput] = useState("");

  return (
    <div className="animate-fade-in flex h-[calc(100vh-7rem)] gap-6">
      {/* Chat area */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        {/* Chat header */}
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
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
              <Clock className="h-4 w-4" />
            </button>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Bot message */}
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="max-w-lg rounded-xl rounded-tl-none border border-border bg-card p-4 text-sm text-foreground">
              <p>
                Hello Alex! I've finished indexing your{" "}
                <span className="font-semibold text-primary">1,240 new photos</span> from the last
                weekend trip. I've also identified 3 new faces you might want to tag.
              </p>
              <p className="mt-2">How can I help you find a memory today?</p>
            </div>
          </div>
          <p className="pl-11 text-xs text-muted-foreground">10:24 AM</p>

          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-lg rounded-xl rounded-tr-none bg-primary p-4 text-sm text-primary-foreground">
              Show me photos of John from last summer near the beach.
            </div>
          </div>
          <p className="text-right text-xs text-muted-foreground">10:25 AM</p>

          {/* Bot response with images */}
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="max-w-lg rounded-xl rounded-tl-none border border-border bg-card p-4 text-sm text-foreground">
              <p>
                Found them! Here are <strong>12 photos</strong> of John at Malibu Beach from August 2023.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <img src={photo3} alt="Beach 1" className="rounded-lg object-cover aspect-video" />
                <img src={person1} alt="John" className="rounded-lg object-cover aspect-video" />
                <img src={photo1} alt="Beach 2" className="rounded-lg object-cover aspect-video" />
              </div>
              <button className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View full album <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
          <p className="pl-11 text-xs text-muted-foreground">10:25 AM</p>

          {/* Thinking indicator */}
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="rounded-xl rounded-tl-none border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <span className="animate-pulse-soft">● ● ●</span> Drishyamitra is thinking...
            </div>
          </div>
        </div>

        {/* Suggested queries */}
        <div className="flex gap-2 px-5 pb-3">
          {suggestedQueries.map((q) => (
            <button
              key={q}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
              <Plus className="h-5 w-5" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Drishyamitra to find a memory..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
              <Mic className="h-5 w-5" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-72 space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase text-muted-foreground">Detected Faces</h3>
          <div className="mt-3 flex items-center gap-2">
            {[person1, person2, person3].map((p, i) => (
              <img
                key={i}
                src={p}
                alt="Face"
                className={`h-12 w-12 rounded-full object-cover ring-2 ${
                  i === 0 ? "ring-primary" : "ring-border"
                }`}
              />
            ))}
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border text-xs font-medium text-muted-foreground">
              +14
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-bold uppercase text-muted-foreground">Chat Context</h3>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase text-primary">Time Range</p>
              <p className="text-sm text-foreground">Aug 1, 2023 - Aug 31, 2023</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-primary">Location</p>
              <p className="text-sm text-foreground">Malibu, CA</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-primary">Person Tagged</p>
              <p className="text-sm text-foreground">John Doe</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-primary">Storage Usage</p>
          <div className="my-2 h-1.5 rounded-full bg-muted">
            <div className="h-full w-3/4 rounded-full bg-primary" />
          </div>
          <p className="text-xs text-muted-foreground">75.4 GB of 100 GB used</p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
