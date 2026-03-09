import { Outlet, useLocation } from "react-router";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./Sidenav";

const HIDE_NAV_PATHS = ["/editor"];

export function Root() {
  const location = useLocation();
  const hideNav = HIDE_NAV_PATHS.some(p => location.pathname.startsWith(p));

  return (
    <div className="min-h-screen flex" style={{ background: "#f0ece8" }}>
      {/* Left: Desktop nav sidebar */}
      {!hideNav && (
        <div className="hidden lg:flex flex-col shrink-0" style={{ width: 220 }}>
          <div className="sticky top-0 h-screen">
            <SideNav />
          </div>
        </div>
      )}

      {/* Main content — fills all remaining space, no maxWidth cap */}
      <div className="flex-1 flex flex-col min-h-screen bg-white min-w-0">
        <main className={hideNav ? "flex-1" : "flex-1 pb-16 lg:pb-0"}>
          <Outlet />
        </main>
        {!hideNav && (
          <div className="lg:hidden">
            <BottomNav />
          </div>
        )}
      </div>
    </div>
  );
}