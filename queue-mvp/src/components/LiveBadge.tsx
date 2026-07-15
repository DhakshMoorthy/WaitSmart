import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { subscribeSocketConnection } from '../lib/socket';

interface Props {
  label?: string;
}

export default function LiveBadge({ label = 'LIVE' }: Props) {
  const [connected, setConnected] = useState(false);

  useEffect(() => subscribeSocketConnection(setConnected), []);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${
        connected ? 'bg-red-500 live-pulse' : 'bg-slate-400'
      }`}
    >
      <Radio className="h-3 w-3" />
      {connected ? label : 'SYNC'}
    </span>
  );
}
