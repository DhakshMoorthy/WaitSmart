import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, LogOut, User } from 'lucide-react';
import { getPatientProfile, updatePatientProfile } from '../lib/db';
import { logoutAndRevoke } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { isValidPhone, normalizePhone, formatPhoneDisplay } from '../lib/phone';

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const profile = await getPatientProfile();
        setName(profile?.name || user?.name || '');
        setPhone(normalizePhone(profile?.phone || user?.phone || ''));
      } catch {
        setName(user?.name || '');
        setPhone(normalizePhone(user?.phone || ''));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updatePatientProfile({ name: name.trim(), phone: normalizePhone(phone) });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white card-shadow">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">My profile</h1>
            <p className="text-sm text-blue-100">
              {user?.phone ? formatPhoneDisplay(normalizePhone(user.phone)) : 'Update your details'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 rounded-2xl bg-white p-4 card-shadow">
        <div>
          <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-slate-700">
            Mobile number
          </label>
          <input
            id="profile-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Profile saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save profile'}
        </button>
      </form>

      <Link to="/track" className="block text-center text-sm font-medium text-primary hover:underline">
        View my appointments →
      </Link>

      <button
        type="button"
        onClick={() => {
          logoutAndRevoke();
          navigate('/login', { replace: true });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
