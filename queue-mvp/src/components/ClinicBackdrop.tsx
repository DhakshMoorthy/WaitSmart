import { Building2 } from 'lucide-react';

/** Neutral banner used when a clinic has no photo of its own (instead of one stock photo for every clinic). */
export default function ClinicBackdrop() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary-dark"
      aria-hidden="true"
    >
      <Building2 className="h-14 w-14 text-white/30" />
    </div>
  );
}
