export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return digits.slice(-10);
}

export function isValidPhone(input: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(input));
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizePhone(phone);
  if (n.length !== 10) return phone;
  return `${n.slice(0, 5)} ${n.slice(5)}`;
}

export function toE164(phone: string): string {
  return `+91${normalizePhone(phone)}`;
}
