'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/common/logo';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: userLoading } = useUser();

  // Redirección si el usuario ya está logueado
  useEffect(() => {
    const handleRedirect = async () => {
      if (!userLoading && user && firestore) {
        setLoading(true);
        const isSuperAdmin = user.email === 'vallecondo@gmail.com';
        const redirectUrl = searchParams.get('redirect');

        if (isSuperAdmin) {
          router.push(redirectUrl || '/super-admin');
          return;
        }

        try {
          const userDocRef = doc(firestore, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists() && userDocSnap.data().institutionId) {
            const institutionId = userDocSnap.data().institutionId;
            const finalRedirectUrl = new URL(redirectUrl || '/dashboard', window.location.origin);
            finalRedirectUrl.searchParams.set('institutionId', institutionId);
            router.push(finalRedirectUrl.pathname + finalRedirectUrl.search);
          } else {
            if (auth) await auth.signOut();
            setError('Tu cuenta de administrador no está asociada a ninguna institución.');
            setLoading(false);
          }
        } catch (e) {
          if (auth) await auth.signOut();
          setError('No se pudo verificar la información de tu institución.');
          setLoading(false);
        }
      }
    };
    handleRedirect();
  }, [user, userLoading, firestore, auth, router, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;

    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const isSuperAdmin = user.email === 'vallecondo@gmail.com';
      
      toast({
        title: 'Inicio de Sesión Exitoso',
        description: 'Redirigiendo a tu panel...',
      });
      
      if (isSuperAdmin) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
                id: user.uid,
                email: user.email,
                role: 'superAdmin',
                displayName: user.email?.split('@')[0] || 'Super Admin'
            });
        }
        router.push('/super-admin');
        return;
      }

      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data().institutionId) {
          const institutionId = userDocSnap.data().institutionId;
          const redirectUrl = searchParams.get('redirect');
          const finalRedirectUrl = new URL(redirectUrl || '/dashboard', window.location.origin);
          finalRedirectUrl.searchParams.set('institutionId', institutionId);
          router.push(finalRedirectUrl.pathname + finalRedirectUrl.search);
      } else {
          setError('Tu cuenta no está asociada a ninguna institución.');
          if (auth) await auth.signOut();
          setLoading(false);
      }
    } catch (err: any) {
      const errorCode = err.code;
      let friendlyMessage = 'Ocurrió un error inesperado.';
      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        friendlyMessage = 'El email o la contraseña son incorrectos.';
      } else if (errorCode === 'auth/invalid-email') {
        friendlyMessage = 'El formato del email no es válido.';
      }
      setError(friendlyMessage);
      setLoading(false);
    }
  };
  
  // Pantalla de carga con identidad visual EFAS ServiControlPro [cite: 2026-02-14]
  if (userLoading || (user && loading)) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center">
        <div className="relative flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" strokeWidth={2.5} />
          <div className="absolute h-16 w-16 rounded-full border-4 border-[#f97316]/10 border-t-[#f97316]/40 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
            EFAS <span className="text-[#f97316]">ServiControlPro</span>
          </h2>
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
            Autenticando Acceso Seguro
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#1e293b]/50 backdrop-blur-sm text-white">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>
        <CardTitle className="text-2xl font-black italic italic tracking-tighter">
          INICIAR <span className="text-[#f97316]">SESIÓN</span>
        </CardTitle>
        <CardDescription className="text-slate-400">
          EFAS ServiControlPro: Protocolo de Acceso. [cite: 2026-02-14]
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleLogin}>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              required
              className="bg-slate-900 border-slate-700 focus:border-[#f97316]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="#"
                className="ml-auto inline-block text-sm underline text-slate-400 hover:text-[#f97316]"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Input 
              id="password" 
              type="password" 
              required 
              className="bg-slate-900 border-slate-700 focus:border-[#f97316]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-900/50 border-red-500 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error de Autenticación</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold" 
            disabled={loading}
          >
            {loading ? "ACCEDIENDO..." : "ACCEDER AL PANEL"}
          </Button>
          
          <div className="mt-4 text-center text-sm text-slate-400">
            ¿No tienes una cuenta?{' '}
            <Link href="/signup" className="underline hover:text-[#f97316] transition-colors">
              Crear una
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}