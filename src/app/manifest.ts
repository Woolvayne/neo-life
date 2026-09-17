import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NovaCity: Urban Response",
    short_name: "NovaCity",
    description: "An original open-world roleplay experience built for the browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#05080d",
    theme_color: "#05080d",
    icons: [
      {
        src: "/novacity-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Play NovaCity",
        short_name: "Play",
        description: "Launch the NovaCity game client",
        url: "/play",
      },
    ],
  };
}
