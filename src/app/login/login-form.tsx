'use client';

import { useState, useEffect } from 'react';
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
import { auth, db } from '@/firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Autenticación con Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Validación de Roles y asignación de Instituto
      if (user.email === 'vallecondo@gmail.com') {
        // Lógica para Super Admin
        localStorage.setItem('userRole', 'super-admin');
        localStorage.removeItem('InstitutoId'); // El SA elige dinámicamente
        
        toast({ title: 'Acceso Super Admin', description: 'Cargando panel de control global...' });
        router.push('/dashboard?view=super-admin');
      } else {
        // Lógica para Director / Profesor (Consultamos nuestra tabla de usuarios vinculados)
        const q = query(collection(db, "usuarios"), where("email", "==", user.email?.toLowerCase()));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const userData = snap.docs[0].data();
          
          // Guardamos en LocalStorage para el InstitutionContext
          localStorage.setItem('InstitutoId', userData.InstitutoId);
          localStorage.setItem('userRole', userData.role);

          toast({ 
            title: 'Acceso Autorizado', 
            description: `Bienvenido, rol: ${userData.role.toUpperCase()}` 
          });
          
          router.push('/dashboard?view=super-admin');
        } else {
          // Usuario existe en Auth pero no está registrado en ningún instituto
          await auth.signOut();
          localStorage.clear();
          setError('Esta cuenta no tiene un instituto asignado en EFAS.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Credenciales inválidas o error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" />
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">
            EFAS <span className="text-[#f97316]">ServiControlPro</span>
          </h2>
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
            Autenticando Protocolo...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#1e293b]/50 backdrop-blur-sm text-white rounded-[2.5rem] shadow-2xl">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center scale-90"><Logo /></div>
        <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">
          Portal <span className="text-[#f97316]">Secure</span>
        </CardTitle>
        <CardDescription className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
          Sincronización de Terminales EFAS
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={handleLogin}>
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-[10px] uppercase font-black ml-1 text-slate-500">Email Institucional</Label>
            <Input
              id="email"
              type="email"
              placeholder="nombre@instituto.com"
              required
              className="bg-slate-900 border-slate-700 focus:border-[#f97316] h-12 rounded-xl font-bold"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password" title="Contraseña" className="text-[10px] uppercase font-black ml-1 text-slate-500">Contraseña</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              className="bg-slate-900 border-slate-700 focus:border-[#f97316] h-12 rounded-xl font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-500/50 text-red-400 py-3 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-[10px] font-black uppercase tracking-tight">{error}</AlertDescription>
              </div>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[#f97316] hover:bg-white hover:text-[#f97316] text-white font-black italic uppercase text-xs h-14 rounded-2xl transition-all shadow-lg shadow-orange-500/10"
            disabled={loading}
          >
            Acceder al Sistema
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
