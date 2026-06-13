export function formatPhoneDisplay(phone: string): string {
  if (phone.includes(" ")) {
    return phone;
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("44") && digits.length >= 11) {
    const local = `0${digits.slice(2)}`;

    if (local.length === 11) {
      return `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
    }
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }

  return phone;
}
