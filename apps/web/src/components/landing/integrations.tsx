// SPDX-License-Identifier: AGPL-3.0-or-later
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";

const itens = [
  { nome: "Pix", nota: "Pagamento instantâneo" },
  { nome: "AbacatePay", nota: "Gateway e webhook" },
  { nome: "WhatsApp", nota: "Confirmação e lembrete" },
  { nome: "Visa · Master", nota: "Cartão de crédito" },
  { nome: "AWS", nota: "Infraestrutura e mídia" },
  { nome: "Cloudflare", nota: "DNS, CDN e WAF" },
];

export function Integrations() {
  return (
    <section aria-labelledby="titulo-integracoes" className="border-y border-line bg-sand/30">
      <Container className="py-20 lg:py-24">
        <SectionLabel index="06">Integrações e infraestrutura</SectionLabel>

        <h2
          id="titulo-integracoes"
          className="mt-4 max-w-2xl font-display text-[32px] font-bold leading-tight tracking-tight text-ink sm:text-[42px]"
        >
          Conversa com o que você já usa.
        </h2>

        <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3 lg:grid-cols-6">
          {itens.map((item) => (
            <li key={item.nome} className="bg-bg px-5 py-7">
              <p className="font-display text-base font-bold leading-tight text-ink">{item.nome}</p>
              <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-gray">
                {item.nota}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
