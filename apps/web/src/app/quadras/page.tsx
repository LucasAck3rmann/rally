// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import { Filtros } from "@/components/quadras/filtros";
import { QuadraCard } from "@/components/quadras/quadra-card";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Container } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SectionLabel } from "@/components/ui/section-label";
import { ErroDeApi } from "@/lib/api/client";
import { listarQuadras, type QuadraResumo } from "@/lib/api/quadras";

export const metadata: Metadata = {
  title: "Quadras de areia",
  description:
    "Encontre quadras de beach tennis, futevôlei e vôlei de praia, veja os horários livres do dia e o preço da hora.",
  alternates: { canonical: "/quadras" },
};

type Filtro = { busca?: string; modalidade?: string };

export default async function QuadrasPage({ searchParams }: { searchParams: Promise<Filtro> }) {
  const filtros = await searchParams;

  let quadras: QuadraResumo[] = [];
  let erro: ErroDeApi | null = null;
  try {
    quadras = await listarQuadras(filtros);
  } catch (causa) {
    // Vitrine fora do ar é estado de tela, não página de erro: os filtros
    // continuam navegáveis e a pessoa pode tentar de novo.
    if (!(causa instanceof ErroDeApi)) throw causa;
    erro = causa;
  }

  const filtrando = Boolean(filtros.busca || filtros.modalidade);

  return (
    <>
      <Header />

      <main id="conteudo" className="pt-16">
        <Container className="py-12 lg:py-16">
          <SectionLabel>Vitrine · quadras de areia</SectionLabel>
          <h1 className="mt-4 max-w-2xl font-display text-[34px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[46px]">
            Ache a quadra e o horário.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-gray">
            Preço da hora, modalidades e a agenda real de cada quadra — sem precisar perguntar no
            WhatsApp.
          </p>

          <div className="mt-10">
            <Filtros busca={filtros.busca} modalidade={filtros.modalidade} />
          </div>

          <div className="mt-10">
            {erro ? (
              <Notice
                tom="atencao"
                rotulo="Vitrine indisponível"
                titulo="Não deu para carregar as quadras agora."
              >
                {erro.foraDoAr
                  ? "A API do Rally não respondeu. Em desenvolvimento, suba o back-end com docker compose up e recarregue a página."
                  : erro.message}
              </Notice>
            ) : quadras.length === 0 ? (
              <Notice
                rotulo={filtrando ? "Nenhum resultado" : "Vitrine vazia"}
                titulo={
                  filtrando
                    ? "Nenhuma quadra com esses filtros."
                    : "Ainda não há quadras cadastradas."
                }
              >
                {filtrando
                  ? "Tente outra modalidade ou limpe a busca."
                  : "Assim que o primeiro estabelecimento entrar, as quadras aparecem aqui."}
              </Notice>
            ) : (
              <>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray">
                  {quadras.length} {quadras.length === 1 ? "quadra" : "quadras"}
                </p>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {quadras.map((quadra) => (
                    <li key={quadra.id}>
                      <QuadraCard quadra={quadra} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Container>
      </main>

      <Footer />
    </>
  );
}
