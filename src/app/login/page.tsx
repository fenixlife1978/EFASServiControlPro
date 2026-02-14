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

export default function LoginPage() {
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

  // Redirect if user is already logged in
  useEffect(() => {
    const handleRedirect = async () => {
      if (!userLoading && user && firestore) {
        setLoading(true); // Show loader during async redirect logic
        const isSuperAdmin = user.uid === 'QeGMDNE4GaSJOU8XEnY3lFJ9by13';
        const redirectUrl = searchParams.get('redirect');

        if (isSuperAdmin) {
          router.push(redirectUrl || '/super-admin');
          return;
        }

        // For regular admins, fetch their institutionId
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

      const isSuperAdmin = user.uid === 'QeGMDNE4GaSJOU8XEnY3lFJ9by13';
      
      toast({
        title: 'Inicio de Sesión Exitoso',
        description: 'Redirigiendo a tu panel...',
      });
      
      // Super Admin Flow
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
        return; // Exit function, redirection is happening
      }

      // Institution Admin Flow
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data().institutionId) {
          const institutionId = userDocSnap.data().institutionId;
          const redirectUrl = searchParams.get('redirect');
          
          const finalRedirectUrl = new URL(redirectUrl || '/dashboard', window.location.origin);
          finalRedirectUrl.searchParams.set('institutionId', institutionId);
          router.push(finalRedirectUrl.pathname + finalRedirectUrl.search);
          
      } else {
          setError('Tu cuenta de administrador no está asociada a ninguna institución. Contacta al superadministrador.');
          if (auth) await auth.signOut();
          setLoading(false);
      }

    } catch (err: any) {
      console.error(err);
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
  
  if (userLoading || (user && loading)) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center text-slate-900">
            <Logo />
          </div>
          <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder al panel.
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
                  className="ml-auto inline-block text-sm underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error de Autenticación</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Accediendo..." : "Acceder"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            ¿No tienes una cuenta?{' '}
            <Link href="/signup" className="underline">
              Crear una cuenta
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
