import { create } from "zustand";
import type { QueueStatus } from "@waitsmart/shared";

interface QueueAppointment {
  id: string;
  tokenNumber: number;
  patientName: string;
  status: QueueStatus;
}

interface QueueState {
  doctorId: string | null;
  nowServing: number | null;
  waiting: number;
  appointments: QueueAppointment[];
  isConnected: boolean;

  setQueueData: (data: {
    doctorId: string;
    nowServing: number | null;
    waiting: number;
    appointments: QueueAppointment[];
  }) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  doctorId: null,
  nowServing: null,
  waiting: 0,
  appointments: [],
  isConnected: false,

  setQueueData(data) {
    set({
      doctorId: data.doctorId,
      nowServing: data.nowServing,
      waiting: data.waiting,
      appointments: data.appointments,
    });
  },

  setConnected(connected) {
    set({ isConnected: connected });
  },

  reset() {
    set({
      doctorId: null,
      nowServing: null,
      waiting: 0,
      appointments: [],
      isConnected: false,
    });
  },
}));
