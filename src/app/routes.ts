import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { HomePage } from "./components/HomePage";
import { ArticlePage } from "./components/ArticlePage";
import { EditorPage } from "./components/EditorPage";
import { SettingsPage } from "./components/SettingsPage";
import { FetchRSSPage } from "./components/FetchRSSPage";
import { ExplorePage } from "./components/ExplorePage";
import { DraftPage } from "./components/DraftPage";
import { SavedPage } from "./components/SavedPage";
import { SubscriptionsPage } from "./components/Subscriptionspage";
import { NotFoundPage } from "./components/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomePage },
      { path: "artikel/:id", Component: ArticlePage },
      { path: "jelajahi", Component: DraftPage },
      { path: "explore", Component: ExplorePage },
      { path: "simpan", Component: SavedPage },
      { path: "subscriptions", Component: SubscriptionsPage },
      { path: "editor", Component: EditorPage },
      { path: "pengaturan", Component: SettingsPage },
      { path: "fetchrss", Component: FetchRSSPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
