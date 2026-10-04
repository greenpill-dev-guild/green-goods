import type { ReportingCopyKey } from "./en";

export const PT_REPORTING_COPY: Record<ReportingCopyKey, string> = {
  "link.browserHint":
    "Abra no Safari ou Chrome. Se abrir dentro do app de chat, use o menu da página para abrir no navegador ou copie o link.",
  "link.copyButton": "Copiar link",
  "consent.notice":
    "Olá! Sou o assistente de relatos do Green Goods. Para ajudar você a relatar o trabalho na horta, eu guardo e leio as mensagens e os arquivos que você envia aqui{processors}. Nada fica público até você confirmar um relato.\n\nEnvie STOP a qualquer momento para parar, DELETE para apagar seus dados não publicados ou HELP para suporte ({support}).\n\nVocê concorda?",
  "consent.processors": " e posso usar IA para entendê-los",
  "consent.agree": "Concordo",
  "consent.decline": "Não, obrigado",
  "consent.declined":
    "Tudo bem. Não vou processar suas mensagens e apaguei o que você enviou. Escreva para {support} se mudar de ideia.",
  "consent.granted": "Obrigado! Conte o trabalho que você fez. Você pode enviar texto e fotos.",
  "consent.stopped":
    "Você parou o assistente. Não vou ler mensagens novas até você enviar START. Os relatos publicados continuam públicos; os rascunhos não publicados estão sendo apagados. Suporte: {support}",
  "consent.deleted":
    "Seus rascunhos e arquivos não publicados estão sendo apagados. Os relatos publicados continuam públicos na blockchain e no IPFS e não podem ser removidos. Suporte: {support}",
  help: "Relatos do Green Goods:\n• Descreva seu trabalho e envie fotos para começar um relato.\n• NEW começa um relato novo, STATUS mostra onde você está, CANCEL cancela o relato atual.\n• Responsáveis: enviem REVIEW para ver trabalhos aguardando revisão.\n• CONNECT, ou o endereço da sua conta sozinho, vincula sua conta Green Goods: abra o link de verificação que envio e envie só o código de seis dígitos neste chat. Você pode conectar Telegram e WhatsApp à mesma conta. RECOVER reconecta uma conta após perder o acesso ao chat.\n• STOP para o processamento, DELETE apaga os dados não publicados.\nSuporte: {support}",
  "intake.paused":
    "Os relatos estão pausados para manutenção. Sua mensagem foi guardada e vou responder quando voltarem. Suporte: {support}",
  "media.photoAdded": "Foto adicionada ao seu relato.",
  "media.fileRead": "Li seu arquivo e adicionei ao seu relato o que consegui.",
  "media.fileKept": "Salvei seu arquivo com privacidade. Vou perguntar os detalhes.",
  "media.tooLarge":
    "Esse arquivo tem mais de 10 MB, então não posso usá-lo. Seu relato está salvo.",
  "media.unsupported":
    "Não posso usar esse tipo de arquivo. Seu relato está salvo; envie fotos (JPEG, PNG ou WebP), um PDF, um arquivo do Word ou Excel, um CSV, ou digite os detalhes.",
  "media.unreadable":
    "Não consegui ler esse arquivo. Ele pode estar danificado, protegido por senha ou conter macros. Seu relato está salvo; envie-o de novo como PDF ou fotos, ou digite os detalhes.",
  "media.pdfTooLong":
    "Esse documento tem mais de 20 páginas, então não o li. Envie as páginas importantes como um PDF menor ou como fotos.",
  "media.voiceOff": "Ainda não aceitamos mensagens de voz. Por favor, digite sua atualização.",
  "media.voicePaused":
    "Agora não consigo ouvir mensagens de voz. Por favor, digite sua atualização.",
  "media.voiceTooLong":
    "Essa mensagem de voz tem mais de 2 minutos, então não a enviei para lugar nenhum. Envie uma mais curta ou digite sua atualização.",
  "media.voiceEmpty":
    "Não consegui ouvir palavras nessa mensagem de voz. Tente de novo ou digite sua atualização.",
  "media.voiceFailed":
    "Não consegui transcrever essa mensagem de voz. Seu relato está salvo; tente de novo ou digite sua atualização.",
  "voice.consent":
    "Posso transcrever suas mensagens de voz? Envio a gravação para um serviço de IA transformá-la em texto, adiciono o texto ao seu relato e mostro para você conferir. A gravação nunca é publicada.",
  "voice.agree": "Sim, transcrever",
  "voice.decline": "Não, vou digitar",
  "voice.granted": "Obrigado. Estou transcrevendo sua mensagem de voz.",
  "voice.declined":
    "Certo, não vou transcrever mensagens de voz. Por favor, digite sua atualização.",
  "voice.heard": "Ouvi: “{transcript}”\nSe entendi algo errado, é só enviar a correção.",
  "media.documentsOff":
    "Salvei seu arquivo com privacidade, mas a leitura de documentos está desativada no momento. Digite os dados principais ou envie fotos.",
  "media.fetchFailed": "Não consegui baixar seu arquivo. Por favor, envie de novo.",
  "media.late":
    "Esse arquivo chegou depois que você confirmou seu relato, então não foi adicionado.",
  "media.hiddenExcluded":
    "Algumas planilhas, linhas ou colunas estavam ocultas, então deixei de fora.",
  "media.partial":
    "Só consegui ler parte desse arquivo. Confira o resumo com atenção antes de confirmar.",
  "media.wordNative":
    "Li o texto do documento do Word, mas não consegui ler suas imagens ou gráficos. Confira o resumo antes de confirmar.",
  "media.spreadsheetNative":
    "Li as células visíveis da planilha, mas não consegui ler suas imagens ou gráficos. Confira o resumo antes de confirmar.",
  "report.askGarden": "Para qual horta é este relato?",
  "report.askOwnGarden": "Para qual das suas hortas é este relato?",
  "report.otherGardens": "Outras hortas",
  "report.gardensUnavailable":
    "Não consigo carregar a lista de hortas agora. Sua mensagem está guardada; envie outra mensagem em alguns minutos. Suporte: {support}",
  "report.questionPosition": "{position} de {total} · ",
  "report.actionAdoptedOne":
    "Entendi: {action} em {garden}. Uma pergunta rápida e depois um resumo para conferir.",
  "report.actionAdoptedMany":
    "Entendi: {action} em {garden}. {count} perguntas rápidas e depois um resumo para conferir.",
  "report.askAction": "Qual atividade em {garden} descreve melhor o seu trabalho?",
  "report.moreChoices": "Mais opções",
  "report.noActions":
    "{garden} não tem atividades abertas para relato agora. Seu rascunho está guardado. Envie EDIT para escolher outra horta, ou escreva para {support} se não esperava por isso.",
  "report.catalogUnavailable":
    "Não consegui carregar as atividades de {garden} agora. O problema é do meu lado e seu rascunho está guardado. Toque em Tentar de novo ou envie qualquer mensagem.",
  "report.tryAgain": "Tentar de novo",
  "report.choiceHelp":
    "Não entendi qual você quer dizer. Toque em uma opção abaixo ou responda com o número dela. Envie HELP para ver tudo o que posso fazer, ou CANCEL para parar este relato.",
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
  "report.invalid.too_long": "Ficou um pouco longo. Pode resumir?",
  "report.invalid.empty": "Não recebi uma resposta. Pode tentar de novo?",
  "report.summaryButtonInstruction":
    "Toque em Confirmar para publicar, Editar para mudar algo ou Cancelar.",
  "report.summaryCodeInstruction":
    "Responda CONFIRM {token} para publicar, EDIT para mudar algo ou CANCEL.",
  "publish.consentButtonInstruction": "Toque em Publicar para continuar.",
  "publish.consentCodeInstruction": "Responda PUBLISH {token} para continuar.",
  "review.summaryButtonInstruction":
    "Toque em Confirmar para registrar, Editar para mudar ou Cancelar.",
  "review.summaryCodeInstruction":
    "Responda CONFIRM {token} para registrar, EDIT para mudar ou CANCEL.",
  "report.summary":
    "Confira seu relato para {garden}:\n• Atividade: {action}\n• Título: {title}\n• Tempo dedicado: {time}\n• Descrição: {feedback}{details}\n• Fotos: {photos}\n\nAo publicar, o título, a descrição, os detalhes e as fotos ficam públicos na Arbitrum e no IPFS e não podem ser apagados.{account}\n\n{instruction}",
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
  "report.cancelHint": "Para cancelar este relato, responda CANCEL.",
  "report.nothingToCancel": "Não há nenhum relato em andamento.",
  "report.confirmToken": "Para publicar, responda CONFIRM {token}.",
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
  "link.pairHint": "Quando a página mostrar um código, envie só os seis dígitos aqui.",
  "link.paired": "Sua conta {account} agora está vinculada.{gardens}",
  "link.gardens": "\nSuas hortas: {gardens}.",
  "link.gardensMore": "{gardens} e mais {count}",
  "link.joinCommunity": "Abra este link para entrar no Jardim Comunitário com {account}.",
  "link.joinCommunityQuestion":
    "Ainda não vejo sua conta neste jardim. Entre no Jardim Comunitário e depois toque em Já entrei.",
  "link.joinCommunityLabel": "Entrar no Jardim Comunitário",
  "link.joined": "Já entrei",
  "link.noGardens":
    "\nAinda não vejo esta conta em um jardim. Se você acabou de entrar, pode levar alguns minutos para aparecer.",
  "link.offer":
    "Antes do seu primeiro relato, conecte sua conta Green Goods para eu mostrar suas hortas. Ou pule esta etapa e conte o trabalho que você fez; vou pedir para conectar quando você publicar.",
  "link.offerLabel": "Conectar conta",
  "link.offerDeclined":
    "Sem problema. Conte o trabalho que você fez; você pode enviar texto e fotos. Envie CONNECT quando quiser vincular sua conta.",
  "link.connect":
    "Para conectar sua conta Green Goods (carteira ou passkey), verifique-a aqui. O link expira em 10 minutos e nunca movimenta fundos.",
  "link.connectNamed":
    "{account} está em: {gardens}.\nPara conectá-la a este chat, verifique-a aqui com essa conta. O link expira em 10 minutos e nunca movimenta fundos.",
  "link.connectNamedNoGardens":
    "Ainda não vejo {account} em nenhuma horta.\nPara conectá-la a este chat, verifique-a aqui com essa conta. O link expira em 10 minutos e nunca movimenta fundos.",
  "link.already": "Este chat está vinculado a {account}.{gardens}",
  "link.pairFailed":
    "Esse código não corresponde a nenhuma verificação aberta. Confira o código na página do Green Goods.",
  "link.accountMismatch":
    "Este chat está vinculado a outra conta. Verifique com {account} ou escreva para {support}.",
  "link.accountTaken":
    "Essa conta já está vinculada a outro chat. Se for sua, envie RECOVER pelo chat que você quer usar. Suporte: {support}",
  "publish.consent":
    "Publicar seu relato confirmado em {garden} pela conta {account}? O título, a descrição, os detalhes e as fotos ficam públicos e não podem ser apagados. {instruction}",
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
  "publish.unknown":
    "Não recebi resposta da sua carteira, então ainda não sei se foi enviado. Não vou enviar de novo; estou verificando a blockchain e aviso o que encontrar.",
  "publish.rejected":
    "A assinatura foi recusada, então nada foi publicado. Aqui está seu relato de novo; confirme quando quiser.",
  "publish.reverted":
    "A publicação falhou na blockchain. Seu relato está guardado; confira e confirme de novo para tentar outra vez.",
  "publish.viewReport": "Ver seu relato",
  "publish.published": "Seu relato foi publicado ✅\nTrabalho: {uid}\nTransação: {tx}",
  "grant.active":
    "Os relatos pelo chat estão ativos para {garden} até {until}. Ainda vou pedir que você confirme cada relato.",
  "grant.unavailable":
    "Não posso publicar isto pelo chat: a permissão de relato está pausada, esgotada ou terminou. Confirme de novo e eu envio uma página para você assinar.",
  "grant.paused":
    "A permissão de relatos está pausada. Vou pedir que você publique com sua passkey.",
  "review.pendingList": "Trabalhos aguardando sua revisão em {garden}. Escolha um para começar:",
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
    "Sua revisão de “{title}” em {garden}:\n• Decisão: {decision}\n• Confiança: {confidence}\n• Comentário: {feedback}\n• Método: revisão humana\n\nA decisão e o comentário ficam públicos na Arbitrum.\n{instruction}",
  "review.selfReview": "Você não pode revisar o seu próprio trabalho.",
  "review.notSteward":
    "Sua conta não é responsável por {garden}, então você não pode revisar este trabalho.",
  "review.notOperator":
    "Sua conta não é responsável por nenhuma horta, então não há trabalhos para você revisar.",
  "review.recorded": "Sua revisão foi registrada ✅\nTransação: {tx}",
  "review.viewWork": "Ver o trabalho",
  "account.wallet": "carteira",
  "account.passkey": "chave de acesso",
  "review.link":
    "Para revisar trabalhos, verifique aqui sua conta existente do Green Goods (carteira ou chave de acesso). O link expira em 10 minutos e nunca movimenta fundos.",
  "review.confidence.0": "Nenhuma",
  "review.askRejectionFeedback":
    "Diga ao jardineiro por que você está rejeitando este trabalho (será público).",
  "review.noFeedback": "(nenhum)",
  "review.feedbackInvalid": "Envie um comentário de até 2.000 caracteres.",
  "review.frozen": "Esta revisão não pode ser alterada agora porque já está sendo registrada.",
  "review.confirmToken":
    "Para registrar sua revisão, responda CONFIRM {token} exatamente como aparece no resumo.",
  "review.cancelled": "Revisão cancelada. Nada foi registrado.",
  "review.signLink": "Abra esta página para conferir e assinar sua decisão com sua {kind}.",
  "review.signLabel": "Conferir e assinar",
  "review.grantLink":
    "Abra esta página para registrar esta decisão confirmada e permitir até 5 revisões, incluindo esta, para este jardim durante 1 hora. Você precisa confirmar cada revisão separadamente no chat.",
  "review.grantLabel": "Permitir revisões no chat",
  "review.rejectedBeforeSend":
    "A assinatura foi recusada, então sua revisão não foi registrada. Aqui está ela de novo; confirme quando quiser.",
  "review.reverted":
    "O registro da sua revisão falhou na blockchain. Confira e confirme novamente para tentar de novo.",
  "recovery.started":
    "Para mover sua conta Green Goods para este chat, abra esta página e verifique a conta que você usava antes. O link expira em 10 minutos.",
  "recovery.code": "Digite este código na página de recuperação do Green Goods: {code}",
  "recovery.completed":
    "Este chat agora está vinculado à sua conta. O chat antigo não tem mais acesso e qualquer permissão de relatos fica pausada até você aprová-la de novo.",
  "recovery.label": "Mover minha conta",
  "recovery.alreadyLinked": "Este chat já está vinculado a {account}. Não há nada para mover.",
  "recovery.draftOpen":
    "Primeiro termine ou cancele o relato deste chat e depois envie RECOVER de novo.",
  "recovery.suspended":
    "O acesso deste chat está pausado enquanto sua conta é movida para outro chat. Suporte: {support}",
  "error.generic": "Algo deu errado do meu lado. Seu relato está guardado. Suporte: {support}",
};
