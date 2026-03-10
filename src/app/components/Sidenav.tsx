import { useNavigate, useLocation } from "react-router";
import {
  Home, Rss, MessageSquare, Bell,
  Search, Settings, User, ChevronDown,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Home",     path: "/",               icon: Home },
  { label: "Sources",  path: "/subscriptions",  icon: Rss },
  // { label: "Chat",     path: "/editor",         icon: MessageSquare },
  { label: "Activity", path: "/activity",       icon: Bell },
  { label: "Explore",  path: "/jelajahi",       icon: Search },
  { label: "Settings", path: "/pengaturan",     icon: Settings },
  { label: "Profile",  path: "/profile",        icon: User },
];

export function SideNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className="flex flex-col h-full py-5"
      style={{
        background: "#fff",
        borderRight: "1px solid #f0ede9",
        width: "100%",
      }}
    >
      {/* Logo */}
      <div className="px-5 mb-6">
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: 26 }}>☕</span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.1, letterSpacing: "-0.3px" }}>
              Otaku Cafe
            </p>
            <p style={{ fontSize: 10, color: "#b0a89e", fontWeight: 500 }}>Aggregator</p>
          </div>
        </div>
      </div>

      {/* Nav list */}
      <nav className="flex flex-col gap-0.5 flex-1 px-3">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-4 px-3 py-3 rounded-xl w-full text-left transition-all active:scale-[0.98]"
              style={{
                background: active ? "#f8f5f1" : "transparent",
                color: active ? "#1a1a1a" : "#6b6560",
              }}
            >
              {label === "Profile" ? (
                <div
                  className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#ff742f,#c0392b)" }}
                >
                  <User size={14} color="white" />
                </div>
              ) : (
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.7}
                  color={active ? "#1a1a1a" : "#8a8078"}
                />
              )}
              <span style={{
                fontSize: 15,
                fontWeight: active ? 700 : 400,
                letterSpacing: "-0.1px",
                color: active ? "#1a1a1a" : "#4a4540",
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Create Post button */}
      <div className="px-4 pt-4 mt-2">
        <button
          onClick={() => navigate("/editor")}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl transition-all active:scale-[0.97] hover:opacity-90"
          style={{ background: "#ff742f", color: "white" }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.2px" }}>Create</span>
          <div
            className="flex items-center justify-center w-5 h-5 rounded"
            style={{ background: "rgba(0,0,0,0.15)" }}
          >
            <ChevronDown size={13} color="white" strokeWidth={2.5} />
          </div>
        </button>
      </div>
    </aside>
  );
}