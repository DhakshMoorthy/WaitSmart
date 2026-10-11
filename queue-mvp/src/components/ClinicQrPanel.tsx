import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ChevronDown, Download, Link2, Printer, QrCode } from 'lucide-react';

interface Props {
  /** clinic id -> clinic name */
  clinicNames: Record<string, string>;
}

/** The page a patient lands on after scanning: this clinic's doctors (they sign in first if needed). */
export function clinicBookingUrl(clinicId: string) {
  return `${window.location.origin}/doctors/${clinicId}`;
}

function fileSafe(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clinic';
}

function ClinicQrCard({ clinicId, name }: { clinicId: string; name: string }) {
  const url = clinicBookingUrl(clinicId);
  const [png, setPng] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      .then((data) => !cancelled && setPng(data))
      .catch(() => !cancelled && setPng(''));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the link is shown on screen anyway */
    }
  };

  const print = () => {
    if (!png) return;
    const w = window.open('', '_blank', 'width=520,height=720');
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    w.document.write(
      `<!doctype html><title>${esc(name)} — QR</title>
       <body style="font-family:system-ui,sans-serif;text-align:center;padding:32px">
       <h1 style="margin:0 0 4px">${esc(name)}</h1>
       <p style="margin:0 0 16px;color:#475569">Scan to book your token</p>
       <img src="${png}" style="width:340px;height:340px"/>
       <p style="color:#64748b;font-size:12px;word-break:break-all">${esc(url)}</p>
       <script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body>`,
    );
    w.document.close();
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      {png ? (
        <img src={png} alt={`QR code for ${name}`} className="h-24 w-24 shrink-0 rounded-lg" />
      ) : (
        <div className="h-24 w-24 shrink-0 animate-pulse rounded-lg bg-slate-100" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
        <p className="truncate text-xs text-slate-400">{url}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary"
          >
            <Link2 className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={png || undefined}
            download={`${fileSafe(name)}-qr.png`}
            aria-disabled={!png}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary"
          >
            <Download className="h-3 w-3" />
            PNG
          </a>
          <button
            type="button"
            onClick={print}
            disabled={!png}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Printer className="h-3 w-3" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

/** Admin: one printable QR code + booking link per clinic, for reception desks, posters and websites. */
export default function ClinicQrPanel({ clinicNames }: Props) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(clinicNames).sort((a, b) => a[1].localeCompare(b[1]));
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white card-shadow">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <QrCode className="h-4 w-4 text-primary" />
          Booking QR codes
          <span className="text-xs font-normal text-slate-400">({entries.length})</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4">
          <p className="text-xs text-slate-500">
            Patients who scan a code land on that clinic's doctors, then sign in with their phone number to book.
          </p>
          {entries.map(([id, name]) => (
            <ClinicQrCard key={id} clinicId={id} name={name} />
          ))}
        </div>
      )}
    </div>
  );
}
