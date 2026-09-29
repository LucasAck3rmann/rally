// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { GradeDeHorarios, SeletorDeDia } from "@/components/quadras/grade-horarios";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/link-button";
import { Notice } from "@/components/ui/notice";
import { SectionLabel } from "@/components/ui/section-label";
import { ErroDeApi } from "@/lib/api/client";
import {
  obterDisponibilidade,
  obterQuadra,
  type Disponibilidade,
  type QuadraDetalhe,
} from "@/lib/api/quadras";
import { formatarPreco, hojeNaQuadra, proximosDias } from "@/lib/formato";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ data?: string }>;
};

/** Busca a quadra traduzindo o 404 da API no 404 do Next. */
async function carregarQuadra(id: string): Promise<QuadraDetalhe | null> {
  try {
    return await obterQuadra(id);
  } catch (causa) {
    if (causa instanceof ErroDeApi && causa.status === 404) notFound();
    if (causa instanceof ErroDeApi) return null;
    throw causa;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const quadra = await carregarQuadra((await params).id);
  if (!quadra) return { title: "Quadra" };

  const local = quadra.estabelecimento;
  const onde = [local.bairro, local.cidade].filter(Boolean).join(", ");
  return {
    title: `${quadra.nome} · ${local.nome}`,
    description:
      quadra.descricao ??
      `${quadra.modalidades.join(", ")} em ${local.nome}${onde ? `, ${onde}` : ""}. Veja os horários livres e o preço da hora.`,
    alternates: { canonical: `/quadras/${quadra.id}` },
  };
}

export default async function QuadraPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { data: dataPedida } = await searchParams;

  const quadra = await carregarQuadra(id);

  if (!quadra) {
    return (
      <>
        <Header />
        <main id="conteudo" className="pt-16">
          <Container className="py-20">
            {/* Toda página precisa de um h1, inclusive a que só mostra o erro. */}
            <h1 className="sr-only">Quadra indisponível</h1>
            <Notice
              tom="atencao"
              rotulo="Quadra indisponível"
              titulo="Não deu para carregar esta quadra agora."
            >
              A API do Rally não respondeu. Em desenvolvimento, suba o back-end com{" "}
              <code className="font-mono text-[13px]">docker compose up</code>.
            </Notice>
            <div className="mt-8 text-center">
              <LinkButton href="/quadras" variant="secondary">
                Voltar para a vitrine
              </LinkButton>
            </div>
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  // Dia fora da janela oferecida cai no dia de hoje — evita consultar data
  // arbitrária vinda da URL.
  const dias = proximosDias(7);
  const data = dataPedida && dias.includes(dataPedida) ? dataPedida : hojeNaQuadra();

  let disponibilidade: Disponibilidade | null = null;
  try {
    disponibilidade = await obterDisponibilidade(quadra.id, data);
  } catch (causa) {
    if (!(causa instanceof ErroDeApi)) throw causa;
  }

  const local = quadra.estabelecimento;
  const onde = [local.bairro, local.cidade, local.uf].filter(Boolean).join(" · ");
  const [capa, ...outrasFotos] = quadra.fotos;

  return (
    <>
      <Header />

      <main id="conteudo" className="pt-16">
        <Container className="py-12 lg:py-16">
          <nav
            aria-label="Você está em"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray"
          >
            <LinkButton href="/quadras" variant="ghost" className="-ml-5 px-5">
              ← Todas as quadras
            </LinkButton>
          </nav>

          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <div className="relative aspect-[4/3] overflow-hidden rounded-surface border border-line bg-sand">
                {capa ? (
                  <Image
                    src={capa}
                    alt={`Quadra ${quadra.nome}, no ${local.nome}`}
                    fill
                    priority
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover"
                  />
                ) : null}
              </div>

              {outrasFotos.length > 0 ? (
                <ul className="mt-3 grid grid-cols-3 gap-3">
                  {outrasFotos.slice(0, 3).map((foto, i) => (
                    <li
                      key={foto}
                      className="relative aspect-[4/3] overflow-hidden rounded-card border border-line bg-sand"
                    >
                      <Image
                        src={foto}
                        alt={`Outra vista da quadra ${quadra.nome} (${i + 2} de ${quadra.fotos.length})`}
                        fill
                        sizes="(min-width: 1024px) 20vw, 33vw"
                        className="object-cover"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="lg:col-span-5">
              <SectionLabel>
                {local.nome}
                {onde ? ` · ${onde}` : ""}
              </SectionLabel>

              <h1 className="mt-4 font-display text-[32px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-[40px]">
                {quadra.nome}
              </h1>

              {local.nota !== null ? (
                <p
                  className="mt-3 font-mono text-[12px] text-gray"
                  aria-label={`Nota ${local.nota.toFixed(1)} de 5, ${local.avaliacoes} avaliações`}
                >
                  <span aria-hidden="true" className="text-sun">
                    ★
                  </span>{" "}
                  {local.nota.toFixed(1)} <span aria-hidden="true">({local.avaliacoes})</span>
                </p>
              ) : null}

              <ul className="mt-5 flex flex-wrap gap-1.5">
                {quadra.modalidades.map((modalidade) => (
                  <li
                    key={modalidade}
                    className="rounded-chip border border-line bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gray"
                  >
                    {modalidade}
                  </li>
                ))}
              </ul>

              {quadra.descricao ? (
                <p className="mt-6 text-[15px] leading-relaxed text-gray">{quadra.descricao}</p>
              ) : null}

              <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line">
                <div className="bg-white px-5 py-4">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray">
                    Preço da hora
                  </dt>
                  <dd className="mt-1.5 font-display text-xl font-extrabold text-ink">
                    {formatarPreco(quadra.precoHora)}
                  </dd>
                </div>
                <div className="bg-white px-5 py-4">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray">
                    {local.descontoPixPct > 0 ? "No Pix" : "Capacidade"}
                  </dt>
                  <dd className="mt-1.5 font-display text-xl font-extrabold text-ink">
                    {local.descontoPixPct > 0
                      ? `−${local.descontoPixPct}%`
                      : quadra.capacidade
                        ? `${quadra.capacidade} pessoas`
                        : "—"}
                  </dd>
                </div>
              </dl>

              {quadra.comodidades.length > 0 ? (
                <div className="mt-8">
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray">
                    Comodidades
                  </h2>
                  <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[15px] text-ink">
                    {quadra.comodidades.map((comodidade) => (
                      <li key={comodidade} className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral"
                        />
                        {comodidade}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <section aria-labelledby="titulo-agenda" className="mt-16 border-t border-line pt-10">
            <h2 id="titulo-agenda" className="sr-only">
              Agenda da quadra
            </h2>

            <SeletorDeDia quadraId={quadra.id} selecionado={data} />

            <div className="mt-8">
              {disponibilidade ? (
                <GradeDeHorarios disponibilidade={disponibilidade} />
              ) : (
                <Notice
                  tom="atencao"
                  rotulo="Agenda indisponível"
                  titulo="Não deu para carregar os horários deste dia."
                >
                  Tente outro dia ou recarregue a página.
                </Notice>
              )}
            </div>

            <p className="mt-8 rounded-card border border-line bg-sand/30 px-5 py-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-gray">
              Reservar pela web entra na próxima etapa · hoje o fluxo completo de reserva e
              pagamento está no app
            </p>
          </section>
        </Container>
      </main>

      <Footer />
    </>
  );
}
