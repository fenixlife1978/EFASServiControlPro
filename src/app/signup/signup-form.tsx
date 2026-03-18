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

    if (password !== confirmPassword) {
      setError('Las claves de acceso no coinciden.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createUserWithEmailAndPassword(auth.auth, email, password);
      toast({
        title: 'PROTOCOLO EXITOSO',
        description: 'Cuenta administrativa creada correctamente.',
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError('Fallo en el registro de seguridad.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" />
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
            EDU <span className="text-[#f97316]">ControlPro</span>
          </h2>
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
            Sincronizando Identidad
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#1e293b]/50 backdrop-blur-sm text-white shadow-2xl">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center"><Logo /></div>
        <CardTitle className="text-2xl font-black italic tracking-tighter uppercase">
          REGISTRO <span className="text-[#f97316]">ADMIN</span>
        </CardTitle>
        <CardDescription className="text-slate-400">
          EDUControlPro Sistema de Control Parental Educativo: Alta de Seguridad.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSignUp}>
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
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Clave de Acceso</Label>
            <Input id="password" type="password" required className="bg-slate-900 border-slate-700" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirmar Clave</Label>
            <Input id="confirmPassword" type="password" required className="bg-slate-900 border-slate-700" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-900/40 border-red-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-black italic">
            <ShieldCheck className="mr-2 h-4 w-4" />
            ACTIVAR CUENTA
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
