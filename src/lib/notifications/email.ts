import "server-only";

/**
 * Resend ile e-posta gönderir. RESEND_API_KEY ya da gönderen adresi tanımlı değilse sessizce atlar;
 * bildirim gönderilemese de rezervasyon işlemi başarılı sayılır.
 * Misafir kimlik bilgisi e-postaya konmaz; iptal/değişiklik e-postasında sadece kliniğin yazdığı açıklama yöneticilere gider.
 * E-posta gerçekten gönderildiyse true döner.
 */
export async function sendEmail(to: string[], subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const recipients = to.filter(Boolean);
  if (!apiKey || !from || recipients.length === 0) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients, subject, text }),
    });
    if (!response.ok) console.error("E-posta gönderilemedi", response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error("E-posta gönderilemedi", error);
    return false;
  }
}

export function appUrl(path: string): string {
  const base = process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return new URL(path, base).toString();
}

export function adminNotificationEmails(): string[] {
  return (process.env.ADMIN_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}
