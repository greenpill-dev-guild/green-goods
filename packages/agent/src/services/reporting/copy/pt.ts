import type { ReportingCopyKey } from "./en";

export const PT_REPORTING_COPY: Record<ReportingCopyKey, string> = {
  "consent.notice":
    "Olá! Sou o assistente de relatos do Green Goods, operado pela WEFA. Para ajudar você a relatar o trabalho na horta, eu guardo e leio as mensagens e os arquivos que você envia aqui{processors}. Nada fica público até você confirmar um relato.\n\nEnvie STOP a qualquer momento para parar, DELETE para apagar seus dados não publicados ou HELP para suporte ({support}).\n\nVocê concorda?",
  "consent.processors": " e posso usar a OpenAI e a TypeSafe para entendê-los",
  "consent.agree": "Concordo",
  "consent.decline": "Não, obrigado",
  "consent.declined":
    "Tudo bem. Não vou processar suas mensagens e apaguei o que você enviou. Escreva para {support} se mudar de ideia.",
  "consent.granted": "Obrigado! Conte o trabalho que você fez. Você pode enviar texto e fotos.",
  "consent.stopped":
    "Você parou o assistente. Não vou ler mensagens novas até você enviar START. Os relatos publicados continuam públicos; os rascunhos não publicados estão sendo apagados. Suporte: {support}",
  "consent.deleted":
    "Seus rascunhos e arquivos não publicados estão sendo apagados. Os relatos publicados continuam públicos na blockchain e no IPFS e não podem ser removidos. Suporte: {support}",
  help: "Relatos do Green Goods:\n• Descreva seu trabalho e envie fotos para começar um relato.\n• NEW começa um relato novo, STATUS mostra onde você está, CANCEL cancela o relato atual.\n• STOP para o processamento, DELETE apaga os dados não publicados.\nSuporte: {support}",
  "intake.paused":
    "Os relatos estão pausados para manutenção. Sua mensagem foi guardada e vou responder quando voltarem. Suporte: {support}",
  "unsupported.media":
    "Ainda não consigo processar esse tipo de arquivo. Envie fotos (JPEG, PNG ou WebP), PDF, Word (DOCX), Excel (XLSX) ou CSV. Seu relato está guardado.",
  "report.askGarden": "Para qual horta é este relato?",
  "report.noGardens":
    "Ainda não há hortas configuradas para relatos. Sua mensagem está guardada. Suporte: {support}",
  "report.askAction": "Qual atividade em {garden} descreve melhor o seu trabalho?",
  "report.moreChoices": "Mais opções",
  "report.noActions":
    "{garden} não tem atividades abertas para relato agora. Seu rascunho está guardado; escreva para {support} se não esperava por isso.",
  "report.catalogUnavailable":
    "Não consigo ler as atividades de {garden} agora. Seu rascunho está guardado; envie qualquer mensagem para tentar de novo.",
  "report.askNumber": "{title}? Responda com um número{unit}.",
  "report.askChoice": "{title}?",
  "report.askMulti": "{title}? Você pode escolher mais de uma, por exemplo: 1, 3.",
  "report.askText": "{title}?",
  "report.askTime":
    "Quanto tempo você dedicou a este trabalho? Por exemplo: 2 horas ou 45 minutos.",
  "report.askTimeUnit": "Foram {value} horas ou {value} minutos?",
  "report.hours": "Horas",
  "report.minutes": "Minutos",
  "report.askTitle": "Qual título este relato deve ter?",
  "report.askFeedback": "Descreva em uma ou duas frases o trabalho que você fez.",
  "report.askEvidence": "Envie {count} foto(s) do trabalho.",
  "report.evidenceLimit":
    "Esta atividade aceita até {maximum} fotos, então não adicionei a última.",
  "report.photoAdded": "Foto recebida ({have} até agora).",
  "report.conflict":
    "Você me disse “{current}” para {field}, mas “{proposed}” foi sugerido a partir de {source}. Qual está certo?",
  "report.keepCurrent": "Manter {current}",
  "report.useProposed": "Usar {proposed}",
  "report.unsupportedInput":
    "{action} precisa de uma lista ({field}) que ainda não consigo coletar no chat. Escolha outra atividade ou envie esta pelo app Green Goods. Seu rascunho está guardado.",
  "report.invalid.not_a_number": "Responda com um número, por exemplo 12.",
  "report.invalid.ambiguous_number":
    "É um número inteiro ou decimal? Escreva sem separador de milhar, por exemplo 1200 ou 1,2.",
  "report.invalid.negative": "Responda com um número igual ou maior que zero.",
  "report.invalid.unit_mismatch":
    "Isto é contado em {unit}, mas você escreveu {stated}. Pode informar em {unit}?",
  "report.invalid.unit_required": "Inclua a unidade, por exemplo 2 horas ou 30 minutos.",
  "report.invalid.unknown_option": "Escolha uma das opções respondendo com o número dela.",
  "report.invalid.too_long": "Ficou um pouco longo. Pode resumir?",
  "report.invalid.empty": "Não recebi uma resposta. Pode tentar de novo?",
  "report.summary":
    "Confira seu relato para {garden}:\n• Atividade: {action}\n• Título: {title}\n• Tempo dedicado: {time}\n• Descrição: {feedback}{details}\n• Fotos: {photos}\n\nAo publicar, o título, a descrição, os detalhes e as fotos ficam públicos na Arbitrum e no IPFS e não podem ser apagados.{account}\n\nResponda CONFIRM {token} para publicar, EDIT para mudar algo ou CANCEL.",
  "report.summaryAccount": "\nSerá publicado pela sua conta {account}.",
  "report.confirm": "Confirmar",
  "report.edit": "Editar",
  "report.cancel": "Cancelar",
  "edit.garden": "Horta",
  "edit.action": "Atividade",
  "edit.title": "Título",
  "edit.time": "Tempo dedicado",
  "edit.feedback": "Descrição",
  "report.editPrompt": "O que você quer mudar? É só me dizer, por exemplo: “foram 3 horas”.",
  "report.cancelled": "Relato cancelado. O conteúdo não publicado será removido.",
  "report.nothingToCancel": "Não há nenhum relato em andamento.",
  "report.confirmToken":
    "Para publicar, responda CONFIRM {token} exatamente como aparece no resumo.",
  "report.frozen":
    "Este relato está sendo publicado, então não posso mudá-lo agora. Guardei sua mensagem e vou usá-la se a publicação não for concluída.",
  "report.alreadyPublished": "Esse relato já foi publicado. Envie NEW para começar outro.",
  "report.newStarted": "Novo relato iniciado. Conte o trabalho que você fez.",
  "report.resumeFirst":
    "Você tem um relato em andamento. Envie CANCEL para descartá-lo ou continue com ele.",
  "report.status": "Seu relato para {garden} está {state}.",
  "state.collecting": "ainda sendo preenchido",
  "state.review": "aguardando sua confirmação",
  "state.authority": "aguardando a verificação da conta",
  "state.preparing": "sendo preparado para publicação",
  "state.signature": "aguardando sua assinatura",
  "state.publishing": "sendo publicado",
  "report.noStatus": "Você não tem um relato em andamento. Descreva seu trabalho para começar um.",
  "report.expired":
    "Seu relato inacabado expirou após 7 dias sem atividade, então o conteúdo privado foi removido.",
  "link.request":
    "Para publicar, verifique aqui sua conta Green Goods (carteira ou passkey). O link expira em 10 minutos e nunca movimenta fundos.",
  "link.label": "Verificar conta",
  "link.pairHint": "Quando a página mostrar um código, envie aqui assim: PAIR 123456",
  "link.paired": "Sua conta {account} agora está vinculada.",
  "link.pairFailed":
    "Esse código não corresponde a nenhuma verificação aberta. Confira o código na página do Green Goods.",
  "link.accountMismatch":
    "Este chat está vinculado a outra conta. Verifique com {account} ou escreva para {support}.",
  "publish.consent":
    "Publicar seu relato confirmado em {garden} pela conta {account}? O título, a descrição, os detalhes e as fotos ficam públicos e não podem ser apagados. Responda PUBLISH {token} para continuar.",
  "publish.publish": "Publicar",
  "publish.signLink": "Abra esta página para revisar e assinar a publicação exata com sua {kind}.",
  "publish.signLabel": "Revisar e publicar",
  "publish.grantOffer":
    "Sua conta com passkey pode permitir que o Green Goods publique seus próximos relatos em {garden} depois que você confirmar cada um aqui: até {count} relatos em 24 horas, só relatos, revogável a qualquer momento. Ou publique só este relato.",
  "publish.allowReporting": "Permitir relatos no chat",
  "publish.thisReportOnly": "Publicar só este relato",
  "publish.roleMissing":
    "Sua conta não é jardineira em {garden}, então não posso publicar lá. Seu relato está guardado; peça a um responsável pela horta para adicionar você e responda RETRY.",
  "publish.paused":
    "A publicação está pausada agora. Seu relato confirmado está guardado e continuará quando a publicação voltar.",
  "publish.preparationFailed":
    "Não consegui preparar seu relato para publicação. Ele está guardado; responda RETRY para tentar de novo.",
  "publish.sending": "Publicando seu relato agora. Aviso quando estiver na blockchain.",
  "publish.uncertain":
    "Sua publicação foi enviada, mas ainda não consigo confirmá-la na blockchain. Não vou enviá-la duas vezes; aviso quando souber.",
  "publish.rejected":
    "A assinatura foi recusada, então nada foi publicado. Responda CONFIRM {token} para tentar de novo.",
  "publish.reverted":
    "A publicação falhou na blockchain. Seu relato está guardado; confira e confirme de novo para tentar outra vez.",
  "publish.published": "Seu relato foi publicado ✅\nTrabalho: {uid}\nTransação: {tx}",
  "grant.active":
    "Os relatos pelo chat estão ativos para {garden} até {until}. Ainda vou pedir que você confirme cada relato.",
  "grant.paused":
    "A permissão de relatos está pausada. Vou pedir que você publique com sua passkey.",
  "review.pendingList":
    "Trabalhos aguardando sua revisão em {garden}:\n{items}\nResponda REVIEW seguido do número para começar.",
  "review.none": "Não há trabalhos aguardando sua revisão.",
  "review.askDecision": "Você aprova ou rejeita “{title}” de {gardener}?",
  "review.approve": "Aprovar",
  "review.reject": "Rejeitar",
  "review.askConfidence": "Qual é a sua confiança neste trabalho?",
  "review.confidence.1": "Baixa",
  "review.confidence.2": "Média",
  "review.confidence.3": "Alta",
  "review.askFeedback":
    "Adicione um comentário para quem fez o trabalho (será público). Ao aprovar, você pode responder SKIP.",
  "review.summary":
    "Sua revisão de “{title}” em {garden}:\n• Decisão: {decision}\n• Confiança: {confidence}\n• Comentário: {feedback}\n• Método: revisão humana\n\nA decisão e o comentário ficam públicos na Arbitrum.\nResponda CONFIRM {token} para registrar, EDIT para mudar ou CANCEL.",
  "review.selfReview": "Você não pode revisar o seu próprio trabalho.",
  "review.notSteward":
    "Sua conta não é responsável por {garden}, então você não pode revisar este trabalho.",
  "review.recorded": "Sua revisão foi registrada ✅\nTransação: {tx}",
  "recovery.started":
    "Para mover sua conta Green Goods para este chat, abra esta página e verifique a conta que você usava antes. O link expira em 10 minutos.",
  "recovery.code": "Envie este código na página de recuperação no navegador: {code}",
  "recovery.completed":
    "Este chat agora está vinculado à sua conta. O chat antigo não tem mais acesso e qualquer permissão de relatos fica pausada até você aprová-la de novo.",
  "error.generic": "Algo deu errado do meu lado. Seu relato está guardado. Suporte: {support}",
};
