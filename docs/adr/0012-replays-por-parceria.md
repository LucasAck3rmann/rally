# ADR-0012 — Captação de replays por parceria

**Status:** Aceito · **Data:** 2026-09-02 · **Decisores:** Lucas (tech lead)
**Substitui:** ADR-0006 — Replays em S3 + MediaConvert + CloudFront
**Relacionado:** [Visão e Posicionamento](../../README.md) · [Arquitetura e Stack](../arquitetura.md) · [Decisões de Arquitetura (ADRs)](README.md)

## Contexto

O replay entrou no projeto como **diferencial inédito**: a hipótese era que ninguém no
Brasil ligava agendamento a vídeo, e que construir a captação seria o que separaria o
Rally dos concorrentes. O [ADR-0006](README.md) foi escrito sob essa premissa e decidiu
um pipeline próprio na AWS (upload em S3 → transcodificação no MediaConvert → entrega
por CloudFront).

A pesquisa de mercado feita em **02/09/2026** para o relatório do TCC desmontou a
premissa. O mercado brasileiro tem **duas verticais maduras e separadas**:

- **Gestão e agendamento de quadras:** Agendei Quadras, Gendo, ArenaAi, BT Match, Woop,
  Arena Manager, NetQuadras, WebQuadras, Chartei.
- **Gravação e replay automático:** FilmaEu (4.000+ quadras, 5 países, 1M+ atletas),
  Lance Replay, Chame o VAR, Kiplay, Repit, Meu Replay, Replay Sports.

As duas são **complementares, não concorrentes**. O painel dos sistemas de replay é só
de vídeo e engajamento — não agenda nem cuida do financeiro. E nenhum sistema de agenda
produz vídeo. Ou seja: replay automático não é inédito, e construí-lo significaria
competir de frente com operação consolidada, em hardware e visão computacional, que
está fora do escopo de um TCC e fora da competência central do produto.

### Forças/requisitos

- O diferencial precisa ser **defensável**, não apenas chamativo.
- Captação envolve **hardware em campo** (câmeras, instalação, manutenção) — custo e
  operação de natureza completamente diferente de uma aplicação web.
- O vínculo entre **quem jogou** e **qual clipe** é informação que só quem tem a reserva
  possui. É aí que o Rally tem vantagem estrutural.
- A escolha não pode amarrar o produto a um fornecedor específico.

## Opções consideradas

### A) Construir a captação (posição do ADR-0006)
Câmeras próprias, pipeline de ingestão e transcodificação na AWS.
- **Prós:** controle total da experiência e do custo marginal em escala.
- **Contras:** disputa direta com empresas que já têm milhares de quadras equipadas;
  exige hardware, logística e visão computacional; inviável no prazo do TCC.

### B) Parceria comercial com produtos separados
Modelo do **ArenaAi + Apertai**: as duas empresas se divulgam, mas o usuário usa dois
produtos distintos.
- **Prós:** simples, sem integração técnica.
- **Contras:** não gera diferencial — o cliente continua com duas contas e dois apps, e
  o Rally não fica dono de nenhuma informação nova.

### C) Parceria com integração de domínio **(escolhida)**
A captação vem de um parceiro (**FilmaEu** como primeiro), mas o clipe entra no domínio
do Rally como entidade `Replay` ligada a `Reserva` e `Usuario`. O parceiro é um
**adaptador atrás de uma porta** (hexagonal), como já é feito com o Pix no
[ADR-0003](README.md).
- **Prós:** o usuário tem uma conta só e o replay aparece onde ele já está; o Rally
  passa a ser dono do vínculo reserva↔clipe, que é o ativo real; o fornecedor é
  substituível sem tocar no domínio.
- **Contras:** depende de interface fornecida por terceiro; parte da experiência de
  vídeo fica fora do nosso controle.

## Decisão

**A captação de replays não será construída internamente.** Ela vem por parceria, e o
parceiro entra como adaptador atrás de uma porta do domínio.

O diferencial do Rally passa a ser **arquitetural, não comercial**: a plataforma é a
única que sabe *quem reservou*, *em qual quadra* e *em qual horário* — e portanto a
única que pode entregar o clipe certo à pessoa certa sem ela pedir. `Replay` continua
sendo entidade de primeira classe do modelo, ligada a `Reserva` e `Usuario`, exatamente
como já está no schema.

## Consequências

- **(+)** Sai do caminho de competir em hardware e visão computacional, o que estava
  fora de alcance e fora do foco.
- **(+)** O vínculo reserva↔clipe — o que de fato diferencia — fica dentro do domínio e
  é independente de quem filma.
- **(+)** Troca de fornecedor não toca no domínio, só no adaptador.
- **(−)** **Risco declarado:** a FilmaEu não tem API pública documentada. A integração
  depende de interface que eles forneçam, e o cronograma dessa etapa não está sob nosso
  controle. Enquanto não houver contrato e interface, o módulo `replays` segue servindo
  clipes cadastrados manualmente.
- **(−)** O pipeline de vídeo do ADR-0006 deixa de ser construído para captação.
  Armazenamento e entrega (S3/CloudFront) **podem** continuar necessários para os clipes
  que o parceiro repassar — isso depende do formato da integração e será decidido quando
  a interface existir, não antes.
- A seção de replays da [Arquitetura e Stack](../arquitetura.md) e o
  [Roadmap](../../README.md) precisam refletir que a fase de replays passa a ser de
  **integração**, não de construção de pipeline.
