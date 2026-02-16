import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

const AppLayout = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <div className="flex flex-1 flex-col pl-60">
        {/* <TopBar /> */}
        <main className="flex-1 p-6 animate-fade-in" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
