import { Link, useLocation } from "react-router-dom";
import { Camera, LayoutDashboard, Image, Users, Bot, Upload, Send, Settings } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* <div className="mx-3 mb-3 rounded-lg border border-border bg-background p-4">
        <p className="text-xs font-semibold text-primary">STORAGE PLAN</p>
        <Progress value={72} className="my-2 h-1.5" />
        <p className="text-xs text-muted-foreground">72.4 GB of 100 GB used</p>
        <button className="mt-3 w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
          Upgrade Pro
        </button>
      </div> */}


    </aside>
  );
};

export default AppSidebar;
