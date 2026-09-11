/**
 * Robust clipboard copy utility with fallback for cross-browser support and async context preservation.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try Modern Clipboard API first
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, using fallback:", err);
    }
  }

  // Fallback using textarea + execCommand for environments with restricted permissions or transient activation loss
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error("Clipboard copy fallback failed:", fallbackErr);
    return false;
  }
}
