/**
 * Copies text to the clipboard with a DOM fallback for insecure contexts.
 * @returns true if copy succeeded, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers or insecure contexts.
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const success = document.execCommand("copy");
      return success;
    } finally {
      document.body.removeChild(textArea);
    }
  } catch {
    return false;
  }
}
