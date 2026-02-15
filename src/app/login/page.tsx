import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-4">
      <Suspense fallback={<LoadingState />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center">
      {/* Spinner con el color naranja distintivo */}
      <div className="relative flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" strokeWidth={2.5} />
        <div className="absolute h-16 w-16 rounded-full border-4 border-[#f97316]/10 border-t-[#f97316]/40 animate-pulse" />
      </div>

      {/* Marca con estilo tipográfico: Inter Black Italic */}
      <div className="space-y-1">
        <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
          EFAS <span className="text-[#f97316]">ServiControlPro</span>
        </h2>
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
          Initializing Secure Protocol
        </p>
      </div>
    </div>
  );
}