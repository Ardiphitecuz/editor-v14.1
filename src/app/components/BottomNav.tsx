import { useNavigate, useLocation } from "react-router";
import { Home, Compass, Edit3, Bookmark, Settings } from "lucide-react";
import svgPaths from "../../imports/svg-0zf9wwjyvn";

const NAV_PATHS = [
  { label: "Beranda", path: "/" },
  { label: "Jelajahi", path: "/jelajahi" },
  { label: "Editor", path: "/editor" },
  { label: "Simpan", path: "/simpan" },
  { label: "Sumber", path: "/pengaturan" },
];

function NavIcon({ path, active }: { path: string; active: boolean }) {
  const color = active ? "#ff742f" : "#9ca3af";
  const size = 22;
  if (path === "/") return <Home size={size} color={color} />;
  if (path === "/jelajahi") return <Compass size={size} color={color} />;
  if (path === "/simpan") return <Bookmark size={size} color={color} />;
  if (path === "/pengaturan") return <Settings size={size} color={color} />;
  return null;
}

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-neutral-100 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 h-16">
        {NAV_PATHS.map((item) => {
          const active = isActive(item.path);
          const isEditor = item.path === "/editor";

          if (isEditor) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all active:scale-90"
                style={{
                  background: "linear-gradient(135deg, #ff742f 0%, #ff9a5c 100%)",
                  boxShadow: "0 4px 20px rgba(255,116,47,0.4)",
                  marginTop: -16,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 41.667 41.6667" fill="none">
                  <path d={svgPaths.p29f60d00} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                </svg>
                <span className="text-white" style={{ fontSize: 9, fontWeight: 700, marginTop: 1 }}>
                  Editor
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all active:scale-95"
            >
              <NavIcon path={item.path} active={active} />
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? "#ff742f" : "#9ca3af" }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}