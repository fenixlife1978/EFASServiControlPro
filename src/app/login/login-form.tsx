'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/common/logo';
import { auth, db } from '@/firebase/config';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, Building2, Loader2, ArrowLeft } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutoId, setInstitutoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanInstId = institutoId.trim();

    try {
      // 1. Intentar Login en Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      
      // 2. Si es el Super Admin, entra sin más validaciones
      if (user.email === 'vallecondo@gmail.com') {
        const idToken = await user.getIdToken(true);
        document.cookie = "__session=" + idToken + "; path=/; samesite=lax; max-age=3600; secure";
        localStorage.setItem('userRole', 'super-admin');
      } else {
        // 3. Para Profesores/Otros: Buscar en la colección raíz "usuarios"
        const q = query(
          collection(db, "usuarios"), 
          where("email", "==", cleanEmail)
        );
        
        const snap = await getDocs(q);

        if (snap.empty) {
          await auth.signOut();
          setError('Usuario no registrado en la base de datos.');
          setLoading(false);
          return;
        }

        const userData = snap.docs[0].data();

        // VALIDACIÓN CRUCIAL: Comparar el InstitutoId (Exacto como en Firestore)
        if (userData.InstitutoId !== cleanInstId) {
          await auth.signOut();
          setError('El ID de Instituto no es correcto para este usuario.');
          setLoading(false);
          return;
        }
        
        // Guardar sesión y roles
        const idToken = await user.getIdToken(true);
        document.cookie = "__session=" + idToken + "; path=/; samesite=lax; max-age=3600; secure";
        
        localStorage.setItem('InstitutoId', userData.InstitutoId);
        localStorage.setItem('userRole', userData.role || 'profesor');
      }

      toast({ title: 'Sincronizado', description: 'Accediendo a EDUControlPro...' });
      setTimeout(() => { window.location.replace('/dashboard'); }, 500);

    } catch (err: any) {
      console.error("Login Error:", err);
      // Manejar errores específicos de Auth
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email o contraseña incorrectos.');
      } else {
        setError('Error de conexión con el servidor.');
      }
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Ingresa tu email.'); return; }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      toast({ title: 'Correo enviado', description: 'Revisa tu bandeja de entrada.' });
      setResetMode(false);
    } catch (err: any) { setError('Error al enviar correo.'); }
    finally { setResetLoading(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 bg-[#0f1117] rounded-[2.5rem] border border-slate-800 shadow-2xl">
      <Loader2 className="h-10 w-10 animate-spin text-[#f97316]" />
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Verificando Credenciales...</p>
    </div>
  );

  return (
    <Card className="mx-auto w-full max-w-sm border-slate-800 bg-[#0f1117]/80 backdrop-blur-md text-white rounded-[2.5rem] shadow-2xl overflow-hidden">
      <CardHeader className="text-center pb-2">
        <div className="mb-4 flex justify-center scale-90"><Logo /></div>
        <CardTitle className="text-3xl font-black italic tracking-tighter uppercase leading-none">
          {resetMode ? 'RECUPERAR' : 'ACCESO'} <span className="text-[#f97316]">{resetMode ? 'CONTROL PRO' : 'SISTEMA'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {resetMode ? (
          <form className="grid gap-4" onSubmit={handleResetPassword}>
            <div className="grid gap-1.5 relative">
              <Mail className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
              <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">Email de recuperación</Label>
              <Input type="email" required className="bg-slate-900/50 border-slate-800 h-12 rounded-xl pl-11 text-[11px]" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <Alert variant="destructive" className="bg-red-500/10 text-red-500 py-2 border-red-500/20"><AlertDescription className="text-[9px] font-black uppercase">{error}</AlertDescription></Alert>}
            <Button type="submit" disabled={resetLoading} className="w-full bg-[#f97316] text-white font-black italic uppercase text-xs h-14 rounded-2xl">Enviar enlace</Button>
            <button type="button" onClick={() => setResetMode(false)} className="flex items-center justify-center gap-2 text-[9px] uppercase font-black text-slate-500 italic"><ArrowLeft size={12} /> Volver</button>
          </form>
        ) : (
          <form className="grid gap-4" onSubmit={handleLogin}>
            <div className="grid gap-1.5 relative">
              <Mail className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
              <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">Email</Label>
              <Input type="email" required className="bg-slate-900/50 border-slate-800 h-12 rounded-xl pl-11 text-[11px]" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5 relative">
              <Building2 className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
              <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">ID Instituto (Ej: InstitutoId)</Label>
              <Input type="text" required className="bg-slate-900/50 border-slate-800 h-12 rounded-xl pl-11 text-[11px]" value={institutoId} onChange={(e) => setInstitutoId(e.target.value)} />
            </div>
            <div className="grid gap-1.5 relative">
              <Lock className="absolute left-4 top-10 text-slate-500 h-4 w-4" />
              <div className="flex items-center justify-between">
                <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">Password</Label>
                <button type="button" onClick={() => setResetMode(true)} className="text-[9px] uppercase font-black text-[#f97316] italic">¿Olvidaste tu contraseña?</button>
              </div>
              <Input type="password" required className="bg-slate-900/50 border-slate-800 h-12 rounded-xl pl-11 text-[11px]" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <Alert variant="destructive" className="bg-red-500/10 text-red-500 py-2 border-red-500/20"><AlertDescription className="text-[9px] font-black uppercase">{error}</AlertDescription></Alert>}
            <Button type="submit" className="w-full bg-[#f97316] text-white font-black italic uppercase text-xs h-14 rounded-2xl mt-2">Sincronizar</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
