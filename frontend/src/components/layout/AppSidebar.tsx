import { Link, useLocation } from "react-router-dom";
import { Camera, LayoutDashboard, Image, Users, Bot, Upload, Send, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Image, label: "Gallery", path: "/gallery" },
  { icon: Users, label: "People", path: "/people" },
  { icon: Upload, label: "Upload Center", path: "/upload" },
  { icon: Send, label: "Deliveries", path: "/deliveries" },
  { icon: Bot, label: "AI Assistant", path: "/assistant" },
];

const AppSidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Camera className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-foreground">Drishyamitra</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:scale-105"
                }`}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-lg border border-border bg-background p-3">
        <p className="truncate text-sm font-semibold text-foreground">{user?.name || "User"}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email || ""}</p>
        <button
          type="button"
          onClick={logout}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-destructive hover:text-destructive-foreground hover:scale-105"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
