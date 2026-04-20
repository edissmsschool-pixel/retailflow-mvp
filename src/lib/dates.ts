import { format, formatDistanceToNow } from "date-fns";

export const fmtDateTime = (d: string | Date) => format(new Date(d), "dd MMM yyyy, HH:mm");
export const fmtDate = (d: string | Date) => format(new Date(d), "dd MMM yyyy");
export const fmtTime = (d: string | Date) => format(new Date(d), "HH:mm");
export const fmtRelative = (d: string | Date) => formatDistanceToNow(new Date(d), { addSuffix: true });

export function startOfDayISO(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString();
}
export function endOfDayISO(d = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}
export function daysAgoISO(n: number) {
  const x = new Date(); x.setDate(x.getDate() - n); x.setHours(0, 0, 0, 0); return x.toISOString();
}
