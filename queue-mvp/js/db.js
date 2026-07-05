import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured =
  Boolean(firebaseConfig.projectId) &&
  firebaseConfig.projectId !== "your-project-id";

let db = null;
if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

const STORAGE_KEY = "waitsmart-kvt-v1";
const CHANNEL = "waitsmart-mvp-sync";

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    clinics: [],
    doctors: [],
    queues: {},
    appointments: [],
  };
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

  const clinic1 = {
    id: "clinic-moolakadai",
    name: "KVT Hospital — Moolakadai",
    branch: "Moolakadai",
    address: "Moolakadai, Chennai",
    hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
  };
  const clinic2 = {
    id: "clinic-erukenchery",
    name: "KVT Hospital — Erukenchery",
    branch: "Erukenchery",
    address: "Erukenchery, Chennai",
    hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
  };

  const doctors = [
    {
      id: "doc-hari-prasad",
      name: "Dr. Hari Prasad",
      clinic_id: "clinic-moolakadai",
      specialization: "General Medicine",
      slot_duration_minutes: 30,
    },
  ];

  data.clinics = [clinic1, clinic2];
  data.doctors = doctors;
  data.queues = {
    "doc-hari-prasad": { doctor_id: "doc-hari-prasad", current_token: 0, last_token: 0 },
  };
  data.appointments = [];
  saveLocalData(data);
  return data;
}

const localListeners = new Set();
let broadcastChannel = null;

function notifyLocalListeners() {
  localListeners.forEach((fn) => fn());
}

function initLocalSync() {
  if (broadcastChannel) return;
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL);
    broadcastChannel.onmessage = () => notifyLocalListeners();
  } catch {
    /* ignore */
  }
}

function subscribeLocal(fn) {
  initLocalSync();
  localListeners.add(fn);
  return () => localListeners.delete(fn);
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
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  }
  seedLocalIfEmpty();
  return loadLocalData().doctors.find((d) => d.id === doctorId) || null;
}

export async function getQueue(doctorId) {
  if (isFirebaseConfigured) {
    const snap = await getDoc(doc(db, "queues", doctorId));
    if (!snap.exists()) return { doctor_id: doctorId, current_token: 0, last_token: 0 };
    return snap.data();
  }
  seedLocalIfEmpty();
  return loadLocalData().queues[doctorId] || { doctor_id: doctorId, current_token: 0, last_token: 0 };
}

export async function getWaitingAppointments(doctorId) {
  if (isFirebaseConfigured) {
    const q = query(
      collection(db, "appointments"),
      where("doctor_id", "==", doctorId),
      where("status", "==", "waiting"),
      orderBy("token", "asc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  seedLocalIfEmpty();
  return loadLocalData()
    .appointments.filter((a) => a.doctor_id === doctorId && a.status === "waiting")
    .sort((a, b) => a.token - b.token);
}

export async function getAppointment(appointmentId) {
  if (isFirebaseConfigured) {
    const snap = await getDoc(doc(db, "appointments", appointmentId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  }
  seedLocalIfEmpty();
  return loadLocalData().appointments.find((a) => a.id === appointmentId) || null;
}

export async function getAllDoctors() {
  if (isFirebaseConfigured) {
    const snap = await getDocs(collection(db, "doctors"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  seedLocalIfEmpty();
  return loadLocalData().doctors;
}

export function calcWaitMinutes(patientToken, currentToken, slotMinutes = 30) {
  const diff = Math.max(0, patientToken - currentToken);
  return diff * slotMinutes;
}

export async function getDoctorSlotDuration(doctorId) {
  const doctor = await getDoctor(doctorId);
  return doctor?.slot_duration_minutes ?? 30;
}

export async function bookAppointment({ name, doctorId, notes }) {
  if (isFirebaseConfigured) {
    return runTransaction(db, async (tx) => {
      const queueRef = doc(db, "queues", doctorId);
      const queueSnap = await tx.get(queueRef);
      const queue = queueSnap.exists()
        ? queueSnap.data()
        : { doctor_id: doctorId, current_token: 0, last_token: 0 };

      const token = queue.last_token + 1;
      tx.set(queueRef, { ...queue, last_token: token }, { merge: true });

      const apptRef = doc(collection(db, "appointments"));
      const appointment = {
        name,
        doctor_id: doctorId,
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
  const queue = data.queues[doctorId] || { doctor_id: doctorId, current_token: 0, last_token: 0 };
  const token = queue.last_token + 1;
  queue.last_token = token;
  data.queues[doctorId] = queue;

  const appointment = {
    id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    doctor_id: doctorId,
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

async function findAppointmentByToken(doctorId, token) {
  const q = query(
    collection(db, "appointments"),
    where("doctor_id", "==", doctorId),
    where("token", "==", token),
  );
  const snap = await getDocs(q);
  return snap.docs[0] || null;
}

async function advanceQueue(doctorId, action) {
  if (isFirebaseConfigured) {
    const queueSnap = await getDoc(doc(db, "queues", doctorId));
    if (!queueSnap.exists()) throw new Error("Queue not found");
    const queue = queueSnap.data();
    const currentToken = queue.current_token;
    const nextToken = currentToken + 1;

    let apptDoc = null;
    if (currentToken > 0) {
      apptDoc = await findAppointmentByToken(doctorId, currentToken);
    }

    return runTransaction(db, async (tx) => {
      const queueRef = doc(db, "queues", doctorId);
      const freshQueue = await tx.get(queueRef);
      if (!freshQueue.exists()) throw new Error("Queue not found");

      if (apptDoc) {
        const status =
          action === "no_show" ? "no_show" : action === "skip" ? "skipped" : "done";
        tx.update(apptDoc.ref, { status });
      }

      tx.update(queueRef, { current_token: nextToken });
      return {
        current_token: nextToken,
        last_token: freshQueue.data().last_token,
      };
    });
  }

  const data = loadLocalData();
  const queue = data.queues[doctorId];
  if (!queue) throw new Error("Queue not found");

  const nextToken = queue.current_token + 1;

  if (queue.current_token > 0) {
    data.appointments.forEach((a) => {
      if (a.doctor_id === doctorId && a.token === queue.current_token) {
        if (action === "no_show") a.status = "no_show";
        else if (action === "skip") a.status = "skipped";
        else if (action === "next") a.status = "done";
      }
    });
  }

  queue.current_token = nextToken;
  data.queues[doctorId] = queue;
  saveLocalData(data);
  notifyLocalListeners();
  return queue;
}

export function nextPatient(doctorId) {
  return advanceQueue(doctorId, "next");
}

export function skipPatient(doctorId) {
  return advanceQueue(doctorId, "skip");
}

export function markNoShow(doctorId) {
  return advanceQueue(doctorId, "no_show");
}

export function subscribeToQueue(doctorId, callback) {
  if (isFirebaseConfigured) {
    let latestQueue = null;
    let latestWaiting = [];

    const emit = () => {
      callback({ queue: latestQueue, waiting: latestWaiting });
    };

    const unsubQueue = onSnapshot(doc(db, "queues", doctorId), (snap) => {
      latestQueue = snap.exists() ? snap.data() : null;
      emit();
    });

    const q = query(
      collection(db, "appointments"),
      where("doctor_id", "==", doctorId),
      where("status", "==", "waiting"),
      orderBy("token", "asc"),
    );
    const unsubAppts = onSnapshot(q, (snap) => {
      latestWaiting = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    });

    return () => {
      unsubQueue();
      unsubAppts();
    };
  }

  const poll = () => {
    const data = loadLocalData();
    callback({
      queue: data.queues[doctorId] || null,
      waiting: data.appointments
        .filter((a) => a.doctor_id === doctorId && a.status === "waiting")
        .sort((a, b) => a.token - b.token),
    });
  };

  poll();
  const unsub = subscribeLocal(poll);
  const interval = setInterval(poll, 2000);
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

    const emit = () => {
      if (latestAppt) {
        callback({ appointment: latestAppt, queue: latestQueue });
      }
    };

    const apptUnsub = onSnapshot(doc(db, "appointments", appointmentId), (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      latestAppt = { id: snap.id, ...snap.data() };

      if (queueUnsub) queueUnsub();
      queueUnsub = onSnapshot(doc(db, "queues", latestAppt.doctor_id), (qSnap) => {
        latestQueue = qSnap.exists() ? qSnap.data() : null;
        emit();
      });
    });

    return () => {
      apptUnsub();
      if (queueUnsub) queueUnsub();
    };
  }

  const poll = () => {
    const data = loadLocalData();
    const appt = data.appointments.find((a) => a.id === appointmentId);
    if (!appt) {
      callback(null);
      return;
    }
    callback({
      appointment: appt,
      queue: data.queues[appt.doctor_id] || null,
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

export { isFirebaseConfigured as usingFirebase };
