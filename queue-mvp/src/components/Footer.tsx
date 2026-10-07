import { APP_NAME } from '../lib/constants';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center">
      <p className="text-xs text-slate-500">{APP_NAME} • Live queue</p>
    </footer>
  );
}
