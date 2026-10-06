import { AlertTriangle } from 'lucide-react';
import { useSyncErrors } from '../lib/sync/errors';

/** Full-screen blocking error (used instead of an endless spinner). */
export function SyncErrorScreen({ message }: { message: string }) {
  const all = useSyncErrors();
  const lines = [message, ...all.filter((m) => m !== message)];
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
      <AlertTriangle className="text-rose-400" size={44} />
      <h1 className="text-2xl font-bold">Connection problem</h1>
      <div className="max-w-xl space-y-2 rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-left text-sm text-rose-100">
        {lines.map((l, i) => (
          <pre key={i} className="whitespace-pre-wrap break-words font-mono">{l}</pre>
        ))}
      </div>
      <p className="max-w-md text-xs text-slate-500">
        Details are in the browser console (look for “[sync…]”). After changing Vercel environment variables, REDEPLOY.
      </p>
      <button onClick={() => location.reload()} className="rounded-xl bg-slate-800 px-5 py-3 font-semibold hover:bg-slate-700">
        Retry
      </button>
    </div>
  );
}

/** Non-blocking banner for runtime problems (write refused, connection lost…). */
export function SyncErrorBanner() {
  const errors = useSyncErrors();
  if (errors.length === 0) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-rose-700 px-4 py-2 text-center text-sm font-medium text-white shadow-lg">
      ⚠ {errors[0].split('\n')[0]}
      {errors.length > 1 && ` (+${errors.length - 1} more, see console)`}
    </div>
  );
}

