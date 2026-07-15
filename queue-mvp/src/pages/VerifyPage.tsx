import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { post } from '../lib/api';
import { setTokens, setUser } from '../lib/auth';
import { formatPhoneDisplay } from '../lib/phone';

export default function VerifyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone') || '';
  const devOtp = searchParams.get('devOtp') || '';
  const next = searchParams.get('next') || '/';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [currentDevOtp, setCurrentDevOtp] = useState(devOtp);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!phone) navigate('/login', { replace: true });
  }, [phone, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const otpValue = otp.join('');

  const doVerify = async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    setError('');
    try {
      const data = await post('/auth/otp/verify', { phone, otp: code });
      setTokens(data.accessToken, data.refreshToken);
      setUser({
        id: data.user.id,
        email: data.user.email || null,
        name: data.user.name || null,
        phone: data.user.phone || phone,
        role: data.user.role,
        tenantId: data.user.tenantId || null,
        doctorId: data.user.doctorId || null,
      });

      if (data.user.role === 'doctor') {
        navigate('/admin', { replace: true });
      } else {
        navigate(next, { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (idx: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextOtp = [...otp];
    nextOtp[idx] = digit;
    setOtp(nextOtp);
    if (digit && idx < 5) inputsRef.current[idx + 1]?.focus();
    const joined = nextOtp.join('');
    if (joined.length === 6) doVerify(joined);
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handleResend = async () => {
    try {
      const data = await post('/auth/otp/send', { phone });
      if (data.devOtp) setCurrentDevOtp(data.devOtp);
      setOtp(['', '', '', '', '', '']);
      setCountdown(30);
      inputsRef.current[0]?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resend OTP');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white card-shadow">
        <h1 className="text-xl font-bold">Verify OTP</h1>
        <p className="mt-2 text-sm text-blue-100">
          Code sent to <strong>{formatPhoneDisplay(phone)}</strong>
        </p>
      </div>

      <div className="space-y-4 rounded-2xl bg-white p-5 card-shadow">
        {currentDevOtp && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-amber-700">Dev OTP</p>
            <p className="text-2xl font-bold tracking-[0.3em] text-amber-900">{currentDevOtp}</p>
            <p className="mt-1 text-[10px] text-amber-600">SMS not configured — use this code</p>
          </div>
        )}

        <div className="flex justify-center gap-2">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => { inputsRef.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInput(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="h-12 w-10 rounded-xl border border-slate-200 text-center text-xl font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          ))}
        </div>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={loading || otpValue.length < 6}
          onClick={() => doVerify(otpValue)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Verify &amp; continue
            </>
          )}
        </button>

        <button
          type="button"
          disabled={countdown > 0}
          onClick={handleResend}
          className="w-full text-center text-xs text-slate-400 hover:text-primary disabled:opacity-50"
        >
          {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
        </button>

        <Link to="/login" className="block text-center text-xs text-slate-400 hover:text-primary">
          Change number
        </Link>
      </div>
    </div>
  );
}
