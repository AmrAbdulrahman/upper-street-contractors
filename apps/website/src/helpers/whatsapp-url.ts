export function formatUkPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("44")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `44${digits.slice(1)}`;
  }

  return digits;
}

export function getWhatsAppUrl(phone: string): string {
  return `https://wa.me/${formatUkPhoneForWhatsApp(phone)}`;
}
