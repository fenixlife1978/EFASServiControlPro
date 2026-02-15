'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { useAuth } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    // Validación de Protocolo: Coincidencia de Claves [cite: 2026-02-14]
    if (password !== confirmPassword) {
      setError('Las claves de acceso no coinciden en el sistema.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      
      toast({
        title: 'PROTOCOLO EXITOSO',
        description: 'Identidad creada. Redirigiendo al centro de control...',
      });
      
      router.push('/dashboard');
    } catch (err: any) {
      const errorCode = err.code;
      let friendlyMessage = 'Fallo en la verificación del protocolo.';
      
      if (errorCode === 'auth/email-already-in-use') {
        friendlyMessage = 'Este identificador ya está registrado.';
      } else if (errorCode === 'auth/weak-password') {
        friendlyMessage = 'La clave debe ser de alta seguridad (mín. 6 caracteres).';
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center py-10">
        <div className="relative flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" strokeWidth={2.5} />
          <div className="absolute h-16 w-16 rounded-full border-4 border-[#f97316]/10 border-t-[#f97316]/40 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
            EFAS <span className="text-[#f97316]">ServiControlPro</span>
          </h2>
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
            Sincronizando Base de Datos
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#1e293b]/50 backdrop-blur-sm text-white shadow-2xl">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>
        <CardTitle className="text-2xl font-black italic tracking-tighter uppercase">
          REGISTRO <span className="text-[#f97316]">ADMIN</span>
        </CardTitle>
        <CardDescription className="text-slate-400">
          EFAS ServiControlPro: Alta de Seguridad. [cite: 2026-02-14]
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSignUp}>
          <div className="grid gap-2">
            <Label htmlFor="email">Email de Identidad</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@servipro.com"
              required
              className="bg-slate-900 border-slate-700 focus:border-[#f97316]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Clave de Acceso</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              className="bg-slate-900 border-slate-700 focus:border-[#f97316]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirmar Clave</Label>
            <Input 
              id="confirmPassword" 
              type="password" 
              required 
              className="bg-slate-900 border-slate-700 focus:border-[#f97316]"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-900/40 border-red-600 text-red-100">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Error de Validación</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-black italic transition-all"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            ACTIVAR CUENTA ADMIN
          </Button>
          
          <div className="mt-4 text-center text-sm text-slate-400">
            ¿Ya eres parte del sistema?{' '}
            <Link href="/login" className="font-bold text-[#f97316] underline">
              Acceder al Protocolo
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
