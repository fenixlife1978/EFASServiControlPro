import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center gap-4 text-center text-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-semibold">Cargando sistema de seguridad...</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
