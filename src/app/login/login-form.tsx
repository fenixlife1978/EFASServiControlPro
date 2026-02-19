'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/common/logo';
import { auth, db } from '@/firebase/config';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Building2, Lock, Mail } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutoId, setInstitutoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Autenticar
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const idToken = await user.getIdToken(true);

      // 2. Establecer Cookie con persistencia forzada
      document.cookie = `__session=${idToken}; path=/; samesite=lax; max-age=3600; secure`;

      // 3. Verificar Instituto (Excepto Super Admin)
      if (user.email !== 'vallecondo@gmail.com') {
        const q = query(
          collection(db, "usuarios"), 
          where("email", "==", user.email?.toLowerCase()),
          where("InstitutoId", "==", institutoId.trim())
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          await auth.signOut();
          document.cookie = "__session=; Path=/; Max-Age=0";
          setError('El ID de Instituto no coincide.');
          setLoading(false);
          return;
        }
        
        const userData = snap.docs[0].data();
        localStorage.setItem('InstitutoId', userData.InstitutoId);
        localStorage.setItem('userRole', userData.role);
      } else {
        localStorage.setItem('userRole', 'super-admin');
      }

      toast({ title: 'Sincronizado', description: 'Entrando al sistema...' });

      // 4. EL TRUCO FINAL: Un pequeño delay y navegación nativa para asegurar que el Middleware lea la cookie
      setTimeout(() => {
        window.location.replace('/dashboard');
      }, 500);

    } catch (err: any) {
      setError('Credenciales inválidas.');
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 bg-[#0f1117] rounded-[2.5rem] border border-slate-800 shadow-2xl">
      <Loader2 className="h-10 w-10 animate-spin text-[#f97316]" />
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Estableciendo Conexión...</p>
    </div>
  );

  return (
    <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#0f1117]/80 backdrop-blur-md text-white rounded-[2.5rem] shadow-2xl overflow-hidden">
      <CardHeader className="text-center pb-2">
        <div className="mb-4 flex justify-center scale-90"><Logo /></div>
        <CardTitle className="text-3xl font-black italic tracking-tighter uppercase leading-none">
          Portal <span className="text-[#f97316]">Secure</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form className="grid gap-4" onSubmit={handleLogin}>
          <div className="grid gap-1.5 relative">
            <Mail className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
            <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">Email</Label>
            <Input
              type="email"
              placeholder="nombre@ejemplo.com"
              required
              className="bg-slate-900/50 border-slate-800 focus:border-[#f97316] h-12 rounded-xl font-bold pl-11 text-[11px]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5 relative">
            <Building2 className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
            <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">ID Instituto</Label>
            <Input
              type="text"
              placeholder="INST-XXXXX"
              className="bg-slate-900/50 border-slate-800 focus:border-[#f97316] h-12 rounded-xl font-bold pl-11 text-[11px]"
              value={institutoId}
              onChange={(e) => setInstitutoId(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5 relative">
            <Lock className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
            <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">Password</Label>
            <Input 
              type="password" 
              required 
              className="bg-slate-900/50 border-slate-800 focus:border-[#f97316] h-12 rounded-xl font-bold pl-11 text-[11px]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500 py-2 rounded-xl border">
              <AlertDescription className="text-[9px] font-black uppercase">{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full bg-[#f97316] hover:bg-white hover:text-[#f97316] text-white font-black italic uppercase text-xs h-14 rounded-2xl shadow-lg mt-2">
            Sincronizar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
