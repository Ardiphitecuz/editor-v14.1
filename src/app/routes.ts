import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { HomePage } from "./components/HomePage";
import { ArticlePage } from "./components/ArticlePage";
import { EditorPage } from "./components/EditorPage";
import { SettingsPage } from "./components/SettingsPage";
import { FetchRSSPage } from "./components/FetchRSSPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomePage },
      { path: "artikel/:id", Component: ArticlePage },
      { path: "editor", Component: EditorPage },
      { path: "pengaturan", Component: SettingsPage },
      { path: "fetchrss", Component: FetchRSSPage },
      { path: "*", Component: HomePage },
    ],
  },
]);