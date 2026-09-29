import type { MetadataRoute } from "next";

/* Makes the Epoch wallet installable ("Add to Home screen"): opens straight to your pass. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Epoch · GitHub Community Club",
    short_name: "Epoch",
    description: "Your Epoch wallet: coins, QR pass, booths and the plan.",
    start_url: "/epoch/wallet?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#0b0b0f",
    icons: [
      { src: "/icons/epoch-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/epoch-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/epoch-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/epoch-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan a booth", url: "/epoch/scan", icons: [{ src: "/icons/epoch-192.png", sizes: "192x192" }] },
      { name: "Booths", url: "/epoch/booths" },
    ],
  };
}
