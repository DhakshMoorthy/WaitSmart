import { Stethoscope } from 'lucide-react';
import { APP_NAME } from '../lib/constants';

export default function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
        <Stethoscope className="h-7 w-7" />
      </div>
      <p className="mt-4 text-lg font-semibold text-slate-800">{APP_NAME}</p>
      <p className="mt-2 text-sm text-slate-500">Loading live queue…</p>
      <div className="mt-4 h-1 w-32 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
    </div>
  );
}
