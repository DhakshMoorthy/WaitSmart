import { Link } from 'react-router-dom';
import { Shield, Stethoscope, User } from 'lucide-react';
import { APP_NAME } from '../lib/constants';
import { useAuth } from '../hooks/useAuth';

export default function Header() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 sm:max-w-xl">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">{APP_NAME}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Live Queue
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Link
              to="/profile"
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-primary/30 hover:bg-primary-light hover:text-primary"
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </Link>
          )}
          <Link
            to="/admin"
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-primary/30 hover:bg-primary-light hover:text-primary"
          >
            <Shield className="h-3.5 w-3.5" />
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}
