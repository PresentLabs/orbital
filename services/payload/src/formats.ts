export function formatRut(input: string) {
  const raw = input
    .replace(/[^\dk]/gi, "")
    .toUpperCase()
    .slice(0, 10);
  if (raw.length < 2) return raw;
  const body = raw.slice(0, -1).replace(/^0+(?=\d)/, "");
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + raw.slice(-1);
}
export function validRut(input: string) {
  const raw = input.replace(/[^\dk]/gi, "").toUpperCase();
  if (!/^\d{7,9}[\dK]$/.test(raw)) return false;
  let sum = 0,
    factor = 2;
  for (const digit of raw.slice(0, -1).split("").reverse()) {
    sum += Number(digit) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const value = 11 - (sum % 11);
  return (
    raw.at(-1) === (value === 11 ? "0" : value === 10 ? "K" : String(value))
  );
}
export function formatPhone(input: string) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("56")) digits = digits.slice(2);
  digits = digits.slice(0, 9);
  if (!digits) return "";
  return (
    "(+56) " +
    digits[0] +
    (digits.length > 1 ? " " + digits.slice(1, 5) : "") +
    (digits.length > 5 ? " " + digits.slice(5) : "")
  );
}
export function validPhone(input: string) {
  return !input || /^56\d{9}$/.test(input.replace(/\D/g, ""));
}
export function validLogo(value: unknown) {
  if (value === undefined || value === "") return true;
  if (typeof value !== "string" || value.length > 350000) return false;
  if (/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(value))
    return true;
  if (!value.startsWith("data:image/svg+xml;base64,")) return false;
  try {
    const svg = atob(value.split(",")[1]);
    return (
      /<svg[\s>]/i.test(svg) &&
      !/<(?:script|foreignObject|iframe|object|embed)|\bon[a-z]+\s*=|<!DOCTYPE|<!ENTITY|(?:href|src)\s*=\s*["']\s*(?!#)|url\(\s*["']?(?!#)/i.test(
        svg,
      )
    );
  } catch {
    return false;
  }
}

export function validAvatar(value: unknown) {
  return (
    typeof value === "string" &&
    value.length <= 350000 &&
    (/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(value) ||
      /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(value) ||
      /^data:image\/webp;base64,UklGR[A-Za-z0-9+/=]+$/.test(value))
  );
}
