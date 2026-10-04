import type { ReportingCopyKey } from "./en";

export const ES_REPORTING_COPY: Record<ReportingCopyKey, string> = {
  "consent.notice":
    "¡Hola! Soy el asistente de reportes de Green Goods, operado por WEFA. Para ayudarte a reportar el trabajo del huerto, guardo y leo los mensajes y archivos que envías aquí{processors}. Nada se hace público hasta que confirmes un reporte.\n\nEnvía STOP en cualquier momento para detenerme, DELETE para borrar tus datos no publicados o HELP para soporte ({support}).\n\n¿Estás de acuerdo?",
  "consent.processors": " y puedo usar OpenAI y TypeSafe para entenderlos",
  "consent.agree": "Acepto",
  "consent.decline": "No, gracias",
  "consent.declined":
    "De acuerdo. No procesaré tus mensajes y eliminé lo que enviaste. Escribe a {support} si cambias de opinión.",
  "consent.granted": "¡Gracias! Cuéntame el trabajo que hiciste. Puedes enviar texto y fotos.",
  "consent.stopped":
    "Detuviste el asistente. No leeré mensajes nuevos hasta que envíes START. Los reportes publicados siguen siendo públicos; los borradores sin publicar se están eliminando. Soporte: {support}",
  "consent.deleted":
    "Se están eliminando tus borradores y archivos sin publicar. Los reportes publicados siguen públicos en la cadena e IPFS y no se pueden borrar. Soporte: {support}",
  help: "Reportes de Green Goods:\n• Describe tu trabajo y envía fotos para iniciar un reporte.\n• NEW inicia un reporte nuevo, STATUS muestra dónde vas, CANCEL cancela el reporte actual.\n• Responsables: envíen REVIEW para ver trabajos pendientes de revisión.\n• CONNECT, o la dirección de tu cuenta sola, vincula tu cuenta de Green Goods: abre el enlace de verificación que te envío y vuelve aquí con PAIR seguido de su código de seis dígitos. Puedes conectar Telegram y WhatsApp a la misma cuenta. RECOVER vuelve a conectar una cuenta si pierdes acceso al chat.\n• STOP detiene el procesamiento, DELETE borra los datos no publicados.\nSoporte: {support}",
  "intake.paused":
    "Los reportes están en pausa por mantenimiento. Tu mensaje está guardado y responderé cuando se reanuden. Soporte: {support}",
  "media.photoAdded": "Foto agregada a tu reporte.",
  "media.fileRead": "Leí tu archivo y agregué a tu reporte lo que pude.",
  "media.fileKept": "Guardé tu archivo en privado. Te preguntaré los detalles.",
  "media.tooLarge":
    "Ese archivo pesa más de 10 MB, así que no puedo usarlo. Tu reporte está guardado.",
  "media.unsupported":
    "No puedo usar ese tipo de archivo. Tu reporte está guardado; envía fotos (JPEG, PNG o WebP), un PDF, un archivo de Word o Excel, un CSV, o escribe los detalles.",
  "media.unreadable":
    "No pude leer ese archivo. Puede estar dañado, protegido con contraseña o tener macros. Tu reporte está guardado; envíalo de nuevo como PDF o fotos, o escribe los detalles.",
  "media.pdfTooLong":
    "Ese documento tiene más de 20 páginas, así que no lo leí. Envía las páginas importantes como un PDF más corto o como fotos.",
  "media.voiceOff": "Todavía no se aceptan notas de voz. Por favor, escribe tu actualización.",
  "media.voicePaused": "Ahora no puedo escuchar notas de voz. Por favor, escribe tu actualización.",
  "media.voiceTooLong":
    "Esa nota de voz dura más de 2 minutos, así que no la envié a ningún lado. Envía una más corta o escribe tu actualización.",
  "media.voiceEmpty":
    "No pude oír palabras en esa nota de voz. Inténtalo de nuevo o escribe tu actualización.",
  "media.voiceFailed":
    "No pude transcribir esa nota de voz. Tu reporte está guardado; inténtalo de nuevo o escribe tu actualización.",
  "voice.consent":
    "¿Puedo transcribir tus notas de voz? Envío la grabación a OpenAI para convertirla en texto, agrego el texto a tu reporte y te lo muestro para que lo revises. La grabación nunca se publica.",
  "voice.agree": "Sí, transcribir",
  "voice.decline": "No, escribiré",
  "voice.granted": "Gracias. Estoy transcribiendo tu nota de voz.",
  "voice.declined":
    "De acuerdo, no transcribiré notas de voz. Por favor, escribe tu actualización.",
  "voice.heard": "Escuché: “{transcript}”\nSi entendí algo mal, envía la corrección.",
  "media.documentsOff":
    "Guardé tu archivo en privado, pero la lectura de documentos está desactivada por ahora. Escribe los datos clave o envía fotos.",
  "media.fetchFailed": "No pude descargar tu archivo. Por favor, envíalo de nuevo.",
  "media.late": "Ese archivo llegó después de que confirmaste tu reporte, así que no se agregó.",
  "media.hiddenExcluded":
    "Algunas hojas, filas o columnas de tu hoja de cálculo estaban ocultas, así que las dejé fuera.",
  "media.partial":
    "Solo pude leer parte de ese archivo. Revisa el resumen con cuidado antes de confirmar.",
  "media.wordNative":
    "Leí el texto del documento de Word, pero no pude leer sus imágenes ni gráficos. Revisa el resumen antes de confirmar.",
  "media.spreadsheetNative":
    "Leí las celdas visibles de la hoja de cálculo, pero no pude leer sus imágenes ni gráficos. Revisa el resumen antes de confirmar.",
  "report.askGarden": "¿Para qué huerto es este reporte?",
  "report.askOwnGarden": "¿Para cuál de tus huertos es este reporte?",
  "report.otherGardens": "Otros huertos",
  "report.gardensUnavailable":
    "No puedo cargar la lista de huertos en este momento. Tu mensaje está guardado; escríbeme de nuevo en unos minutos. Soporte: {support}",
  "report.askAction": "¿Qué actividad de {garden} describe mejor tu trabajo?",
  "report.moreChoices": "Más opciones",
  "report.noActions":
    "{garden} no tiene actividades abiertas para reportar ahora. Tu borrador está guardado; escribe a {support} si no lo esperabas.",
  "report.catalogUnavailable":
    "No puedo leer las actividades de {garden} en este momento. Tu borrador está guardado; envía cualquier mensaje para intentarlo de nuevo.",
  "report.askNumber": "¿{title}? Responde con un número{unit}.",
  "report.askChoice": "¿{title}?",
  "report.askMulti": "¿{title}? Puedes elegir más de una, por ejemplo: 1, 3.",
  "report.askText": "¿{title}?",
  "report.askTime": "¿Cuánto tiempo dedicaste a este trabajo? Por ejemplo: 2 horas o 45 minutos.",
  "report.askTimeUnit": "¿Fueron {value} horas o {value} minutos?",
  "report.hours": "Horas",
  "report.minutes": "Minutos",
  "report.askTitle": "¿Qué título debería tener este reporte?",
  "report.askFeedback": "Describe en una o dos frases el trabajo que hiciste.",
  "report.askEvidence": "Envía {count} foto(s) del trabajo.",
  "report.evidenceLimit":
    "Esta actividad acepta hasta {maximum} fotos, así que no agregué la última.",
  "report.photoAdded": "Foto recibida ({have} hasta ahora).",
  "report.conflict":
    "Me dijiste «{current}» para {field}, pero se sugirió «{proposed}» a partir de {source}. ¿Cuál es correcto?",
  "report.keepCurrent": "Mantener {current}",
  "report.useProposed": "Usar {proposed}",
  "report.unsupportedInput":
    "{action} necesita una lista ({field}) que aún no puedo recoger en el chat. Elige otra actividad o envía esta desde la app de Green Goods. Tu borrador está guardado.",
  "report.invalid.not_a_number": "Responde con un número, por ejemplo 12.",
  "report.invalid.ambiguous_number":
    "¿Es un número entero o decimal? Escríbelo sin separador de miles, por ejemplo 1200 o 1,2.",
  "report.invalid.negative": "Responde con un número igual o mayor que cero.",
  "report.invalid.unit_mismatch":
    "Esto se cuenta en {unit}, pero escribiste {stated}. ¿Puedes darlo en {unit}?",
  "report.invalid.unit_required": "Incluye la unidad, por ejemplo 2 horas o 30 minutos.",
  "report.invalid.unknown_option": "Elige una de las opciones respondiendo con su número.",
  "report.invalid.too_long": "Es un poco largo. ¿Puedes acortarlo?",
  "report.invalid.empty": "No recibí una respuesta. ¿Puedes intentarlo de nuevo?",
  "report.summary":
    "Revisa tu reporte para {garden}:\n• Actividad: {action}\n• Título: {title}\n• Tiempo dedicado: {time}\n• Descripción: {feedback}{details}\n• Fotos: {photos}\n\nAl publicarse, el título, la descripción, los detalles y las fotos se hacen públicos en Arbitrum e IPFS y no se pueden borrar.{account}\n\nResponde CONFIRM {token} para publicar, EDIT para cambiar algo o CANCEL.",
  "report.summaryAccount": "\nLo publicará tu cuenta {account}.",
  "report.confirm": "Confirmar",
  "report.edit": "Editar",
  "report.cancel": "Cancelar",
  "edit.garden": "Huerto",
  "edit.action": "Actividad",
  "edit.title": "Título",
  "edit.time": "Tiempo dedicado",
  "edit.feedback": "Descripción",
  "report.editPrompt": "¿Qué quieres cambiar? Dímelo, por ejemplo: «fueron 3 horas».",
  "report.cancelled": "Reporte cancelado. El contenido sin publicar se eliminará.",
  "report.cancelHint": "Para cancelar este reporte, responde CANCEL.",
  "report.nothingToCancel": "No hay ningún reporte en curso.",
  "report.confirmToken": "Para publicar, responde CONFIRM {token} tal como aparece en el resumen.",
  "report.frozen":
    "Este reporte se está publicando, así que no puedo cambiarlo ahora. Guardé tu mensaje y lo usaré si la publicación no se completa.",
  "report.alreadyPublished": "Ese reporte ya está publicado. Envía NEW para empezar otro.",
  "report.newStarted": "Nuevo reporte iniciado. Cuéntame el trabajo que hiciste.",
  "report.resumeFirst":
    "Tienes un reporte en curso. Envía CANCEL para descartarlo o continúa con él.",
  "report.status": "Tu reporte para {garden} está {state}.",
  "state.collecting": "todavía en preparación",
  "state.review": "esperando tu confirmación",
  "state.authority": "esperando la verificación de la cuenta",
  "state.preparing": "preparándose para publicar",
  "state.signature": "esperando tu firma",
  "state.publishing": "publicándose",
  "report.noStatus": "No tienes un reporte en curso. Describe tu trabajo para empezar uno.",
  "report.expired":
    "Tu reporte sin terminar caducó tras 7 días sin actividad, así que se eliminó su contenido privado.",
  "link.request":
    "Para publicar, verifica aquí tu cuenta de Green Goods (billetera o passkey). El enlace caduca en 10 minutos y nunca mueve fondos.",
  "link.label": "Verificar cuenta",
  "link.pairHint": "Cuando la página muestre un código, envíalo aquí así: PAIR 123456",
  "link.paired": "Tu cuenta {account} ya está vinculada.{gardens}",
  "link.gardens": "\nTus huertos: {gardens}.",
  "link.gardensMore": "{gardens} y {count} más",
  "link.noGardens":
    "\nTodavía no la veo en ningún huerto. Un administrador de huerto puede agregarte.",
  "link.offer":
    "Antes de tu primer reporte, conecta tu cuenta de Green Goods para que pueda mostrarte tus huertos. O sáltate este paso y cuéntame el trabajo que hiciste; te pediré conectarla cuando publiques.",
  "link.offerLabel": "Conectar cuenta",
  "link.offerDeclined":
    "No hay problema. Cuéntame el trabajo que hiciste; puedes enviar texto y fotos. Envía CONNECT cuando quieras vincular tu cuenta.",
  "link.connect":
    "Para conectar tu cuenta de Green Goods (billetera o passkey), verifícala aquí. El enlace caduca en 10 minutos y nunca mueve fondos.",
  "link.connectNamed":
    "{account} está en: {gardens}.\nPara conectarla a este chat, verifícala aquí con esa cuenta. El enlace caduca en 10 minutos y nunca mueve fondos.",
  "link.connectNamedNoGardens":
    "Todavía no veo {account} en ningún huerto.\nPara conectarla a este chat, verifícala aquí con esa cuenta. El enlace caduca en 10 minutos y nunca mueve fondos.",
  "link.already": "Este chat está vinculado a {account}.{gardens}",
  "link.pairFailed":
    "Ese código no coincide con ninguna verificación abierta. Revisa el código en la página de Green Goods.",
  "link.accountMismatch":
    "Este chat está vinculado a otra cuenta. Verifica con {account} o escribe a {support}.",
  "link.accountTaken":
    "Esa cuenta ya está vinculada a otro chat. Si es tuya, envía RECOVER desde el chat que quieres usar. Soporte: {support}",
  "publish.consent":
    "¿Publicar tu reporte confirmado en {garden} desde {account}? El título, la descripción, los detalles y las fotos se hacen públicos y no se pueden borrar. Responde PUBLISH {token} para continuar.",
  "publish.publish": "Publicar",
  "publish.signLink": "Abre esta página para revisar y firmar la publicación exacta con tu {kind}.",
  "publish.signLabel": "Revisar y publicar",
  "publish.grantOffer":
    "Tu cuenta con passkey puede permitir que Green Goods publique tus próximos reportes en {garden} después de que confirmes cada uno aquí: hasta {count} reportes en 24 horas, solo reportes, revocable cuando quieras. O publica solo este reporte.",
  "publish.allowReporting": "Permitir reportes en el chat",
  "publish.thisReportOnly": "Publicar solo este reporte",
  "publish.roleMissing":
    "Tu cuenta no es jardinera de {garden}, así que no puedo publicar allí. Tu reporte está guardado; pide a un administrador del huerto que te agregue y responde RETRY.",
  "publish.paused":
    "La publicación está en pausa. Tu reporte confirmado está guardado y continuará cuando se reanude.",
  "publish.preparationFailed":
    "No pude preparar tu reporte para publicarlo. Está guardado; responde RETRY para intentarlo de nuevo.",
  "publish.sending": "Publicando tu reporte. Te avisaré cuando esté en la cadena.",
  "publish.uncertain":
    "Tu publicación se envió, pero aún no puedo confirmarla en la cadena. No la enviaré dos veces; te avisaré cuando lo sepa.",
  "publish.unknown":
    "No recibí respuesta de tu billetera, así que aún no sé si se envió. No lo enviaré otra vez; estoy revisando la cadena y te diré lo que encuentre.",
  "publish.rejected":
    "La firma fue rechazada, así que no se publicó nada. Aquí está tu reporte otra vez; confírmalo cuando quieras.",
  "publish.reverted":
    "La publicación falló en la cadena. Tu reporte está guardado; revísalo y confírmalo de nuevo para reintentar.",
  "publish.published": "Tu reporte está publicado ✅\nTrabajo: {uid}\nTransacción: {tx}",
  "grant.active":
    "Los reportes desde el chat están activos para {garden} hasta {until}. Igual te pediré que confirmes cada reporte.",
  "grant.unavailable":
    "No puedo publicar esto desde el chat: el permiso de reporte está en pausa, se agotó o terminó. Confirma de nuevo y te enviaré una página para firmarlo tú.",
  "grant.paused": "El permiso de reportes está en pausa. Te pediré publicar con tu passkey.",
  "review.pendingList": "Trabajo esperando tu revisión en {garden}. Elige uno para empezar:",
  "review.none": "No hay trabajo esperando tu revisión.",
  "review.askDecision": "¿Apruebas o rechazas «{title}» de {gardener}?",
  "review.approve": "Aprobar",
  "review.reject": "Rechazar",
  "review.askConfidence": "¿Qué tanta confianza tienes en este trabajo?",
  "review.confidence.1": "Baja",
  "review.confidence.2": "Media",
  "review.confidence.3": "Alta",
  "review.askFeedback":
    "Agrega comentarios para quien hizo el trabajo (serán públicos). Si apruebas puedes responder SKIP.",
  "review.summary":
    "Tu revisión de «{title}» en {garden}:\n• Decisión: {decision}\n• Confianza: {confidence}\n• Comentarios: {feedback}\n• Método: revisión humana\n\nLa decisión y los comentarios se hacen públicos en Arbitrum.\nResponde CONFIRM {token} para registrarla, EDIT para cambiarla o CANCEL.",
  "review.selfReview": "No puedes revisar tu propio trabajo.",
  "review.notSteward": "Tu cuenta no administra {garden}, así que no puedes revisar este trabajo.",
  "review.notOperator":
    "Tu cuenta no administra ningún huerto, así que no tienes trabajos para revisar.",
  "review.recorded": "Tu revisión quedó registrada ✅\nTransacción: {tx}",
  "account.wallet": "billetera",
  "account.passkey": "llave de acceso",
  "review.link":
    "Para revisar trabajos, verifica aquí tu cuenta existente de Green Goods (billetera o llave de acceso). El enlace vence en 10 minutos y nunca mueve fondos.",
  "review.confidence.0": "Ninguna",
  "review.askRejectionFeedback": "Dile al jardinero por qué rechazas este trabajo (será público).",
  "review.noFeedback": "(ninguno)",
  "review.feedbackInvalid": "Envía un comentario de hasta 2.000 caracteres.",
  "review.frozen": "Esta revisión ya no se puede cambiar porque se está registrando.",
  "review.confirmToken":
    "Para registrar tu revisión, responde CONFIRM {token} tal como aparece en el resumen.",
  "review.cancelled": "Revisión cancelada. No se registró nada.",
  "review.signLink": "Abre esta página para revisar y firmar tu decisión con tu {kind}.",
  "review.signLabel": "Revisar y firmar",
  "review.grantLink":
    "Abre esta página para registrar esta decisión confirmada y permitir hasta 5 revisiones, incluida esta, para este jardín durante 1 hora. Debes confirmar cada revisión por separado en el chat.",
  "review.grantLabel": "Permitir revisiones en el chat",
  "review.rejectedBeforeSend":
    "La firma fue rechazada, así que tu revisión no se registró. Aquí está de nuevo; confírmala cuando quieras.",
  "review.reverted":
    "El registro de tu revisión falló en la cadena. Revísala y confírmala de nuevo para reintentar.",
  "recovery.started":
    "Para mover tu cuenta de Green Goods a este chat, abre esta página y verifica la cuenta que usabas antes. El enlace caduca en 10 minutos.",
  "recovery.code": "Escribe este código en la página de recuperación de Green Goods: {code}",
  "recovery.completed":
    "Este chat ya está vinculado a tu cuenta. El chat anterior ya no tiene acceso y cualquier permiso de reportes queda en pausa hasta que lo apruebes de nuevo.",
  "recovery.label": "Mover mi cuenta",
  "recovery.alreadyLinked": "Este chat ya está vinculado a {account}. No hay nada que mover.",
  "recovery.draftOpen":
    "Primero termina o cancela el reporte de este chat y luego envía RECOVER de nuevo.",
  "recovery.suspended":
    "El acceso de este chat está en pausa mientras tu cuenta se mueve a otro chat. Soporte: {support}",
  "error.generic": "Algo salió mal de mi lado. Tu reporte está guardado. Soporte: {support}",
};
