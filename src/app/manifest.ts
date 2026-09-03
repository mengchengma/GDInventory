import type { MetadataRoute } from "next";

// Installing this from Android Chrome ("Add to Home Screen") launches gdhub with
// no browser UI at all — no URL bar to swipe down for, unlike the Fullscreen API.
// start_url points at the kiosk so the tablet's icon opens straight into it;
// staff reach the hub through the PIN exit.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gaming Dojo Hub",
    short_name: "GD Hub",
    description: "Staff hub — inventory, events, and member registration.",
    start_url: "/members",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
