// SPDX-License-Identifier: AGPL-3.0-or-later
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/site/footer";
import { Gallery } from "@/components/landing/gallery";
import { Header } from "@/components/site/header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Integrations } from "@/components/landing/integrations";
import { Manifesto } from "@/components/landing/manifesto";
import { Marquee } from "@/components/landing/marquee";
import { Pricing } from "@/components/landing/pricing";
import { Quote } from "@/components/landing/quote";
import { REPO_URL } from "@/lib/site";

const dadosEstruturados = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Rally",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  description:
    "Plataforma de gestão, agendamento e replays para quadras de areia: agenda em tempo real, pagamento no Pix e relatórios.",
  inLanguage: "pt-BR",
  isAccessibleForFree: true,
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  codeRepository: REPO_URL,
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "BRL" },
    { "@type": "Offer", name: "Pro", price: "149", priceCurrency: "BRL" },
  ],
};

export default function Home() {
  return (
    <>
      <Header />

      {/* pt-16 = altura do cabeçalho fixo. */}
      <main id="conteudo" className="pt-16">
        <Marquee />
        <Hero />
        <Manifesto />
        <Features />
        <HowItWorks />
        <Gallery />
        <Quote />
        <Pricing />
        <Integrations />
        <Faq />
        <FinalCta />
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados) }}
      />
    </>
  );
}
