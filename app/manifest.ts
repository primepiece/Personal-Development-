import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prime James",
    short_name: "Prime James",
    description: "The personal operating system for becoming Prime James.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0d0e",
    theme_color: "#0a0d0e",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
