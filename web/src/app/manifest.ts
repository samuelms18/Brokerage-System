import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StayNear: student rooms",
    short_name: "StayNear",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8fa",
    theme_color: "#0f7668",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
