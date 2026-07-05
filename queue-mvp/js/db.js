import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getSlotIndex, getTotalSlots, getAllSlotTimes } from "./utils/slots.js";
import { todayStr } from "./utils/dates.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured =
  Boolean(firebaseConfig.projectId) && firebaseConfig.projectId !== "your-project-id";

let db = null;
if (isFirebaseConfigured) {
  initializeApp(firebaseConfig);
  db = getFirestore();
}

const STORAGE_KEY = "waitsmart-kvt-v2";
const CHANNEL = "waitsmart-kvt-sync";

const CLINIC_IMG =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80";
const DOC_MALE =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80";
const DOC_FEMALE =
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80";

function queueKey(doctorId, date) {
  return `${doctorId}_${date}`;
}

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { clinics: [], doctors: [], queues: {}, appointments: [] };
}

function saveLocalData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try {
    new BroadcastChannel(CHANNEL).postMessage({ type: "update" });
  } catch {
    /* ignore */
  }
}

function seedLocalIfEmpty() {
  const data = loadLocalData();
  if (data.clinics.length > 0) return data;

  data.clinics = [
    {
      id: "clinic-moolakadai",
      name: "KVT Hospital — Moolakadai",
      branch: "Moolakadai",
      address: "Moolakadai, Chennai",
      hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
      image_url: CLINIC_IMG,
    },
    {
      id: "clinic-erukenchery",
      name: "KVT Hospital — Erukenchery",
      branch: "Erukenchery",
      address: "Erukenchery, Chennai",
      hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
      image_url: CLINIC_IMG,
    },
  ];

  data.doctors = [
    {
      id: "doc-karthik",
      name: "Dr. Karthik Iyer",
      clinic_id: "clinic-moolakadai",
      specialization: "General Physician",
      experience_years: 12,
      slot_duration_minutes: 30,
      photo_url: DOC_MALE,
    },
    {
      id: "doc-vandana",
      name: "Dr. Vandana Rao",
      clinic_id: "clinic-moolakadai",
      specialization: "Pediatrician",
      experience_years: 9,
      slot_duration_minutes: 30,
      photo_url: DOC_FEMALE,
    },
    {
      id: "doc-hari",
      name: "Dr. Hari Prasad",
      clinic_id: "clinic-erukenchery",
      specialization: "General Medicine",
      experience_years: 15,
      slot_duration_minutes: 30,
      photo_url: DOC_MALE,
    },
  ];

  data.queues = {};
  data.appointments = [];
  saveLocalData(data);
  return data;
}

const localListeners = new Set();
let broadcastChannel = null;

function notifyLocalListeners() {
  localListeners.forEach((fn) => fn());
}

function subscribeLocal(fn) {
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL);
      broadcastChannel.onmessage = () => notifyLocalListeners();
    } catch {
      /* ignore */
    }
  }
  localListeners.add(fn);
  return () => localListeners.delete(fn);
}

function ensureQueue(data, doctorId, date) {
  const key = queueKey(doctorId, date);
  if (!data.queues[key]) {
    data.queues[key] = { doctor_id: doctorId, date, current_token: 0, last_token: 0 };
  }
  return data.queues[key];
}

function getAppointmentsForDoctorDate(data, doctorId, date) {
  return data.appointments.filter((a) => a.doctor_id === doctorId && a.date === date);
}

// ─── Public API ───────────────────────────────────────────────

export async function getClinics() {
  if (isFirebaseConfigured) {
    const snap = await getDocs(collection(db, "clinics"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  seedLocalIfEmpty();
  return loadLocalData().clinics;
}

export async function getClinic(clinicId) {
  const clinics = await getClinics();
  return clinics.find((c) => c.id === clinicId) || null;
}

export async function getDoctors(clinicId) {
  if (isFirebaseConfigured) {
    const q = query(collection(db, "doctors"), where("clinic_id", "==", clinicId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  seedLocalIfEmpty();
  return loadLocalData().doctors.filter((d) => d.clinic_id === clinicId);
}

export async function getDoctor(doctorId) {
  if (isFirebaseConfigured) {
    const snap = await getDoc(doc(db, "doctors", doctorId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
  seedLocalIfEmpty();
  return loadLocalData().doctors.find((d) => d.id === doctorId) || null;
}

export async function getAllDoctors() {
  if (isFirebaseConfigured) {
    const snap = await getDocs(collection(db, "doctors"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  seedLocalIfEmpty();
  return loadLocalData().doctors;
}

export async function getQueue(doctorId, date = todayStr()) {
  const key = queueKey(doctorId, date);
  if (isFirebaseConfigured) {
    const snap = await getDoc(doc(db, "queues", key));
    if (!snap.exists()) return { doctor_id: doctorId, date, current_token: 0, last_token: 0 };
    return snap.data();
  }
  const data = seedLocalIfEmpty();
  return ensureQueue(data, doctorId, date);
}

export async function getBookedSlotTimes(doctorId, date) {
  const appts = await getAppointmentsForDate(doctorId, date);
  return new Set(appts.filter((a) => a.status !== "cancelled").map((a) => a.slot_time));
}

export async function getAppointmentsForDate(doctorId, date) {
  if (isFirebaseConfigured) {
    const q = query(
      collection(db, "appointments"),
      where("doctor_id", "==", doctorId),
      where("date", "==", date),
      orderBy("token", "asc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  seedLocalIfEmpty();
  return getAppointmentsForDoctorDate(loadLocalData(), doctorId, date).sort(
    (a, b) => a.token - b.token,
  );
}

export async function getAppointment(appointmentId) {
  if (isFirebaseConfigured) {
    const snap = await getDoc(doc(db, "appointments", appointmentId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
  seedLocalIfEmpty();
  return loadLocalData().appointments.find((a) => a.id === appointmentId) || null;
}

export async function getDoctorSlotDuration(doctorId) {
  const doctor = await getDoctor(doctorId);
  return doctor?.slot_duration_minutes ?? 30;
}

export function calcWaitMinutes(patientToken, currentToken, slotMinutes = 30) {
  if (!patientToken || !currentToken) {
    const diff = Math.max(0, (patientToken || 0) - (currentToken || 0));
    return diff * slotMinutes;
  }
  const diff = Math.max(0, patientToken - currentToken);
  return diff * slotMinutes;
}

export function getQueueStats(queue, appointments) {
  const current = queue?.current_token ?? 0;
  const active = appointments.filter((a) => !["cancelled"].includes(a.status));
  const waiting = active.filter((a) => a.status === "waiting" && a.token > current);
  const inCabin = active.find((a) => a.token === current && current > 0 && a.status === "waiting");
  return {
    nowServing: current > 0 ? current : null,
    booked: active.length,
    waiting: waiting.length,
    inCabin,
    waitingList: waiting,
  };
}

export async function bookAppointment({ name, doctorId, clinicId, date, slotTime, notes }) {
  const duration = await getDoctorSlotDuration(doctorId);
  const slotIndex = getSlotIndex(slotTime, duration);
  const totalSlots = getTotalSlots(duration);

  if (isFirebaseConfigured) {
    const key = queueKey(doctorId, date);
    return runTransaction(db, async (tx) => {
      const queueRef = doc(db, "queues", key);
      const queueSnap = await tx.get(queueRef);
      const queue = queueSnap.exists()
        ? queueSnap.data()
        : { doctor_id: doctorId, date, current_token: 0, last_token: 0 };

      const token = queue.last_token + 1;
      tx.set(queueRef, { ...queue, last_token: token }, { merge: true });

      const apptRef = doc(collection(db, "appointments"));
      const appointment = {
        name,
        doctor_id: doctorId,
        clinic_id: clinicId,
        date,
        slot_time: slotTime,
        slot_index: slotIndex,
        total_slots: totalSlots,
        token,
        status: "waiting",
        notes: notes || "",
        created_at: serverTimestamp(),
      };
      tx.set(apptRef, appointment);
      return { id: apptRef.id, ...appointment, created_at: new Date().toISOString() };
    });
  }

  const data = seedLocalIfEmpty();
  const booked = getAppointmentsForDoctorDate(data, doctorId, date);
  if (booked.some((a) => a.slot_time === slotTime && a.status !== "cancelled")) {
    throw new Error("This slot was just booked. Please pick another.");
  }

  const queue = ensureQueue(data, doctorId, date);
  const token = queue.last_token + 1;
  queue.last_token = token;

  const appointment = {
    id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    doctor_id: doctorId,
    clinic_id: clinicId,
    date,
    slot_time: slotTime,
    slot_index: slotIndex,
    total_slots: totalSlots,
    token,
    status: "waiting",
    notes: notes || "",
    created_at: new Date().toISOString(),
  };
  data.appointments.push(appointment);
  saveLocalData(data);
  notifyLocalListeners();
  return appointment;
}

async function findAppointmentByToken(doctorId, date, token) {
  if (isFirebaseConfigured) {
    const q = query(
      collection(db, "appointments"),
      where("doctor_id", "==", doctorId),
      where("date", "==", date),
      where("token", "==", token),
    );
    const snap = await getDocs(q);
    return snap.docs[0] || null;
  }
  const data = loadLocalData();
  const appt = data.appointments.find(
    (a) => a.doctor_id === doctorId && a.date === date && a.token === token,
  );
  return appt ? { ref: null, data: () => appt, id: appt.id } : null;
}

async function advanceQueue(doctorId, date, action) {
  const key = queueKey(doctorId, date);

  if (isFirebaseConfigured) {
    const queue = await getQueue(doctorId, date);
    const currentToken = queue.current_token;
    const nextToken = currentToken + 1;
    let apptDoc = null;
    if (currentToken > 0) {
      apptDoc = await findAppointmentByToken(doctorId, date, currentToken);
    }

    return runTransaction(db, async (tx) => {
      const queueRef = doc(db, "queues", key);
      if (apptDoc) {
        const status = action === "no_show" ? "no_show" : action === "skip" ? "skipped" : "done";
        tx.update(apptDoc.ref, { status });
      }
      tx.set(queueRef, { doctor_id: doctorId, date, current_token: nextToken, last_token: queue.last_token }, { merge: true });
      return { current_token: nextToken, last_token: queue.last_token };
    });
  }

  const data = loadLocalData();
  const queue = ensureQueue(data, doctorId, date);
  const nextToken = queue.current_token + 1;

  if (queue.current_token > 0) {
    data.appointments.forEach((a) => {
      if (a.doctor_id === doctorId && a.date === date && a.token === queue.current_token) {
        if (action === "no_show") a.status = "no_show";
        else if (action === "skip") a.status = "skipped";
        else a.status = "done";
      }
    });
  }

  queue.current_token = nextToken;
  saveLocalData(data);
  notifyLocalListeners();
  return queue;
}

export function nextPatient(doctorId, date) {
  return advanceQueue(doctorId, date, "next");
}

export function skipPatient(doctorId, date) {
  return advanceQueue(doctorId, date, "skip");
}

export function markNoShow(doctorId, date) {
  return advanceQueue(doctorId, date, "no_show");
}

export async function resetQueue(doctorId, date) {
  const key = queueKey(doctorId, date);
  if (isFirebaseConfigured) {
    await setDoc(doc(db, "queues", key), {
      doctor_id: doctorId,
      date,
      current_token: 0,
      last_token: 0,
    });
    return;
  }
  const data = loadLocalData();
  data.queues[key] = { doctor_id: doctorId, date, current_token: 0, last_token: 0 };
  data.appointments.forEach((a) => {
    if (a.doctor_id === doctorId && a.date === date && a.status === "waiting") {
      a.status = "cancelled";
    }
  });
  saveLocalData(data);
  notifyLocalListeners();
}

export function subscribeToDoctorDay(doctorId, date, callback) {
  if (isFirebaseConfigured) {
    let latestQueue = null;
    let latestAppts = [];

    const emit = async () => {
      const duration = await getDoctorSlotDuration(doctorId);
      callback({
        queue: latestQueue,
        appointments: latestAppts,
        stats: getQueueStats(latestQueue, latestAppts),
        duration,
      });
    };

    const unsubQ = onSnapshot(doc(db, "queues", queueKey(doctorId, date)), (snap) => {
      latestQueue = snap.exists() ? snap.data() : { doctor_id: doctorId, date, current_token: 0, last_token: 0 };
      emit();
    });

    const q = query(
      collection(db, "appointments"),
      where("doctor_id", "==", doctorId),
      where("date", "==", date),
      orderBy("token", "asc"),
    );
    const unsubA = onSnapshot(q, (snap) => {
      latestAppts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    });

    return () => {
      unsubQ();
      unsubA();
    };
  }

  const poll = async () => {
    const data = loadLocalData();
    const queue = ensureQueue(data, doctorId, date);
    const appointments = getAppointmentsForDoctorDate(data, doctorId, date).sort(
      (a, b) => a.token - b.token,
    );
    const duration = await getDoctorSlotDuration(doctorId);
    callback({ queue, appointments, stats: getQueueStats(queue, appointments), duration });
  };

  poll();
  const unsub = subscribeLocal(poll);
  const interval = setInterval(poll, 1500);
  return () => {
    unsub();
    clearInterval(interval);
  };
}

export function subscribeToAppointment(appointmentId, callback) {
  if (isFirebaseConfigured) {
    let latestAppt = null;
    let latestQueue = null;
    let queueUnsub = null;

    const emit = async () => {
      if (!latestAppt) return;
      const duration = await getDoctorSlotDuration(latestAppt.doctor_id);
      callback({
        appointment: latestAppt,
        queue: latestQueue,
        stats: getQueueStats(latestQueue, [latestAppt]),
        duration,
      });
    };

    const apptUnsub = onSnapshot(doc(db, "appointments", appointmentId), (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      latestAppt = { id: snap.id, ...snap.data() };
      if (queueUnsub) queueUnsub();
      queueUnsub = onSnapshot(
        doc(db, "queues", queueKey(latestAppt.doctor_id, latestAppt.date)),
        (qSnap) => {
          latestQueue = qSnap.exists()
            ? qSnap.data()
            : { current_token: 0, last_token: 0 };
          emit();
        },
      );
    });

    return () => {
      apptUnsub();
      if (queueUnsub) queueUnsub();
    };
  }

  const poll = async () => {
    const data = loadLocalData();
    const appt = data.appointments.find((a) => a.id === appointmentId);
    if (!appt) {
      callback(null);
      return;
    }
    const queue = ensureQueue(data, appt.doctor_id, appt.date);
    const duration = await getDoctorSlotDuration(appt.doctor_id);
    callback({
      appointment: appt,
      queue,
      stats: getQueueStats(queue, [appt]),
      duration,
    });
  };

  poll();
  const unsub = subscribeLocal(poll);
  const interval = setInterval(poll, 1500);
  return () => {
    unsub();
    clearInterval(interval);
  };
}

export { getAllSlotTimes, getTotalSlots };
export { isFirebaseConfigured as usingFirebase };
