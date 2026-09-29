// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MetadataRoute } from "next";
import { listarQuadras } from "@/lib/api/quadras";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * As quadras entram no mapa quando a API responde. Se ela estiver fora — o que
 * acontece em build de ambiente isolado —, o site publica só as rotas fixas em
 * vez de quebrar a geração.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixas: MetadataRoute.Sitemap = [
    { url: `${site}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${site}/quadras`, changeFrequency: "daily", priority: 0.8 },
  ];

  try {
    const quadras = await listarQuadras();
    return [
      ...fixas,
      ...quadras.map((quadra) => ({
        url: `${site}/quadras/${quadra.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return fixas;
  }
}
