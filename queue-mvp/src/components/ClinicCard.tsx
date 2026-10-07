import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';
import ClinicBackdrop from './ClinicBackdrop';
import type { Clinic } from '../lib/types';

interface Props {
  clinic: Clinic;
}

export default function ClinicCard({ clinic }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link
      to={`/doctors/${clinic.id}`}
      className="group block overflow-hidden rounded-2xl bg-white card-shadow transition hover:shadow-lg"
    >
      <div className="relative h-36 overflow-hidden bg-slate-200">
        {clinic.image_url && !imgFailed ? (
          <img
            src={clinic.image_url}
            alt=""
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <ClinicBackdrop />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-base font-bold text-white">{clinic.name}</h3>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{clinic.address}</span>
        </div>
        <ChevronRight className="h-4 w-4 text-primary transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
