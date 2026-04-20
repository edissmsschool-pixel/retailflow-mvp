/** Naira / kobo helpers. All money is stored as integer kobo. */
export const NAIRA = "₦";

export function formatNaira(kobo: number | null | undefined): string {
  const n = (kobo ?? 0) / 100;
  return NAIRA + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function nairaToKobo(naira: number | string): number {
  const n = typeof naira === "string" ? parseFloat(naira) : naira;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function koboToNaira(kobo: number): number {
  return Math.round(kobo) / 100;
}

export function parseKoboInput(s: string): number {
  const cleaned = (s || "").replace(/[^\d.]/g, "");
  return nairaToKobo(cleaned || "0");
}
