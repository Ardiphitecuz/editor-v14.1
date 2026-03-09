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
  const color = active ? "#ff742f" : "#555";
  const size = 20;
  if (path === "/") return <Home size={size} color={color} />;
  if (path === "/jelajahi") return <Compass size={size} color={color} />;
  if (path === "/editor") return <Edit3 size={size} color="white" />;
  if (path === "/simpan") return <Bookmark size={size} color={color} />;
  if (path === "/pengaturan") return <Settings size={size} color={color} />;
  return null;
}

export function SideNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="flex flex-col h-full px-4 py-6 gap-1" style={{ background: "transparent" }}>
      {/* Logo */}
      <div className="mb-6 px-3">
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1a1a1a", letterSpacing: "-0.5px" }}>
          Dis<span style={{ color: "#ff742f" }}>cuss</span>
        </h1>
        <p style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Agregator Berita</p>
      </div>

      {NAV_PATHS.map((item) => {
        const active = isActive(item.path);
        const isEditor = item.path === "/editor";

        if (isEditor) {
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all active:scale-95 mb-1"
              style={{
                background: "linear-gradient(135deg, #ff742f 0%, #ff9a5c 100%)",
                boxShadow: "0 4px 16px rgba(255,116,47,0.35)",
                color: "white",
              }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.25)" }}>
                <svg width="18" height="18" viewBox="0 0 41.667 41.6667" fill="none">
                  <path d={svgPaths.p29f60d00} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Editor</span>
            </button>
          );
        }

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all active:scale-95 text-left"
            style={{
              background: active ? "#ff742f15" : "transparent",
              color: active ? "#ff742f" : "#555",
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: active ? "#ff742f20" : "transparent" }}
            >
              <NavIcon path={item.path} active={active} />
            </div>
            <span style={{ fontSize: 14, fontWeight: active ? 700 : 500 }}>{item.label}</span>
            {active && (
              <div className="ml-auto w-1.5 h-6 rounded-full" style={{ background: "#ff742f" }} />
            )}
          </button>
        );
      })}

      <div className="mt-auto px-3 pb-2">
        <div className="rounded-2xl p-3" style={{ background: "#ff742f12", border: "1px solid #ff742f30" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ff742f" }}>Discuss v14</p>
          <p style={{ fontSize: 10, color: "#999", marginTop: 2 }}>News aggregator berbasis AI</p>
        </div>
      </div>
    </nav>
  );
}