// SPDX-License-Identifier: AGPL-3.0-or-later
import { ImageResponse } from "next/og";
import { colors as tokens } from "@rally/tokens";

export const alt = "Rally — do agendamento ao replay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Card de compartilhamento, desenhado com os tokens da paleta (DESIGN.md). */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#FFF7EE",
        padding: 72,
        border: "16px solid #1C2B33",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: tokens.coral,
            border: "4px solid #1C2B33",
          }}
        />
        <div style={{ fontSize: 26, letterSpacing: 6, color: tokens.gray }}>
          EST. 2026 · QUADRAS DE AREIA
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", color: "#1C2B33" }}>
        <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1.05 }}>Do agendamento</div>
        {/* O satori exige display flex em qualquer nó com mais de um filho. */}
        <div style={{ display: "flex", fontSize: 104, fontWeight: 800, lineHeight: 1.05 }}>
          <span>ao&nbsp;</span>
          <span style={{ color: tokens.coralDeep }}>replay</span>
          <span>.</span>
        </div>
      </div>
      <div style={{ fontSize: 30, color: tokens.gray }}>
        Agenda em tempo real · Pix · replays dos jogos
      </div>
    </div>,
    size,
  );
}
