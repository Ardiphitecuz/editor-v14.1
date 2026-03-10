import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { HomePage } from "./components/HomePage";
import { ArticlePage } from "./components/ArticlePage";
import { EditorPage } from "./components/EditorPage";
import { SettingsPage } from "./components/SettingsPage";
import { FetchRSSPage } from "./components/FetchRSSPage";
import { ExplorePage } from "./components/ExplorePage";
import { SavedPage } from "./components/SavedPage";
import { SubscriptionsPage } from "./components/Subscriptionspage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomePage },
      { path: "artikel/:id", Component: ArticlePage },
      { path: "jelajahi", Component: ExplorePage },
      { path: "simpan", Component: SavedPage },
      { path: "subscriptions", Component: Subscriptionspage },
      { path: "editor", Component: EditorPage },
      { path: "pengaturan", Component: SettingsPage },
      { path: "fetchrss", Component: FetchRSSPage },
      { path: "*", Component: HomePage },
    ],
  },
]);
