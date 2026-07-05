/** Date & time helpers */

export function todayStr() {
  return formatDateStr(new Date());
}

export function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateStr(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysStr(str, n) {
  const d = parseDateStr(str);
  d.setDate(d.getDate() + n);
  return formatDateStr(d);
}

export function formatDisplayDate(str) {
  const d = parseDateStr(str);
  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);
  const opts = { weekday: "short", day: "numeric", month: "short" };
  const label = d.toLocaleDateString("en-IN", opts);
  if (str === today) return `Today (${d.getDate()} ${d.toLocaleDateString("en-IN", { month: "short" })})`;
  if (str === tomorrow) return `Tomorrow (${d.getDate()} ${d.toLocaleDateString("en-IN", { month: "short" })})`;
  return `${d.toLocaleDateString("en-IN", { weekday: "long" })} (${d.getDate()} ${d.toLocaleDateString("en-IN", { month: "short" })})`;
}

export function formatShortDate(str) {
  const d = parseDateStr(str);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function formatTime12(time24) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function getDateOptions(count = 3) {
  const today = todayStr();
  return Array.from({ length: count }, (_, i) => {
    const str = addDaysStr(today, i);
    return { value: str, label: formatDisplayDate(str) };
  });
}

export function isToday(str) {
  return str === todayStr();
}

export function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export function timeToMinutes(time24) {
  const [h, m] = time24.split(":").map(Number);
  return h * 60 + m;
}
