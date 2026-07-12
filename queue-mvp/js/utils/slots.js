/** Slot helpers — prefer server /avail list; fall back to static grid */

import { slotTimeToHHMM } from "../mappers.js";
import { isToday, nowMinutes, timeToMinutes } from "./dates.js";

const MORNING_START = 9 * 60;
const MORNING_END = 14 * 60;
const EVENING_START = 16 * 60;
const EVENING_END = 18 * 60;
const AFTERNOON_SPLIT = 14 * 60;

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

/** Build UI groups from backend /avail slots (source of truth). */
export function groupServerSlots(serverSlots = []) {
  const morning = [];
  const afternoon = [];

  for (const slot of serverSlots) {
    const time = slotTimeToHHMM(slot.slotTime);
    const minutes = timeToMinutes(time);
    const entry = { time, status: slot.status, slot };
    if (minutes < AFTERNOON_SPLIT) morning.push(entry);
    else afternoon.push(entry);
  }

  morning.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  afternoon.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  return {
    morning,
    afternoon,
    all: [...morning, ...afternoon],
    hasSlots: serverSlots.length > 0,
  };
}

export function formatSlotGroupLabel(times, fallback) {
  if (!times.length) return fallback;
  const first = times[0].time;
  const last = times[times.length - 1].time;
  return `${first} – ${last}`;
}

export function getSlotIndex(slotTime, duration = 30, serverSlots = null) {
  if (serverSlots?.length) {
    const idx = serverSlots.findIndex((s) => slotTimeToHHMM(s.slotTime) === slotTime);
    return idx >= 0 ? idx + 1 : 0;
  }
  const { all } = getAllSlotTimes(duration);
  const idx = all.indexOf(slotTime);
  return idx >= 0 ? idx + 1 : 0;
}

export function getTotalSlots(duration = 30, serverSlots = null) {
  if (serverSlots?.length) return serverSlots.length;
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

export function getServerSlotAvailability(dateStr, slotEntry) {
  if (isSlotPast(dateStr, slotEntry.time)) return "past";
  if (slotEntry.status === "booked") return "booked";
  if (slotEntry.status !== "available") return "unavailable";
  return "available";
}
