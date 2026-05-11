import type { RateLimitType } from "./services/rate-limiter";
import type { SessionStep, User } from "./types";

export type AgentLocale = "en" | "es" | "pt";

type AgentValues = Record<string, string | number | undefined>;

const enMessages = {
  "action.approval": "approval",
  "action.rejection": "rejection",
  "action.submission": "submission",
  "approve.gardenerMissing": "❌ Gardener account not found. They may need to run /start first.",
  "approve.permission":
    "❌ *Permission Denied*\n\nOnly registered operators can approve work for this garden.",
  "approve.permissionWithReason":
    "❌ *Permission Denied*\n\n{reason}\n\nOnly registered operators can approve work for this garden.",
  "approve.success":
    "✅ *Work approved and attested!*\n\nWork Tx: `{workTx}`\nApproval Tx: `{approvalTx}`",
  "approve.usage": "📍 *Usage:* `/approve <WorkID>`\n\nExample: `/approve abc123`",
  "common.joinFirst": "Please join a garden first with `/join <GardenAddress>`",
  "common.joinFirstAddress": "Please join a garden first with /join <address>",
  "common.startFirst": "Please run /start first to create your wallet.",
  "common.unsupportedMessageType": "❌ Unsupported message type.",
  "common.unknownAction": "Unknown action.",
  "common.unknownCommand": "Unknown command: /{command}",
  "command.approve": "(Operators) Approve a work submission",
  "command.help": "Show available commands",
  "command.join": "Join a garden by contract address",
  "command.pending": "(Operators) View pending work submissions",
  "command.reject": "(Operators) Reject a work submission",
  "command.start": "Create wallet and get started",
  "command.status": "View your current status and wallet",
  "error.authorization": "You don't have permission for this action.",
  "error.externalService": "Service temporarily unavailable ({service}). Please try again later.",
  "error.internal": "An unexpected error occurred. Please try again.",
  "help.basic":
    '🌿 *Green Goods Bot Help*\n\n*Basic Commands:*\n/start - Create wallet & get started\n/join <address> - Join a garden\n/status - Check your current status\n\n*Submitting Work:*\nSimply send a text or voice message describing your work!\nExample: "I planted 5 trees today"\n\n*Reporting Bugs and Ideas:*\nPost freely in the Bug Reports or Ideas/Feedback topics in the Green Goods chat — the team picks them up automatically.\n\n',
  "help.footer": "_Need help? Contact @GreenGoodsSupport_",
  "help.operator":
    "*Operator Commands:*\n/approve <id> - Approve a work submission\n/reject <id> - Reject a work submission\n/pending - List pending work for your garden\n\n",
  "idempotency.inProgress": "⏳ This {action} is already being processed. Please wait a moment.",
  "join.invalidAddress":
    "❌ Invalid address format.\n\nPlease provide a valid Ethereum address (0x followed by 40 hex characters).",
  "join.notFound":
    "❌ *Garden not found*\n\nThis address doesn't appear to be a valid Green Goods garden contract.\n\nPlease verify the address and try again.",
  "join.success":
    "✅ *Joined garden successfully!*\n\nGarden: {gardenName}\nAddress: `{gardenAddress}`\n\nYou can now submit work by sending me a text or voice message.",
  "join.usage": "📍 *Usage:* `/join <GardenAddress>`\n\nExample: `/join 0x1234...abcd`",
  "notification.approved":
    "🎉 *Your work has been approved!*\n\nID: `{workId}`\nWork Tx: `{workTx}`",
  "notification.newSubmission":
    "🔔 *New Work Submission*\n\nFrom: `{address}`\nID: `{workId}`\n\n{notes}\n\nReply with `/approve {workId}` to approve.",
  "notification.rejected":
    "❌ *Your work has been rejected*\n\nID: `{workId}`\nReason: {reason}\n\nPlease try again with more details or photos.",
  "pending.empty": "No pending work submissions for your garden.",
  "pending.footer": "Use `/approve <id>` or `/reject <id>` to process.",
  "pending.gardener": "Gardener",
  "pending.more": "_...and {count} more_\n\n",
  "pending.operatorOnly": "This command is only available for operators.",
  "pending.plants": "Plants",
  "pending.title": "Title",
  "pending.titleHeader": "📋 *Pending Work Submissions*\n\n",
  "photo.error":
    "❌ Sorry, I couldn't process that photo.\n\n{userMessage}\n\nPlease try again or send a text message.",
  "photo.newReceived":
    '📷 *Photo received!*\n\n{captionLine}Please describe what work you did. For example:\n_"Planted 5 oak trees in the community garden"_',
  "photo.caption": 'Caption: "{caption}"\n\n',
  "photo.receivedAttached":
    "📷 Photo {count} received!\n\nSend another photo or tap *Confirm* when ready to submit.",
  "photo.unavailable":
    "📷 Photo processing is not available.\n\nPlease describe your work in a text message instead.",
  "rate.approval": "Too many approval actions. Please wait.",
  "rate.command": "Too many commands. Please slow down.",
  "rate.join": "Too many garden join attempts. Please wait before trying again.",
  "rate.message": "You're sending messages too quickly. Please wait a moment.",
  "rate.retry": "⏳ {message}\n\nPlease wait {waitTime} before trying again.",
  "rate.submission":
    "You've submitted too many works recently. Please wait before submitting again.",
  "rate.voice": "Voice processing is limited. Please wait before sending another voice message.",
  "rate.wallet": "Too many wallet operations. Please wait.",
  "reject.defaultReason": "No reason provided",
  "reject.notify":
    "❌ *Your work has been rejected*\n\nID: `{workId}`\nReason: {reason}\n\nPlease try again with more details or photos.",
  "reject.permission":
    "❌ *Permission Denied*\n\nOnly registered operators can reject work for this garden.",
  "reject.permissionWithReason":
    "❌ *Permission Denied*\n\n{reason}\n\nOnly registered operators can reject work for this garden.",
  "reject.success": "❌ Work {workId} rejected.\n\nReason: {reason}",
  "reject.usage":
    "📍 *Usage:* `/reject <WorkID> [reason]`\n\nExample: `/reject abc123 Insufficient documentation`",
  "role.gardener": "gardener",
  "role.operator": "operator",
  "session.approving_work": "approving_work",
  "session.awaiting_details": "awaiting_details",
  "session.awaiting_photo": "awaiting_photo",
  "session.confirming_work": "confirming_work",
  "session.idle": "idle",
  "session.joining_garden": "joining_garden",
  "session.rejecting_work": "rejecting_work",
  "session.submitting_work": "submitting_work",
  "sessionExpired.start": "Session expired. Please start again with /start",
  "sessionExpired.submit": "Session expired. Please submit your work again.",
  "sessionExpired.submitInvalid": "Session expired or invalid. Please submit your work again.",
  "start.notJoined": "_Not joined_",
  "start.welcomeBack":
    "🌿 *Welcome back!*\n\nWallet: `{wallet}`\nGarden: {garden}\n\n_Send me a message to submit work or use /help for commands._",
  "start.welcomeNew":
    "🌿 *Welcome to Green Goods!*\n\nI've created a wallet for you:\n`{address}`\n\n*Commands:*\n/join <address> - Join a garden\n/status - Check your current status\n/help - Show all commands\n\n_Send me a text or voice message to submit work!_",
  "status.submissionsRemaining": "Submissions remaining",
  "status.title":
    "📊 *Your Status*\n\n*Wallet:* `{wallet}`\n*Role:* {role}\n*Garden:* {garden}\n*Session:* {session}\n*Submissions remaining:* {remaining}/{limit}",
  "submit.cancelled": "❌ Submission cancelled.",
  "submit.confirm":
    "📋 *Confirm your submission:*\n\n*Tasks:*\n{tasks}\n\n*Notes:* {notes}\n*Date:* {date}",
  "submit.gardenerOnly": "This action is only available for gardeners.",
  "submit.noTasks":
    '🤔 I couldn\'t identify any work tasks from your message.\n\nTry something like:\n• "I planted 5 trees today"\n• "Removed 10kg of weeds"\n• "Planted 20 tomato seedlings"',
  "submit.submitButton": "✅ Submit",
  "submit.cancelButton": "❌ Cancel",
  "submit.success":
    "✅ *Work submitted for approval!*\n\nID: `{workId}`\n\nAn operator will review your submission soon.",
  "submit.voiceNoTasks":
    '📝 I heard: "{transcribedText}"\n\n🤔 I couldn\'t identify any work tasks from your message.\n\nTry saying something like:\n• "I planted 5 trees today"\n• "Removed 10kg of weeds"',
  "voice.error":
    "❌ Sorry, I couldn't process that audio.\n\n{userMessage}\n\nTry sending a text message instead.",
  "voice.unavailable": "Voice processing is not available. Please send a text message instead.",
  "wait.minute": "{count} minute",
  "wait.minutes": "{count} minutes",
  "wait.second": "{count} second",
  "wait.seconds": "{count} seconds",
  "work.cannotDetermineGarden": "❌ Cannot determine garden for this work.",
  "work.notFound": "❌ Work not found or already processed.",
} as const;

export type AgentMessageKey = keyof typeof enMessages;
type AgentAction = "approval" | "rejection" | "submission";

const agentMessages: Record<AgentLocale, Record<AgentMessageKey, string>> = {
  en: enMessages,
  es: {
    "action.approval": "aprobación",
    "action.rejection": "rechazo",
    "action.submission": "envío",
    "approve.gardenerMissing":
      "❌ No se encontró la cuenta del jardinero. Puede que necesite ejecutar /start primero.",
    "approve.permission":
      "❌ *Permiso denegado*\n\nSolo los operadores registrados pueden aprobar trabajo para este jardín.",
    "approve.permissionWithReason":
      "❌ *Permiso denegado*\n\n{reason}\n\nSolo los operadores registrados pueden aprobar trabajo para este jardín.",
    "approve.success":
      "✅ *Trabajo aprobado y atestiguado!*\n\nTx de trabajo: `{workTx}`\nTx de aprobación: `{approvalTx}`",
    "approve.usage": "📍 *Uso:* `/approve <IDTrabajo>`\n\nEjemplo: `/approve abc123`",
    "common.joinFirst": "Únete primero a un jardín con `/join <GardenAddress>`",
    "common.joinFirstAddress": "Únete primero a un jardín con /join <address>",
    "common.startFirst": "Ejecuta /start primero para crear tu billetera.",
    "common.unsupportedMessageType": "❌ Tipo de mensaje no compatible.",
    "common.unknownAction": "Acción desconocida.",
    "common.unknownCommand": "Comando desconocido: /{command}",
    "command.approve": "(Operadores) Aprobar un envío de trabajo",
    "command.help": "Mostrar comandos disponibles",
    "command.join": "Unirse a un jardín por dirección de contrato",
    "command.pending": "(Operadores) Ver envíos de trabajo pendientes",
    "command.reject": "(Operadores) Rechazar un envío de trabajo",
    "command.start": "Crear billetera y empezar",
    "command.status": "Ver tu estado actual y billetera",
    "error.authorization": "No tienes permiso para esta acción.",
    "error.externalService":
      "Servicio temporalmente no disponible ({service}). Inténtalo de nuevo más tarde.",
    "error.internal": "Ocurrió un error inesperado. Inténtalo de nuevo.",
    "help.basic":
      '🌿 *Ayuda del bot de Green Goods*\n\n*Comandos básicos:*\n/start - Crear billetera y empezar\n/join <address> - Unirse a un jardín\n/status - Ver tu estado actual\n\n*Enviar trabajo:*\nEnvía un texto o mensaje de voz describiendo tu trabajo.\nEjemplo: "Hoy planté 5 árboles"\n\n*Reportar errores e ideas:*\nPublica libremente en los temas de Bug Reports o Ideas/Feedback del chat de Green Goods; el equipo los recoge automáticamente.\n\n',
    "help.footer": "_¿Necesitas ayuda? Contacta a @GreenGoodsSupport_",
    "help.operator":
      "*Comandos de operador:*\n/approve <id> - Aprobar un envío de trabajo\n/reject <id> - Rechazar un envío de trabajo\n/pending - Listar trabajo pendiente de tu jardín\n\n",
    "idempotency.inProgress":
      "⏳ Esta acción de {action} ya se está procesando. Espera un momento.",
    "join.invalidAddress":
      "❌ Formato de dirección inválido.\n\nProporciona una dirección Ethereum válida (0x seguido de 40 caracteres hexadecimales).",
    "join.notFound":
      "❌ *Jardín no encontrado*\n\nEsta dirección no parece ser un contrato de jardín válido de Green Goods.\n\nVerifica la dirección e inténtalo de nuevo.",
    "join.success":
      "✅ *Te uniste al jardín!*\n\nJardín: {gardenName}\nDirección: `{gardenAddress}`\n\nAhora puedes enviar trabajo con un texto o mensaje de voz.",
    "join.usage": "📍 *Uso:* `/join <GardenAddress>`\n\nEjemplo: `/join 0x1234...abcd`",
    "notification.approved":
      "🎉 *Tu trabajo fue aprobado!*\n\nID: `{workId}`\nTx de trabajo: `{workTx}`",
    "notification.newSubmission":
      "🔔 *Nuevo envío de trabajo*\n\nDe: `{address}`\nID: `{workId}`\n\n{notes}\n\nResponde con `/approve {workId}` para aprobar.",
    "notification.rejected":
      "❌ *Tu trabajo fue rechazado*\n\nID: `{workId}`\nMotivo: {reason}\n\nInténtalo de nuevo con más detalles o fotos.",
    "pending.empty": "No hay envíos de trabajo pendientes para tu jardín.",
    "pending.footer": "Usa `/approve <id>` o `/reject <id>` para procesar.",
    "pending.gardener": "Jardinero",
    "pending.more": "_...y {count} más_\n\n",
    "pending.operatorOnly": "Este comando solo está disponible para operadores.",
    "pending.plants": "Plantas",
    "pending.title": "Título",
    "pending.titleHeader": "📋 *Envíos de trabajo pendientes*\n\n",
    "photo.error":
      "❌ Lo siento, no pude procesar esa foto.\n\n{userMessage}\n\nInténtalo de nuevo o envía un mensaje de texto.",
    "photo.newReceived":
      '📷 *Foto recibida!*\n\n{captionLine}Describe qué trabajo hiciste. Por ejemplo:\n_"Planté 5 robles en el jardín comunitario"_',
    "photo.caption": 'Leyenda: "{caption}"\n\n',
    "photo.receivedAttached":
      "📷 Foto {count} recibida!\n\nEnvía otra foto o toca *Confirmar* cuando estés listo para enviar.",
    "photo.unavailable":
      "📷 El procesamiento de fotos no está disponible.\n\nDescribe tu trabajo en un mensaje de texto.",
    "rate.approval": "Demasiadas acciones de aprobación. Espera.",
    "rate.command": "Demasiados comandos. Ve más despacio.",
    "rate.join": "Demasiados intentos de unirse a jardines. Espera antes de intentarlo de nuevo.",
    "rate.message": "Estás enviando mensajes demasiado rápido. Espera un momento.",
    "rate.retry": "⏳ {message}\n\nEspera {waitTime} antes de intentarlo de nuevo.",
    "rate.submission":
      "Has enviado demasiados trabajos recientemente. Espera antes de enviar otro.",
    "rate.voice": "El procesamiento de voz está limitado. Espera antes de enviar otro audio.",
    "rate.wallet": "Demasiadas operaciones de billetera. Espera.",
    "reject.defaultReason": "No se proporcionó motivo",
    "reject.notify":
      "❌ *Tu trabajo fue rechazado*\n\nID: `{workId}`\nMotivo: {reason}\n\nInténtalo de nuevo con más detalles o fotos.",
    "reject.permission":
      "❌ *Permiso denegado*\n\nSolo los operadores registrados pueden rechazar trabajo para este jardín.",
    "reject.permissionWithReason":
      "❌ *Permiso denegado*\n\n{reason}\n\nSolo los operadores registrados pueden rechazar trabajo para este jardín.",
    "reject.success": "❌ Trabajo {workId} rechazado.\n\nMotivo: {reason}",
    "reject.usage":
      "📍 *Uso:* `/reject <IDTrabajo> [motivo]`\n\nEjemplo: `/reject abc123 Documentación insuficiente`",
    "role.gardener": "jardinero",
    "role.operator": "operador",
    "session.approving_work": "aprobando trabajo",
    "session.awaiting_details": "esperando detalles",
    "session.awaiting_photo": "esperando foto",
    "session.confirming_work": "confirmando trabajo",
    "session.idle": "inactiva",
    "session.joining_garden": "uniéndose a jardín",
    "session.rejecting_work": "rechazando trabajo",
    "session.submitting_work": "enviando trabajo",
    "sessionExpired.start": "La sesión expiró. Empieza de nuevo con /start",
    "sessionExpired.submit": "La sesión expiró. Envía tu trabajo de nuevo.",
    "sessionExpired.submitInvalid": "La sesión expiró o no es válida. Envía tu trabajo de nuevo.",
    "start.notJoined": "_Sin jardín_",
    "start.welcomeBack":
      "🌿 *Bienvenido de vuelta!*\n\nBilletera: `{wallet}`\nJardín: {garden}\n\n_Envíame un mensaje para enviar trabajo o usa /help para ver comandos._",
    "start.welcomeNew":
      "🌿 *Bienvenido a Green Goods!*\n\nHe creado una billetera para ti:\n`{address}`\n\n*Comandos:*\n/join <address> - Unirse a un jardín\n/status - Ver tu estado actual\n/help - Mostrar todos los comandos\n\n_Envíame un texto o mensaje de voz para enviar trabajo!_",
    "status.submissionsRemaining": "Envíos restantes",
    "status.title":
      "📊 *Tu estado*\n\n*Billetera:* `{wallet}`\n*Rol:* {role}\n*Jardín:* {garden}\n*Sesión:* {session}\n*Envíos restantes:* {remaining}/{limit}",
    "submit.cancelled": "❌ Envío cancelado.",
    "submit.confirm":
      "📋 *Confirma tu envío:*\n\n*Tareas:*\n{tasks}\n\n*Notas:* {notes}\n*Fecha:* {date}",
    "submit.gardenerOnly": "Esta acción solo está disponible para jardineros.",
    "submit.noTasks":
      '🤔 No pude identificar tareas de trabajo en tu mensaje.\n\nPrueba algo como:\n• "Hoy planté 5 árboles"\n• "Retiré 10 kg de maleza"\n• "Planté 20 plántulas de tomate"',
    "submit.submitButton": "✅ Enviar",
    "submit.cancelButton": "❌ Cancelar",
    "submit.success":
      "✅ *Trabajo enviado para aprobación!*\n\nID: `{workId}`\n\nUn operador revisará tu envío pronto.",
    "submit.voiceNoTasks":
      '📝 Escuché: "{transcribedText}"\n\n🤔 No pude identificar tareas de trabajo en tu mensaje.\n\nPrueba decir algo como:\n• "Hoy planté 5 árboles"\n• "Retiré 10 kg de maleza"',
    "voice.error":
      "❌ Lo siento, no pude procesar ese audio.\n\n{userMessage}\n\nPrueba enviar un mensaje de texto.",
    "voice.unavailable": "El procesamiento de voz no está disponible. Envía un mensaje de texto.",
    "wait.minute": "{count} minuto",
    "wait.minutes": "{count} minutos",
    "wait.second": "{count} segundo",
    "wait.seconds": "{count} segundos",
    "work.cannotDetermineGarden": "❌ No se puede determinar el jardín para este trabajo.",
    "work.notFound": "❌ Trabajo no encontrado o ya procesado.",
  },
  pt: {
    "action.approval": "aprovação",
    "action.rejection": "rejeição",
    "action.submission": "envio",
    "approve.gardenerMissing":
      "❌ Conta do jardineiro não encontrada. Talvez precise executar /start primeiro.",
    "approve.permission":
      "❌ *Permissão negada*\n\nSomente operadores registrados podem aprovar trabalho para este jardim.",
    "approve.permissionWithReason":
      "❌ *Permissão negada*\n\n{reason}\n\nSomente operadores registrados podem aprovar trabalho para este jardim.",
    "approve.success":
      "✅ *Trabalho aprovado e atestado!*\n\nTx do trabalho: `{workTx}`\nTx da aprovação: `{approvalTx}`",
    "approve.usage": "📍 *Uso:* `/approve <IDTrabalho>`\n\nExemplo: `/approve abc123`",
    "common.joinFirst": "Entre primeiro em um jardim com `/join <GardenAddress>`",
    "common.joinFirstAddress": "Entre primeiro em um jardim com /join <address>",
    "common.startFirst": "Execute /start primeiro para criar sua carteira.",
    "common.unsupportedMessageType": "❌ Tipo de mensagem não compatível.",
    "common.unknownAction": "Ação desconhecida.",
    "common.unknownCommand": "Comando desconhecido: /{command}",
    "command.approve": "(Operadores) Aprovar um envio de trabalho",
    "command.help": "Mostrar comandos disponíveis",
    "command.join": "Entrar em um jardim pelo endereço do contrato",
    "command.pending": "(Operadores) Ver envios de trabalho pendentes",
    "command.reject": "(Operadores) Rejeitar um envio de trabalho",
    "command.start": "Criar carteira e começar",
    "command.status": "Ver seu status atual e carteira",
    "error.authorization": "Você não tem permissão para esta ação.",
    "error.externalService":
      "Serviço temporariamente indisponível ({service}). Tente novamente mais tarde.",
    "error.internal": "Ocorreu um erro inesperado. Tente novamente.",
    "help.basic":
      '🌿 *Ajuda do bot Green Goods*\n\n*Comandos básicos:*\n/start - Criar carteira e começar\n/join <address> - Entrar em um jardim\n/status - Ver seu status atual\n\n*Enviar trabalho:*\nEnvie um texto ou mensagem de voz descrevendo seu trabalho.\nExemplo: "Plantei 5 árvores hoje"\n\n*Reportar erros e ideias:*\nPublique livremente nos tópicos Bug Reports ou Ideas/Feedback no chat Green Goods; a equipe acompanha automaticamente.\n\n',
    "help.footer": "_Precisa de ajuda? Contate @GreenGoodsSupport_",
    "help.operator":
      "*Comandos de operador:*\n/approve <id> - Aprovar um envio de trabalho\n/reject <id> - Rejeitar um envio de trabalho\n/pending - Listar trabalhos pendentes do seu jardim\n\n",
    "idempotency.inProgress":
      "⏳ Esta ação de {action} já está sendo processada. Aguarde um momento.",
    "join.invalidAddress":
      "❌ Formato de endereço inválido.\n\nInforme um endereço Ethereum válido (0x seguido de 40 caracteres hexadecimais).",
    "join.notFound":
      "❌ *Jardim não encontrado*\n\nEste endereço não parece ser um contrato de jardim válido da Green Goods.\n\nVerifique o endereço e tente novamente.",
    "join.success":
      "✅ *Você entrou no jardim!*\n\nJardim: {gardenName}\nEndereço: `{gardenAddress}`\n\nAgora você pode enviar trabalho por texto ou mensagem de voz.",
    "join.usage": "📍 *Uso:* `/join <GardenAddress>`\n\nExemplo: `/join 0x1234...abcd`",
    "notification.approved":
      "🎉 *Seu trabalho foi aprovado!*\n\nID: `{workId}`\nTx do trabalho: `{workTx}`",
    "notification.newSubmission":
      "🔔 *Novo envio de trabalho*\n\nDe: `{address}`\nID: `{workId}`\n\n{notes}\n\nResponda com `/approve {workId}` para aprovar.",
    "notification.rejected":
      "❌ *Seu trabalho foi rejeitado*\n\nID: `{workId}`\nMotivo: {reason}\n\nTente novamente com mais detalhes ou fotos.",
    "pending.empty": "Não há envios de trabalho pendentes para seu jardim.",
    "pending.footer": "Use `/approve <id>` ou `/reject <id>` para processar.",
    "pending.gardener": "Jardineiro",
    "pending.more": "_...e mais {count}_\n\n",
    "pending.operatorOnly": "Este comando está disponível apenas para operadores.",
    "pending.plants": "Plantas",
    "pending.title": "Título",
    "pending.titleHeader": "📋 *Envios de trabalho pendentes*\n\n",
    "photo.error":
      "❌ Desculpe, não consegui processar essa foto.\n\n{userMessage}\n\nTente novamente ou envie uma mensagem de texto.",
    "photo.newReceived":
      '📷 *Foto recebida!*\n\n{captionLine}Descreva o trabalho que você fez. Por exemplo:\n_"Plantei 5 carvalhos no jardim comunitário"_',
    "photo.caption": 'Legenda: "{caption}"\n\n',
    "photo.receivedAttached":
      "📷 Foto {count} recebida!\n\nEnvie outra foto ou toque em *Confirmar* quando estiver pronto para enviar.",
    "photo.unavailable":
      "📷 O processamento de fotos não está disponível.\n\nDescreva seu trabalho em uma mensagem de texto.",
    "rate.approval": "Muitas ações de aprovação. Aguarde.",
    "rate.command": "Comandos demais. Vá mais devagar.",
    "rate.join": "Muitas tentativas de entrar em jardins. Aguarde antes de tentar novamente.",
    "rate.message": "Você está enviando mensagens rápido demais. Aguarde um momento.",
    "rate.retry": "⏳ {message}\n\nAguarde {waitTime} antes de tentar novamente.",
    "rate.submission": "Você enviou trabalhos demais recentemente. Aguarde antes de enviar outro.",
    "rate.voice": "O processamento de voz está limitado. Aguarde antes de enviar outro áudio.",
    "rate.wallet": "Muitas operações de carteira. Aguarde.",
    "reject.defaultReason": "Nenhum motivo informado",
    "reject.notify":
      "❌ *Seu trabalho foi rejeitado*\n\nID: `{workId}`\nMotivo: {reason}\n\nTente novamente com mais detalhes ou fotos.",
    "reject.permission":
      "❌ *Permissão negada*\n\nSomente operadores registrados podem rejeitar trabalho para este jardim.",
    "reject.permissionWithReason":
      "❌ *Permissão negada*\n\n{reason}\n\nSomente operadores registrados podem rejeitar trabalho para este jardim.",
    "reject.success": "❌ Trabalho {workId} rejeitado.\n\nMotivo: {reason}",
    "reject.usage":
      "📍 *Uso:* `/reject <IDTrabalho> [motivo]`\n\nExemplo: `/reject abc123 Documentação insuficiente`",
    "role.gardener": "jardineiro",
    "role.operator": "operador",
    "session.approving_work": "aprovando trabalho",
    "session.awaiting_details": "aguardando detalhes",
    "session.awaiting_photo": "aguardando foto",
    "session.confirming_work": "confirmando trabalho",
    "session.idle": "ociosa",
    "session.joining_garden": "entrando no jardim",
    "session.rejecting_work": "rejeitando trabalho",
    "session.submitting_work": "enviando trabalho",
    "sessionExpired.start": "A sessão expirou. Comece novamente com /start",
    "sessionExpired.submit": "A sessão expirou. Envie seu trabalho novamente.",
    "sessionExpired.submitInvalid": "A sessão expirou ou é inválida. Envie seu trabalho novamente.",
    "start.notJoined": "_Sem jardim_",
    "start.welcomeBack":
      "🌿 *Boas-vindas de volta!*\n\nCarteira: `{wallet}`\nJardim: {garden}\n\n_Envie uma mensagem para registrar trabalho ou use /help para ver comandos._",
    "start.welcomeNew":
      "🌿 *Boas-vindas ao Green Goods!*\n\nCriei uma carteira para você:\n`{address}`\n\n*Comandos:*\n/join <address> - Entrar em um jardim\n/status - Ver seu status atual\n/help - Mostrar todos os comandos\n\n_Envie um texto ou mensagem de voz para registrar trabalho!_",
    "status.submissionsRemaining": "Envios restantes",
    "status.title":
      "📊 *Seu status*\n\n*Carteira:* `{wallet}`\n*Papel:* {role}\n*Jardim:* {garden}\n*Sessão:* {session}\n*Envios restantes:* {remaining}/{limit}",
    "submit.cancelled": "❌ Envio cancelado.",
    "submit.confirm":
      "📋 *Confirme seu envio:*\n\n*Tarefas:*\n{tasks}\n\n*Notas:* {notes}\n*Data:* {date}",
    "submit.gardenerOnly": "Esta ação está disponível apenas para jardineiros.",
    "submit.noTasks":
      '🤔 Não consegui identificar tarefas de trabalho na sua mensagem.\n\nTente algo como:\n• "Plantei 5 árvores hoje"\n• "Removi 10 kg de ervas daninhas"\n• "Plantei 20 mudas de tomate"',
    "submit.submitButton": "✅ Enviar",
    "submit.cancelButton": "❌ Cancelar",
    "submit.success":
      "✅ *Trabalho enviado para aprovação!*\n\nID: `{workId}`\n\nUm operador revisará seu envio em breve.",
    "submit.voiceNoTasks":
      '📝 Ouvi: "{transcribedText}"\n\n🤔 Não consegui identificar tarefas de trabalho na sua mensagem.\n\nTente dizer algo como:\n• "Plantei 5 árvores hoje"\n• "Removi 10 kg de ervas daninhas"',
    "voice.error":
      "❌ Desculpe, não consegui processar esse áudio.\n\n{userMessage}\n\nTente enviar uma mensagem de texto.",
    "voice.unavailable": "O processamento de voz não está disponível. Envie uma mensagem de texto.",
    "wait.minute": "{count} minuto",
    "wait.minutes": "{count} minutos",
    "wait.second": "{count} segundo",
    "wait.seconds": "{count} segundos",
    "work.cannotDetermineGarden": "❌ Não foi possível determinar o jardim para este trabalho.",
    "work.notFound": "❌ Trabalho não encontrado ou já processado.",
  },
};

export function normalizeAgentLocale(locale?: string): AgentLocale {
  const language = locale?.toLowerCase().split(/[-_]/)[0];
  if (language === "es" || language === "pt") return language;
  return "en";
}

export function agentMessage(
  locale: string | undefined,
  key: AgentMessageKey,
  values: AgentValues = {}
): string {
  const template = agentMessages[normalizeAgentLocale(locale)][key] ?? enMessages[key];
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, valueKey: string) => {
    const value = values[valueKey];
    return value === undefined ? match : String(value);
  });
}

export function agentActionLabel(locale: string | undefined, action: AgentAction): string {
  return agentMessage(locale, `action.${action}`);
}

export function agentRateLimitMessage(locale: string | undefined, type: RateLimitType): string {
  return agentMessage(locale, `rate.${type}`);
}

export function agentRoleLabel(locale: string | undefined, role: User["role"]): string {
  return agentMessage(locale, role === "operator" ? "role.operator" : "role.gardener");
}

export function agentSessionLabel(locale: string | undefined, step?: SessionStep): string {
  return agentMessage(locale, `session.${step ?? "idle"}`);
}

export function formatAgentWaitTime(locale: string | undefined, ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return agentMessage(locale, seconds === 1 ? "wait.second" : "wait.seconds", {
      count: seconds,
    });
  }
  const minutes = Math.ceil(seconds / 60);
  return agentMessage(locale, minutes === 1 ? "wait.minute" : "wait.minutes", {
    count: minutes,
  });
}
