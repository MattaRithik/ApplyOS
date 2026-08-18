import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ApplyOS — Application Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          background: "#191815",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 176,
            height: 176,
            borderRadius: 40,
            background: "linear-gradient(135deg, #C6A46A 0%, #8A9C86 55%, #78907A 100%)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none">
            <path
              d="M5.5 17L12 11.2M12 11.2L18.5 5M12 11.2L16.5 15"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <circle cx="5.5" cy="17" r="2.1" fill="white" />
            <circle cx="12" cy="11.2" r="2.4" fill="white" />
            <circle cx="18.5" cy="5" r="2.7" fill="white" />
            <circle cx="16.5" cy="15" r="1.6" fill="white" fillOpacity="0.75" />
          </svg>
        </div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, color: "#F4EFE5" }}>ApplyOS</div>
        <div style={{ display: "flex", fontSize: 34, color: "#BDB4A5" }}>Your job search, in one command center</div>
      </div>
    ),
    { ...size }
  );
}
