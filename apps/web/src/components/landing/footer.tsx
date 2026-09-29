// SPDX-License-Identifier: AGPL-3.0-or-later
import { Container } from "@/components/ui/container";
import { Emblem } from "@/components/ui/emblem";
import { DOCS_URL, EMAIL_CONTATO, LICENSE_URL, REPO_URL } from "@/lib/site";

const colunas = [
  {
    titulo: "Produto",
    links: [
      { rotulo: "Recursos", href: "#recursos" },
      { rotulo: "Como funciona", href: "#como-funciona" },
      { rotulo: "Preços", href: "#precos" },
      { rotulo: "Dúvidas", href: "#faq" },
    ],
  },
  {
    titulo: "Projeto",
    links: [
      { rotulo: "Código no GitHub", href: REPO_URL, externo: true },
      { rotulo: "Documentação", href: DOCS_URL, externo: true },
      { rotulo: "Licença AGPL-3.0", href: LICENSE_URL, externo: true },
    ],
  },
  {
    titulo: "Contato",
    links: [{ rotulo: EMAIL_CONTATO, href: `mailto:${EMAIL_CONTATO}` }],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg">
      <Container className="pt-16">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <Emblem className="h-7 w-7" />
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                Rally
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-gray">
              Gestão, agendamento e replays para quadras de areia. Do agendamento ao replay.
            </p>
          </div>

          {colunas.map((coluna) => (
            <nav
              key={coluna.titulo}
              aria-label={coluna.titulo}
              className="md:col-span-2 md:last:col-span-3"
            >
              <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-gray">
                {coluna.titulo}
              </h2>
              <ul className="mt-5 flex flex-col gap-3 text-[15px] text-ink">
                {coluna.links.map((link) => (
                  <li key={link.rotulo}>
                    <a
                      href={link.href}
                      {...("externo" in link && link.externo
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="transition-colors hover:text-coral-deep"
                    >
                      {link.rotulo}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Wordmark gigante: acabamento editorial, sem valor semântico. */}
        <p
          aria-hidden="true"
          className="mt-16 select-none font-display text-[22vw] font-extrabold leading-[0.78] tracking-tighter text-ink/10"
        >
          Rally
        </p>
      </Container>

      <Container className="flex flex-col gap-3 border-t border-line py-7 font-mono text-[10px] uppercase tracking-[0.18em] text-gray sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Rally · EST. 2026 · IFSul Campus Sapiranga</p>
        <p>Open source · AGPL-3.0</p>
      </Container>
    </footer>
  );
}
