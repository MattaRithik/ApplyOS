/** WhatsApp's official click-to-chat endpoint — opens the app/web with the text prefilled and lets the user pick who (or which group) to send it to. No API, no account, no automation. */
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function jobDropShareText(params: { senderName: string; url: string; caption?: string | null }): string {
  const { senderName, url, caption } = params;
  return caption ? `📌 Job posted by ${senderName}: ${caption}\n${url}` : `📌 Job posted by ${senderName}: ${url}`;
}
