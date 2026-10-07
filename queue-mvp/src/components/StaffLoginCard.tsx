import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { post } from '../lib/api';
import { logout, setTokens, setUser } from '../lib/auth';

const STAFF_ROLES = ['admin', 'superadmin', 'doctor'];

interface Props {
  title: string;
  subtitle: string;
  emailPlaceholder: string;
}

/**
 * Email + password sign-in for clinic staff and doctors. It does not decide where the user lands: it stores the
 * session, and the page (AdminPage / DoctorPage) routes by the account's role.
 */
export default function StaffLoginCard({ title, subtitle, emailPlaceholder }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const data = await post('/auth/login', { email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser({
        id: data.user.id,
        email: data.user.email || null,
        name: data.user.name || null,
        phone: data.user.phone || null,
        role: data.user.role,
        tenantId: data.user.tenantId || null,
        doctorId: data.user.doctorId || null,
      });

      if (!STAFF_ROLES.includes(data.user.role)) {
        logout();
        setLoginError('This account does not have clinic staff or doctor access.');
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-8">
      <div className="rounded-2xl bg-white p-6 card-shadow">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {subtitle}
        </p>
        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <div>
            <label htmlFor="staff-email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailPlaceholder}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <div>
            <label htmlFor="staff-password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          {loginError && (
            <p className="text-center text-sm text-red-500">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={loginLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
