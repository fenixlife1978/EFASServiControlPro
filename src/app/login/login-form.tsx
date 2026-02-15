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
import { useFirestore, useUser } from '@/firebase';
import { auth } from '@/firebase/config';
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
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: userLoading } = useUser();

  useEffect(() => {
    const handleRedirect = async () => {
      if (!userLoading && user && firestore) {
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
            router.push(`/dashboard?institutionId=${institutionId}`);
          } else {
            if (auth) await auth.signOut();
            setError('Cuenta no asociada a una institución.');
            setLoading(false);
          }
        } catch (e) {
          setLoading(false);
        }
      }
    };
    handleRedirect();
  }, [user, userLoading, firestore, router, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) {
        setError("Servicios de seguridad no disponibles.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // La redirección la manejará el useEffect automáticamente al detectar el nuevo 'user'
      toast({
        title: 'Acceso Autorizado',
        description: 'Sincronizando con el servidor...',
      });
    } catch (err: any) {
      console.error(err);
      setError('Credenciales inválidas o error de conexión.');
      setLoading(false);
    }
  };
  
  if (userLoading || (user && loading)) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" />
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic text-white uppercase italic tracking-tighter">
            EFAS <span className="text-[#f97316]">ServiControlPro</span>
          </h2>
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
            Protocolo de Acceso
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#1e293b]/50 backdrop-blur-sm text-white">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center"><Logo /></div>
        <CardTitle className="text-2xl font-black italic tracking-tighter">
          INICIAR <span className="text-[#f97316]">SESIÓN</span>
        </CardTitle>
        <CardDescription className="text-slate-400">
          EFAS ServiControlPro: Panel de Control.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleLogin}>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@servipro.com"
              required
              className="bg-slate-900 border-slate-700 focus:border-[#f97316]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Contraseña</Label>
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
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold" 
            disabled={loading}
          >
            {loading ? "VALIDANDO..." : "ACCEDER"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
