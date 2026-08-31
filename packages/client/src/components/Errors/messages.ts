export type ErrorBoundaryLocale = "en" | "es" | "pt";

export const defaultErrorBoundaryMessages = {
  "app.error.boundary.action.clearData": "Clear App Data and Restart",
  "app.error.boundary.action.copied": "Copied to clipboard",
  "app.error.boundary.action.copyDetails": "Copy Error Details for Support",
  "app.error.boundary.action.copyManual": "Couldn't auto-copy. Select the text below",
  "app.error.boundary.action.returnHome": "Return to Garden",
  "app.error.boundary.action.tryAgain": "Try Again",
  "app.error.boundary.description.error":
    "Something unexpected happened. Our team has been notified and is working on a fix.",
  "app.error.boundary.description.loop":
    "The app got stuck in a loop. Clearing app data will start you fresh — your synced work is safe on the network.",
  "app.error.boundary.description.network":
    "Your garden is temporarily offline. Don't worry - your work is safely stored locally and will sync when you're back online!",
  "app.error.boundary.description.offline":
    "There's a technical issue with the offline features, but your data is safe and secure.",
  "app.error.boundary.devMode.hide": "Hide Technical Details",
  "app.error.boundary.devMode.show": "Show Technical Details",
  "app.error.boundary.help.description":
    "Try refreshing your browser, clearing your cache, or check your internet connection. If this keeps happening, our gardeners are always here to help!",
  "app.error.boundary.help.title": "Need help?",
  "app.error.boundary.protection.message": "Your work is protected and will not be lost",
  "app.error.boundary.subtitle.connection": "Connection lost",
  "app.error.boundary.subtitle.error": "Something went wrong",
  "app.error.boundary.subtitle.technical": "Technical Hiccup",
  "app.error.boundary.title.error": "Oops!",
  "app.error.boundary.title.garden": "Garden Offline",
  "app.error.boundary.title.maintenance": "Garden Maintenance",
  "app.error.boundary.update.refreshing": "Updating to the latest version…",
} as const;

export type ErrorBoundaryMessages = Record<keyof typeof defaultErrorBoundaryMessages, string>;

const localizedErrorBoundaryMessages: Record<ErrorBoundaryLocale, ErrorBoundaryMessages> = {
  en: defaultErrorBoundaryMessages,
  es: {
    "app.error.boundary.action.clearData": "Borrar datos y reiniciar",
    "app.error.boundary.action.copied": "Copiado al portapapeles",
    "app.error.boundary.action.copyDetails": "Copiar detalles del error para soporte",
    "app.error.boundary.action.copyManual":
      "No se pudo copiar automáticamente. Selecciona el texto abajo",
    "app.error.boundary.action.returnHome": "Volver al Jardín",
    "app.error.boundary.action.tryAgain": "Reintentar",
    "app.error.boundary.description.error":
      "Algo inesperado ocurrió. Nuestro equipo ha sido notificado y está trabajando en una solución.",
    "app.error.boundary.description.loop":
      "La aplicación se quedó atascada. Borrar los datos te dará un inicio limpio — tu trabajo sincronizado está a salvo en la red.",
    "app.error.boundary.description.network":
      "Tu jardín está temporalmente sin conexión. No te preocupes: tu trabajo está guardado localmente y se sincronizará cuando vuelvas a estar en línea.",
    "app.error.boundary.description.offline":
      "Hay un problema técnico con las funciones sin conexión, pero tus datos están seguros y protegidos.",
    "app.error.boundary.devMode.hide": "Ocultar detalles técnicos",
    "app.error.boundary.devMode.show": "Ver detalles técnicos",
    "app.error.boundary.help.description":
      "Intenta actualizar tu navegador, limpiar la caché o verificar tu conexión a internet. Si esto sigue ocurriendo, ¡nuestros jardineros siempre están aquí para ayudar!",
    "app.error.boundary.help.title": "¿Necesitas ayuda?",
    "app.error.boundary.protection.message": "Tu trabajo está protegido y no se perderá",
    "app.error.boundary.subtitle.connection": "Conexión Perdida",
    "app.error.boundary.subtitle.error": "Algo salió mal",
    "app.error.boundary.subtitle.technical": "Problema Técnico",
    "app.error.boundary.title.error": "¡Ups!",
    "app.error.boundary.title.garden": "Jardín Sin Conexión",
    "app.error.boundary.title.maintenance": "Mantenimiento del Jardín",
    "app.error.boundary.update.refreshing": "Actualizando a la última versión…",
  },
  pt: {
    "app.error.boundary.action.clearData": "Limpar dados e reiniciar",
    "app.error.boundary.action.copied": "Copiado para a área de transferência",
    "app.error.boundary.action.copyDetails": "Copiar detalhes do erro para suporte",
    "app.error.boundary.action.copyManual":
      "Não foi possível copiar automaticamente. Selecione o texto abaixo",
    "app.error.boundary.action.returnHome": "Voltar ao Jardim",
    "app.error.boundary.action.tryAgain": "Tentar Novamente",
    "app.error.boundary.description.error":
      "Algo inesperado aconteceu. Nossa equipe foi notificada e está trabalhando em uma correção.",
    "app.error.boundary.description.loop":
      "O aplicativo ficou preso em um loop. Limpar os dados dará um início limpo — seu trabalho sincronizado está seguro na rede.",
    "app.error.boundary.description.network":
      "Seu jardim está temporariamente offline. Não se preocupe - seu trabalho está guardado localmente e será sincronizado quando você voltar a ficar online!",
    "app.error.boundary.description.offline":
      "Há um problema técnico com as funcionalidades offline, mas seus dados estão seguros e protegidos.",
    "app.error.boundary.devMode.hide": "Ocultar detalhes técnicos",
    "app.error.boundary.devMode.show": "Mostrar detalhes técnicos",
    "app.error.boundary.help.description":
      "Tente atualizar seu navegador, limpar o cache ou verificar sua conexão com a internet. Se isso continuar acontecendo, nossos jardineiros estão sempre aqui para ajudar!",
    "app.error.boundary.help.title": "Precisa de ajuda?",
    "app.error.boundary.protection.message": "Seu trabalho está protegido e não será perdido",
    "app.error.boundary.subtitle.connection": "Conexão Perdida",
    "app.error.boundary.subtitle.error": "Algo deu errado",
    "app.error.boundary.subtitle.technical": "Problema Técnico",
    "app.error.boundary.title.error": "Ops!",
    "app.error.boundary.title.garden": "Jardim Offline",
    "app.error.boundary.title.maintenance": "Manutenção do Jardim",
    "app.error.boundary.update.refreshing": "Atualizando para a versão mais recente…",
  },
};

export async function loadErrorBoundaryMessages(
  locale: ErrorBoundaryLocale
): Promise<ErrorBoundaryMessages> {
  return localizedErrorBoundaryMessages[locale];
}
