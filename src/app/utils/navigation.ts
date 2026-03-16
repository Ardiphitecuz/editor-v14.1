import { NavigateOptions, To } from "react-router";

/**
 * Tentative helper to request fullscreen and then navigate.
 * Browsers require a user gesture (like a click) to enter fullscreen.
 * This is meant to be called in an onClick handler.
 */
export async function requestFullscreenAndNavigate(
  to: To,
  navigate: (to: To, options?: NavigateOptions) => void,
  options?: NavigateOptions
) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile && !document.fullscreenElement) {
    try {
      // We request fullscreen on the documentElement so the entire app
      // stays in fullscreen even after navigation.
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
  }
  
  // Navigate after (or during) the fullscreen request
  navigate(to, options);
}
