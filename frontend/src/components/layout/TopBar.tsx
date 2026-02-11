import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import personImg from "@/assets/person-1.jpg";

const TopBar = () => {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-sm">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search photos, people, or ask AI assistant..."
          className="h-10 border-border bg-background pl-10 text-sm"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">Alex Rivera</p>
            <p className="text-xs text-muted-foreground">Pro Member</p>
          </div>
          <img
            src={personImg}
            alt="User avatar"
            className="h-9 w-9 rounded-full object-cover ring-2 ring-border"
          />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
