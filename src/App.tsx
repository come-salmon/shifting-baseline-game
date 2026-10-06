import { Link, Route, Routes } from 'react-router-dom';
import { Monitor, Smartphone } from 'lucide-react';
import Host from './pages/Host';
import Play from './pages/Play';
import Dashboard from './pages/Dashboard';
import { SyncErrorBanner } from './components/SyncError';

function Landing() {
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">The Shifting Baseline</h1>
      <p className="text-slate-400">Prevalence-induced concept change — live experiment</p>
      <Link to="/host" className="flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 p-5 text-lg font-semibold hover:bg-indigo-500">
        <Monitor /> Host / Projector
      </Link>
      <Link to="/play" className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-800 p-5 text-lg font-semibold hover:bg-slate-700">
        <Smartphone /> Join as participant
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <>
      <SyncErrorBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host" element={<Host />} />
        <Route path="/play" element={<Play />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </>
  );
}

