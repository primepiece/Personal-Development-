import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * Temporary, simple placeholder icon — a teal "P" monogram on the app's
 * own black background — until a real designed icon exists. Code-generated
 * so no binary asset needs to be committed; swap this file for a real
 * image-based icon.(png|svg) whenever a proper mark is designed.
 */
export default function Icon() {
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
        <span style={{ fontSize: 300, fontWeight: 700, color: "#2bb3a0" }}>P</span>
      </div>
    ),
    { ...size },
  );
}
