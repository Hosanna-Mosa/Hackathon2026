import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAssistantPage = location.pathname === "/assistant";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <div className="flex flex-1 flex-col pl-60">
        {/* <TopBar /> */}
        <main className="flex-1 p-6 animate-fade-in" key={location.pathname}>
          <Outlet />
        </main>
      </div>
      <button
        type="button"
        onClick={() => navigate("/assistant")}
        disabled={isAssistantPage}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 disabled:cursor-default disabled:opacity-70"
        title={isAssistantPage ? "You are on AI Assistant" : "Open AI Assistant"}
        aria-label="Open AI Assistant"
      >
        <MessageCircle className="h-6 w-6" />
        {!isAssistantPage && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-destructive" />
        )}
      </button>
    </div>
  );
};

export default AppLayout;
