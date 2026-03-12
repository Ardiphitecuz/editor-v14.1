import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./Sidenav";
import { SplashScreen } from "./SplashScreen";

const HIDE_NAV_PATHS = ["/editor"];

function shouldShowSplash() {
  try { return !sessionStorage.getItem("otaku_splash_v1"); } catch { return false; }
}

export function Root() {
  const location = useLocation();
  const hideNav = HIDE_NAV_PATHS.some(p => location.pathname.startsWith(p));
  const [showSplash, setShowSplash] = useState(shouldShowSplash);

  function handleSplashDone() {
    try { sessionStorage.setItem("otaku_splash_v1", "1"); } catch {}
    setShowSplash(false);
  }

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <div className="min-h-screen flex" style={{ background: "#f8f5f1" }}>
        {!hideNav && (
          <div className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen" style={{ width: 240 }}>
            <SideNav />
          </div>
        )}
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
    </>
  );
}