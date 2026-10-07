export type DoctorGender = 'male' | 'female' | null | undefined;

const THEME = {
  male: { bg: '#dbeafe', fg: '#2563eb', hair: '#1e3a8a' },
  female: { bg: '#fce7f3', fg: '#db2777', hair: '#831843' },
  neutral: { bg: '#e2e8f0', fg: '#64748b', hair: '#334155' },
} as const;

interface Props {
  gender?: DoctorGender;
  name: string;
  /** Size / shape utilities, e.g. "h-16 w-16 rounded-xl". */
  className?: string;
}

/**
 * Placeholder profile picture: a male or female doctor logo (neutral when the doctor's gender is not set).
 * Inline SVG, so there is nothing to download and every doctor no longer shares one stock photo.
 */
export default function DoctorAvatar({ gender, name, className }: Props) {
  const t = THEME[gender === 'male' || gender === 'female' ? gender : 'neutral'];
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${name} - profile picture placeholder`}
      className={className}
    >
      <rect width="64" height="64" fill={t.bg} />
      {gender === 'female' && (
        // long hair behind the head and shoulders
        <path d="M19 30c-2-12 4-20 13-20s15 8 13 20c0 8-2 13-5 16H24c-3-3-5-8-5-16z" fill={t.hair} />
      )}
      {/* shoulders (white coat) */}
      <path d="M10 64c0-13 9-21 22-21s22 8 22 21z" fill={t.fg} />
      <path d="M28 44l4 9 4-9z" fill="#ffffff" />
      {/* head */}
      <circle cx="32" cy="27" r="11" fill="#f5d0b0" />
      {gender === 'male' && (
        <path d="M21 25c0-8 5-13 11-13s11 5 11 13c-3-4-7-6-11-6s-8 2-11 6z" fill={t.hair} />
      )}
      {gender === 'female' && (
        <path d="M21 27c0-9 5-14 11-14s11 5 11 14c-4-1-8-5-11-8-3 3-7 7-11 8z" fill={t.hair} />
      )}
      {(gender !== 'male' && gender !== 'female') && (
        <path d="M21 25c0-8 5-13 11-13s11 5 11 13c-3-3-7-5-11-5s-8 2-11 5z" fill={t.hair} />
      )}
      {/* small medical cross */}
      <circle cx="52" cy="12" r="8" fill="#ffffff" />
      <path d="M52 8v8M48 12h8" stroke={t.fg} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
