/** Slot generation: 30-min slots, 9 AM–2 PM & 4 PM–6 PM */

import { isToday, nowMinutes, timeToMinutes } from "./dates.js";

const MORNING_START = 9 * 60;
const MORNING_END = 14 * 60;
const EVENING_START = 16 * 60;
const EVENING_END = 18 * 60;

function buildRange(startMin, endMin, duration) {
  const slots = [];
  for (let t = startMin; t + duration <= endMin; t += duration) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

export function getAllSlotTimes(duration = 30) {
  const morning = buildRange(MORNING_START, MORNING_END, duration);
  const evening = buildRange(EVENING_START, EVENING_END, duration);
  return { morning, evening, all: [...morning, ...evening] };
}

export function getSlotIndex(slotTime, duration = 30) {
  const { all } = getAllSlotTimes(duration);
  const idx = all.indexOf(slotTime);
  return idx >= 0 ? idx + 1 : 0;
}

export function getTotalSlots(duration = 30) {
  return getAllSlotTimes(duration).all.length;
}

export function isSlotPast(dateStr, slotTime) {
  if (!isToday(dateStr)) return false;
  return timeToMinutes(slotTime) <= nowMinutes();
}

export function getSlotAvailability(dateStr, slotTime, bookedTimes, duration = 30) {
  if (isSlotPast(dateStr, slotTime)) return "past";
  if (bookedTimes.has(slotTime)) return "booked";
  return "available";
}
