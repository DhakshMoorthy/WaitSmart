import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Loader2, Phone } from 'lucide-react';
import {
  bookAppointment,
  getDoctor,
  getDoctorDaySlots,
  subscribeToDoctorDay,
} from '../lib/db';
import { useAuth } from '../hooks/useAuth';
import {
  formatSlotGroupLabel,
  getServerSlotAvailability,
  groupServerSlots,
} from '../lib/mappers';
import { formatTime12 } from '../lib/dates';
import { isValidPhone, normalizePhone } from '../lib/phone';
import { formatDisplayDate, getDateOptions } from '../lib/slotUtils';
import type { Doctor } from '../lib/types';

export default function BookPage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get('clinic') ?? '';
  const navigate = useNavigate();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [daySlots, setDaySlots] = useState<ReturnType<typeof groupServerSlots>>({
    morning: [],
    afternoon: [],
    all: [],
    hasSlots: false,
  });
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dateOptions = useMemo(() => getDateOptions(3), []);

  useEffect(() => {
    if (doctorId) getDoctor(doctorId).then(setDoctor);
  }, [doctorId]);

  useEffect(() => {
    if (user?.name) setPatientName(user.name);
    if (user?.phone) setPhone(normalizePhone(user.phone));
  }, [user]);

  useEffect(() => {
    if (dateOptions.length > 0 && !selectedDate) {
      setSelectedDate(dateOptions[0].iso);
    }
  }, [dateOptions, selectedDate]);

  useEffect(() => {
    if (!doctorId || !selectedDate) return;

    async function loadSlots() {
      const avail = await getDoctorDaySlots(doctorId!, selectedDate);
      setDaySlots(groupServerSlots(avail.slots));
      setScheduleMessage(avail.message);
      setSelectedSlot('');
    }

    loadSlots();
    const unsub = subscribeToDoctorDay(doctorId, selectedDate, loadSlots);
    return unsub;
  }, [doctorId, selectedDate]);

  const handleConfirm = async () => {
    if (!doctorId || !clinicId || !selectedDate || !selectedSlot || !patientName.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const appointment = await bookAppointment({
        name: patientName,
        phone: normalizePhone(phone),
        doctorId,
        clinicId,
        date: selectedDate,
        slotTime: selectedSlot,
        notes: description,
      });
      navigate(`/token/${appointment.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!doctor) {
    return (
      <div className="py-12 text-center text-slate-500">
        <p>Doctor not found.</p>
        <Link to="/" className="mt-2 inline-block text-primary">
          Go home
        </Link>
      </div>
    );
  }

  const renderSlotGrid = (
    slots: typeof daySlots.morning,
    title: string,
    fallback: string,
  ) => {
    if (!slots.length) return null;
    return (
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}{' '}
          <span className="font-normal text-slate-400">
            ({formatSlotGroupLabel(slots, fallback)})
          </span>
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((entry) => {
            const status = getServerSlotAvailability(selectedDate, entry);
            const disabled = status !== 'available';
            const selected = selectedSlot === entry.time;
            return (
              <button
                key={entry.time}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedSlot(entry.time)}
                className={`rounded-xl py-2.5 text-xs font-medium transition ${
                  disabled
                    ? 'cursor-not-allowed bg-slate-100 text-slate-300'
                    : selected
                      ? 'bg-primary text-white shadow-md'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary'
                }`}
              >
                {formatTime12(entry.time)}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Link
        to={`/doctors/${clinicId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to doctors
      </Link>

      <div className="flex gap-3 rounded-2xl bg-white p-3 card-shadow">
        <img
          src={doctor.photo_url}
          alt={doctor.name}
          className="h-16 w-16 rounded-xl object-cover"
        />
        <div>
          <h1 className="font-bold text-slate-900">{doctor.name}</h1>
          <p className="text-sm text-slate-500">{doctor.specialization}</p>
          <p className="text-xs text-slate-400">{doctor.slot_duration_minutes}-min slots</p>
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Calendar className="h-3.5 w-3.5" />
          Select date
        </div>
        <div className="grid grid-cols-3 gap-2">
          {dateOptions.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setSelectedDate(d.iso)}
              className={`rounded-xl px-2 py-3 text-center transition ${
                selectedDate === d.iso
                  ? 'bg-primary text-white shadow-md'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-primary'
              }`}
            >
              <p className="text-xs font-bold">{d.label}</p>
              <p className="mt-0.5 text-[10px] opacity-80">
                {formatDisplayDate(d.iso).split(',')[1]?.trim()}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-4 card-shadow">
        {!daySlots.hasSlots ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {scheduleMessage || 'No slots available for this day. Try another date.'}
          </p>
        ) : (
          <>
            {renderSlotGrid(daySlots.morning, 'Morning', '9:00 AM – 2:00 PM')}
            {renderSlotGrid(daySlots.afternoon, 'Afternoon', '2:00 PM – 6:00 PM')}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 card-shadow">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Enter full name"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Mobile number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div>
          <label htmlFor="desc" className="mb-1 block text-sm font-medium text-slate-700">
            Description / symptoms
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of your visit or symptoms"
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={loading || !selectedSlot || !patientName.trim() || phone.length < 10}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Booking…
          </>
        ) : (
          'Confirm booking'
        )}
      </button>
    </div>
  );
}
