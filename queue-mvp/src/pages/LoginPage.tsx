import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Phone, ShieldCheck } from 'lucide-react';
import { post, wakeApi } from '../lib/api';
import { APP_NAME, TAGLINE } from '../lib/constants';
import { formatPhoneDisplay, isValidPhone, toE164 } from '../lib/phone';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    wakeApi();
  }, []);

  const handleSend = async () => {
    if (!isValidPhone(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fullPhone = toE164(phone);
      const data = await post('/auth/otp/send', { phone: fullPhone });
      const next = searchParams.get('next') || '/';
      navigate(
        `/verify?phone=${encodeURIComponent(fullPhone)}&devOtp=${encodeURIComponent(data.devOtp || '')}&next=${encodeURIComponent(next)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white card-shadow">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          <h1 className="text-xl font-bold">Welcome to {APP_NAME}</h1>
        </div>
        <p className="mt-2 text-sm text-blue-100">{TAGLINE}</p>
        <p className="mt-1 text-xs text-blue-200">
          Sign in with your mobile number to book and track appointments.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl bg-white p-5 card-shadow">
        <label htmlFor="login-phone" className="block text-sm font-medium text-slate-700">
          Mobile number
        </label>
        <div className="flex gap-2">
          <span className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
            +91
          </span>
          <input
            id="login-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg tracking-wide outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={loading || phone.length < 10}
          onClick={handleSend}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
        </button>
        <p className="text-center text-xs text-slate-400">
          Staff?{' '}
          <Link to="/admin" className="font-semibold text-primary hover:underline">
            Admin login
          </Link>
        </p>
      </div>
    </div>
  );
}
