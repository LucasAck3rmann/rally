# ADR-0014 — Mensalistas como reservas materializadas

**Status:** Aceito · **Data:** 2026-10-17

## Contexto

O Instrumento I da pesquisa de campo (n = 10 gestores, outubro de 2026) perguntou quais recursos seriam indispensáveis num sistema de gestão. **Controle de mensalistas foi marcado por cinco dos dez respondentes** — empatado em segundo lugar com pagamento antecipado por Pix, atrás apenas do autoatendimento do cliente, que teve unanimidade.

Entre os recursos apontados, é o **único que o sistema não entrega de forma alguma**: o autoatendimento, a agenda visual, o Pix antecipado, o lembrete automático e o relatório de faturamento já existem. Não há entidade, rota nem tela de mensalista.

A pergunta também aparece no campo livre. Um gestor listou, entre o que gostaria de ter e não tem, *"campo com os mensalistas"*, ao lado de controle de bebidas e de um sistema de *follow-up*.

Mensalista, no vocabulário do segmento, é o cliente que ocupa **o mesmo horário toda semana** mediante pagamento mensal — terça-feira às 19h, por exemplo, pelo semestre inteiro. É receita previsível e é o que sustenta a ocupação dos horários nobres.

## Decisão

Mensalistas são modelados como uma **série recorrente que materializa reservas reais** no banco, e não como ocupação calculada no momento da leitura.

Duas entidades:

- **`Recorrencia`** — a regra: estabelecimento, quadra, cliente, dia da semana, hora de início, duração, vigência (início e fim), preço acordado e situação;
- **`Reserva`** ganha uma chave estrangeira **anulável** para `Recorrencia`. Cada ocorrência semanal é uma reserva comum, que sabe de onde veio.

A geração das ocorrências é feita por um **horizonte deslizante**: ao criar a série, materializam-se as próximas semanas até um limite configurado; um trabalho agendado estende o horizonte conforme o tempo passa, como já é feito com o lembrete de jogo e a expiração de Pix.

Quando uma ocorrência **colide** com reserva já existente, ela é **pulada e reportada** — a série não é recusada inteira, e nada é deslocado. O gestor recebe a lista das semanas que não couberam e decide.

O cliente é identificado **pelo e-mail**, e não pelo identificador, como já faz a gestão de equipe (RF-23). O painel é preenchido por uma pessoa, e ninguém sabe o UUID de ninguém — um campo de identificador seria um formulário impossível de preencher. Quem não tem conta no Rally recebe recusa com o motivo, e a tela manda pedir o cadastro. Convite pendente exigiria token e e-mail transacional, que o MVP não tem e de que o controle de mensalistas não depende.

## Alternativas consideradas

**Ocupação virtual, calculada na leitura.** A série ficaria só como regra, e a grade de horários a aplicaria ao montar a disponibilidade. Economiza linhas e torna trivial alterar a série inteira.

**Foi recusada, e a razão é a garantia central do projeto.** O anti-overbooking do Rally não está em código de aplicação: está na restrição de exclusão `reserva_sem_sobreposicao`, no PostgreSQL (ver ADR-0004 e a subseção 4.6 do relatório). Essa restrição protege **linhas que existem**. Um mensalista virtual não tem linha, de modo que outro cliente poderia reservar por cima dele e o banco aceitaria — a trava não teria nada para comparar. Resolver isso exigiria reintroduzir verificação na aplicação justamente no caminho que o projeto tirou dela de propósito, e aceitar de volta a janela entre ler e gravar.

Materializar custa linhas e disciplina de horizonte. Virtualizar custa a propriedade que o trabalho inteiro usa como argumento. O preço da segunda é maior.

**Série recusada inteira em caso de colisão.** Seria mais simples de implementar e mais fácil de explicar. Recusada porque transforma um conflito de uma semana num bloqueio de seis meses: a arena que já tem um jogo marcado na terça seguinte não conseguiria cadastrar o mensalista daquele horário, e o gestor resolveria o problema fora do sistema — que é exatamente o comportamento que a pesquisa mostra existir hoje, com o WhatsApp.

**Deslocar a reserva conflitante.** Recusada sem hesitação: o sistema moveria a reserva de um cliente para acomodar outro, sem que nenhum dos dois soubesse.

## Consequências

**(+)** A ocorrência de mensalista é uma reserva como qualquer outra. Ela aparece na agenda, entra no relatório de faturamento e de ocupação, é protegida pela restrição de exclusão, pode ser cancelada individualmente quando o cliente avisa que não vai naquela semana, e conta na conciliação. Nenhum desses caminhos precisa saber que mensalista existe.

**(+)** Cancelar uma ocorrência não desfaz a série, e encerrar a série não apaga o histórico — que é o que o relatório precisa para fechar o mês passado.

**(−)** Horizonte é estado que envelhece. Se o trabalho agendado falhar, as ocorrências deixam de ser criadas em silêncio e o horário aparece como livre. **A mitigação precisa ser uma medida, não uma intenção:** a série guarda até que data foi materializada, e a diferença entre essa data e o horizonte esperado é um número que o painel pode mostrar e um teste pode cobrar.

**(−)** Alterar a série exige decidir o que fazer com as ocorrências já materializadas e ainda não jogadas. **A decisão, tomada no desenho detalhado: a série não muda.** Os campos que definem o horário — quadra, dia da semana, hora de início e duração — não existem em nenhum DTO de edição. Trocar o horário de um mensalista é **encerrar a série e cadastrar outra**.

A alternativa seria cancelar N reservas e criar N outras, cada uma podendo colidir com algo já marcado. O resultado possível é uma série movida pela metade, e o gestor sem como saber quais semanas mudaram. Encerrar e recriar chega ao mesmo lugar por um caminho que o sistema já sabe explicar: as passadas ficam como histórico do relatório, as futuras são canceladas com motivo registrado, e a série nova materializa com o próprio relatório de colisão. O ganho é uma propriedade forte — **nenhuma reserva pode discordar da série que a gerou**, porque a regra que a gerou nunca muda.

**(−)** O preço fica congelado na reserva, como já acontece hoje (RN-12). Reajuste de mensalidade vale para as ocorrências geradas depois, e isso precisa estar visível para o gestor — caso contrário ele reajusta e não entende por que o mês seguinte não mudou.

## O que esta decisão não resolve

Cobrança recorrente. A série registra o preço acordado e gera as reservas; **cobrar a mensalidade todo mês é outro problema**, que depende do gateway (ADR-0003) e das credenciais que o projeto ainda não tem (ADR-0013). Enquanto isso, o pagamento de mensalista é registrado como já se registra o de balcão.

Esta separação é deliberada: a pesquisa pediu **controle** de mensalistas — saber quem são, que horário ocupam e quanto representam —, e não processamento de assinatura. Entregar o controle sem a cobrança responde ao que foi pedido; entregar a cobrança sem o controle não responderia a nada.
