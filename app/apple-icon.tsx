import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon (Apple ignores transparency and can render a
 * checkerboard/black square if the icon has any alpha, so this must be
 * fully opaque). Same temporary teal-on-black "P" monogram as app/icon.tsx,
 * just at Apple's recommended 180x180 size.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0d0e",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <span style={{ fontSize: 108, fontWeight: 700, color: "#2bb3a0" }}>P</span>
      </div>
    ),
    { ...size },
  );
}
