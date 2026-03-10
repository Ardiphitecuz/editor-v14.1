import { useNavigate, useLocation } from "react-router";
import { Home, Search, Bookmark, Rss, PlusCircle } from "lucide-react";

const NAV_PATHS = [
  { label: "Home",    path: "/",              icon: Home },
  { label: "Explore", path: "/jelajahi",      icon: Search },
  { label: "Saved",   path: "/simpan",        icon: Bookmark },
  { label: "Sources", path: "/subscriptions", icon: Rss },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid #f0ede9",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center h-16 px-2">
        {/* Left: Home, Explore */}
        {NAV_PATHS.slice(0, 2).map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all active:scale-95"
            >
              <Icon size={21} strokeWidth={active ? 2.2 : 1.7} color={active ? "#ff742f" : "#a09890"} />
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? "#ff742f" : "#a09890" }}>
                {label}
              </span>
            </button>
          );
        })}

        {/* Center: Create */}
        <button
          onClick={() => navigate("/editor")}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all active:scale-90"
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #ff742f 0%, #ff9a5c 100%)",
              boxShadow: "0 4px 14px rgba(255,116,47,0.4)",
              marginTop: -14,
            }}
          >
            <PlusCircle size={22} color="white" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#ff742f", marginTop: 1 }}>Create</span>
        </button>

        {/* Right: Saved, Sources */}
        {NAV_PATHS.slice(2).map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all active:scale-95"
            >
              <Icon size={21} strokeWidth={active ? 2.2 : 1.7} color={active ? "#ff742f" : "#a09890"} />
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? "#ff742f" : "#a09890" }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}