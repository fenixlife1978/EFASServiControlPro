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
import { AlertCircle, Loader2 } from 'lucide-react';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setLoading(true);
    setError(null);

    try {
      await createUserWithEmailAndPassword(auth.auth, email, password);
      
      toast({
        title: 'Protocolo de Registro Exitoso',
        description: 'Cuenta creada. Redirigiendo al panel de seguridad...',
      });
      
      router.push('/dashboard');

    } catch (err: any) {
      console.error(err);
      const errorCode = err.code;
      let friendlyMessage = 'Error en la validación del protocolo.';
      if (errorCode === 'auth/email-already-in-use') {
        friendlyMessage = 'Este email ya está registrado en la base de datos.';
      } else if (errorCode === 'auth/weak-password') {
        friendlyMessage = 'La clave debe cumplir con el mínimo de 6 caracteres.';
      } else if (errorCode === 'auth/invalid-email') {
        friendlyMessage = 'El formato del identificador (email) no es válido.';
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Estado de carga con la identidad visual de la marca [cite: 2026-02-14]
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f172a] gap-6 text-center">
        <div className="relative flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" strokeWidth={2.5} />
          <div className="absolute h-16 w-16 rounded-full border-4 border-[#f97316]/10 border-t-[#f97316]/40 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
            EDU <span className="text-[#f97316]">ControlPro</span>
          </h2>
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
            Configurando Perfil de Seguridad
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-4">
      <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#1e293b]/50 backdrop-blur-sm text-white shadow-2xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-black italic tracking-tighter uppercase">
            NUEVO <span className="text-[#f97316]">REGISTRO</span>
          </CardTitle>
          <CardDescription className="text-slate-400">
            EDUControlPro Sistema de Control Parental Educativo: Alta de nuevo administrador. [cite: 2026-02-14]
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSignUp}>
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-slate-200">Email Administrativo</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                required
                className="bg-slate-900 border-slate-700 text-white focus:border-[#f97316] focus:ring-[#f97316]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-slate-200">Clave de Acceso</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                className="bg-slate-900 border-slate-700 text-white focus:border-[#f97316] focus:ring-[#f97316]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <p className="text-[10px] text-slate-500 italic">Mínimo 6 caracteres alfanuméricos.</p>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-900/40 border-red-600 text-red-100">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-bold">Error de Protocolo</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-black italic transition-all duration-300 shadow-lg shadow-orange-900/20" 
              disabled={loading}
            >
              CREAR CUENTA ADMINISTRATIVA
            </Button>
            
            <div className="mt-4 text-center text-sm text-slate-400">
              ¿Ya posees una cuenta?{' '}
              <Link href="/login" className="font-bold text-[#f97316] underline hover:text-white transition-colors">
                Iniciar Protocolo de Acceso
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
