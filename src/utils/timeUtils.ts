export function formatHHMM(date: Date): string {
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDateYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export function parseHHMMToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToHHMM(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function calculateDurationMinutes(startHHMM: string, endHHMM: string): number {
  const startMins = parseHHMMToMinutes(startHHMM);
  const endMins = parseHHMMToMinutes(endHHMM);
  const diff = endMins >= startMins ? endMins - startMins : 1440 - startMins + endMins;
  return Math.max(1, diff);
}

export function calculateEndHHMM(startHHMM: string, durationMinutes: number): string {
  const startMins = parseHHMMToMinutes(startHHMM);
  const clamped = Math.max(1, Math.min(1440, Math.round(durationMinutes)));
  return minutesToHHMM(startMins + clamped);
}

export function buildTimestampsFromTimes(
  dateString: string,
  startHHMM: string,
  durationMinutes: number
): { startTimestamp: number; endTimestamp: number } {
  const [y, m, d] = dateString.split(".").map(Number);
  const [sh, sm] = startHHMM.split(":").map(Number);
  const startDate = new Date(
    Number.isFinite(y) ? y : new Date().getFullYear(),
    Number.isFinite(m) ? m - 1 : new Date().getMonth(),
    Number.isFinite(d) ? d : new Date().getDate(),
    Number.isFinite(sh) ? sh : 0,
    Number.isFinite(sm) ? sm : 0,
    0,
    0
  );
  const startTimestamp = startDate.getTime();
  const endTimestamp = startTimestamp + Math.max(1, durationMinutes) * 60 * 1000;
  return { startTimestamp, endTimestamp };
}
