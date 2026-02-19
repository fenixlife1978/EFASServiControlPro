'use client';

import { useState } from 'react';
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
import { auth, db } from '@/firebase/config';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Building2, Lock, Mail, ArrowLeft } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutoId, setInstitutoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      if (user.email === 'vallecondo@gmail.com') {
        const idToken = await user.getIdToken();
        document.cookie = `__session=${idToken}; path=/; samesite=strict`;
        
        localStorage.setItem('userRole', 'super-admin');
        toast({ title: 'Acceso Super Admin', description: 'Cargando panel global...' });
        router.push('/dashboard?view=super-admin');
        return;
      }

      const q = query(
        collection(db, "usuarios"), 
        where("email", "==", user.email?.toLowerCase()),
        where("InstitutoId", "==", institutoId.trim())
      );
      
      const snap = await getDocs(q);

      if (!snap.empty) {
        const userData = snap.docs[0].data();
        const idToken = await user.getIdToken();
        
        document.cookie = `__session=${idToken}; path=/; samesite=strict`;

        localStorage.setItem('InstitutoId', userData.InstitutoId);
        localStorage.setItem('userRole', userData.role || userData.rol);

        toast({ 
          title: 'Acceso Autorizado', 
          description: `Sincronizado con: ${userData.InstitutoId}` 
        });
        
        router.push('/dashboard');
      } else {
        await auth.signOut();
        setError('El ID de Instituto no coincide con este usuario.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Credenciales inválidas o ID de Instituto erróneo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Ingresa tu email para enviar el enlace de recuperación.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({
        title: 'Correo Enviado',
        description: 'Se han enviado las instrucciones a tu bandeja de entrada.'
      });
      setIsResetMode(false);
    } catch (err: any) {
      console.error(err);
      setError('No se pudo enviar el correo. Verifica que el email sea correcto.');
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
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase animate-pulse">
            {isResetMode ? 'Enviando Protocolo...' : 'Verificando Credenciales...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#0f1117]/80 backdrop-blur-md text-white rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-300">
      <CardHeader className="text-center pb-2">
        <div className="mb-4 flex justify-center scale-90"><Logo /></div>
        <CardTitle className="text-3xl font-black italic tracking-tighter uppercase leading-none">
          {isResetMode ? 'Recovery' : 'Portal'} <span className="text-[#f97316]">{isResetMode ? 'Mode' : 'Secure'}</span>
        </CardTitle>
        <CardDescription className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.2em] mt-2">
          {isResetMode ? 'Protocolo de Restablecimiento' : 'Control de Acceso EFAS ServiControlPro'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form className="grid gap-4" onSubmit={isResetMode ? handleResetPassword : handleLogin}>
          <div className="grid gap-1.5 relative">
            <Mail className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
            <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">Email Institucional</Label>
            <Input
              type="email"
              placeholder="nombre@ejemplo.com"
              required
              className="bg-slate-900/50 border-slate-800 focus:border-[#f97316] h-12 rounded-xl font-bold pl-11 text-[11px]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {!isResetMode && (
            <>
              <div className="grid gap-1.5 relative">
                <Building2 className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
                <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">ID del Instituto</Label>
                <Input
                  type="text"
                  placeholder="INST-XXXXX"
                  required
                  className="bg-slate-900/50 border-slate-800 focus:border-[#f97316] h-12 rounded-xl font-bold pl-11 text-[11px] uppercase"
                  value={institutoId}
                  onChange={(e) => setInstitutoId(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5 relative">
                <Lock className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
                <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">Contraseña</Label>
                <Input 
                  type="password" 
                  required 
                  className="bg-slate-900/50 border-slate-800 focus:border-[#f97316] h-12 rounded-xl font-bold pl-11 text-[11px]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500 py-2 rounded-xl border">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-[9px] font-black uppercase tracking-tighter leading-tight">
                  {error}
                </AlertDescription>
              </div>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[#f97316] hover:bg-white hover:text-[#f97316] text-white font-black italic uppercase text-xs h-14 rounded-2xl transition-all shadow-lg shadow-orange-500/10 mt-2"
            disabled={loading}
          >
            {isResetMode ? 'Enviar Enlace de Recuperación' : 'Sincronizar Terminal'}
          </Button>

          <button
            type="button"
            onClick={() => { setIsResetMode(!isResetMode); setError(null); }}
            className="mt-2 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            {isResetMode ? (
              <><ArrowLeft size={10} /> Volver al Inicio de Sesión</>
            ) : (
              '¿Olvidaste tu contraseña?'
            )}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
