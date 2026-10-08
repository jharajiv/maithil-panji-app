import { ImageResponse } from "next/og";

export const alt = "Maithil Panji — build your Maithil family tree";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** the picture shown when the home page address is pasted into WhatsApp, Facebook, X… */
export default function OgImage() {
  const box = (w: number, accent = false) => <div style={{ display: "flex", width: w, height: 44, borderRadius: 10, background: accent ? "#a63a1d" : "#fbf7ef" }} />;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1f2a5c", color: "#fbf7ef", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingRight: 24 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#f0c9a8" }}>Maithil Panji · PAAG Foundation</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.08 }}>Preserve your Maithil ancestry.</div>
            <div style={{ display: "flex", marginTop: 20, fontSize: 36, color: "#e8dcc8" }}>Build a tree. Join the lineage.</div>
          </div>
          <div style={{ display: "flex", fontSize: 30 }}>
            <div style={{ display: "flex", background: "#a63a1d", color: "#fff", padding: "14px 26px", borderRadius: 14, fontWeight: 700 }}>Start building your family tree — free</div>
            <div style={{ display: "flex", alignItems: "center", marginLeft: 22, color: "#f0c9a8" }}>paag.org.in</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 380 }}>
          {box(150, true)}<div style={{ display: "flex", width: 3, height: 30, background: "#c9b9a0" }} />
          <div style={{ display: "flex" }}>{box(150)}<div style={{ display: "flex", width: 14 }} />{box(150)}</div>
          <div style={{ display: "flex", width: 3, height: 30, background: "#c9b9a0" }} />
          <div style={{ display: "flex" }}>{box(100)}<div style={{ display: "flex", width: 10 }} />{box(100)}<div style={{ display: "flex", width: 10 }} />{box(100)}</div>
        </div>
      </div>
    ),
    size,
  );
}
