'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/common/logo';
import { auth, db } from '@/firebase/config'; // Usamos db (Firestore)
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore'; // Importaciones necesarias
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, Building2, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { dbService } from '@/lib/dbService';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutoId, setInstitutoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<'cloud' | 'local' | 'hybrid'>('cloud');
  const [modeLoaded, setModeLoaded] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const { mode } = dbService.getSettings();
    setCurrentMode(mode);
    setModeLoaded(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanInstId = institutoId.trim().toUpperCase();
    const { mode, url } = dbService.getSettings();
    
    if (mode === 'hybrid' && !url) {
      dbService.saveSettings('cloud');
      setCurrentMode('cloud');
      setError('Configuración inválida. Reintenta.');
      setLoading(false);
      return;
    }

    try {
      // 1. Autenticación en Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      
      // 2. Caso Super-Admin Root
      if (user.email === 'vallecondo@gmail.com') {
        const idToken = await user.getIdToken(true);
        document.cookie = "__session=" + idToken + "; path=/; samesite=lax; max-age=3600; secure";
        localStorage.setItem('userRole', 'super-admin');
      } 
      // 3. Usuarios de Institución (Búsqueda por EMAIL en Firestore)
      else {
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("email", "==", cleanEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          console.error("Email no hallado en la colección usuarios:", cleanEmail);
          await auth.signOut();
          setError('Usuario no registrado en el sistema.');
          setLoading(false);
          return;
        }

        const userData = querySnapshot.docs[0].data();

        // Validación de ID de Sede
        if (userData.InstitutoId?.trim().toUpperCase() !== cleanInstId) {
          await auth.signOut();
          setError(`ID de Instituto incorrecto para este usuario.`);
          setLoading(false);
          return;
        }
        
        const idToken = await user.getIdToken(true);
        document.cookie = "__session=" + idToken + "; path=/; samesite=lax; max-age=3600; secure";
        
        localStorage.setItem('InstitutoId', userData.InstitutoId);
        localStorage.setItem('userRole', userData.role || 'profesor');
      }

      toast({ 
        title: 'Sincronización Exitosa', 
        description: 'Bienvenido a EFAS ServiControlPro.' 
      });
      
      setTimeout(() => { window.location.replace('/dashboard'); }, 500);

    } catch (err: any) {
      console.error("Login Error:", err);
      setError(
        err.code === 'auth/invalid-credential' 
          ? 'Email o contraseña incorrectos.' 
          : 'Error de conexión con el servidor.'
      );
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
    } catch (err: any) { 
      setError('Error al enviar correo de recuperación.'); 
    } finally { 
      setResetLoading(false); 
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-6 p-12 bg-[#0a0c10] rounded-[3rem] border border-orange-500/10 min-h-[400px]">
      <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
      <div className="text-center">
        <p className="text-[10px] font-black uppercase text-white tracking-[0.4em] italic">Autenticando</p>
        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">EFAS ServiControlPro Protocol</p>
      </div>
    </div>
  );

  return (
    <Card className="mx-auto w-full max-w-sm border-white/5 bg-[#0a0c10]/90 backdrop-blur-xl text-white rounded-[3rem] shadow-2xl overflow-hidden">
      <CardHeader className="text-center pb-2 pt-10">
        <div className="mb-6 flex justify-center scale-110 drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]">
          <Logo />
        </div>
        <CardTitle className="text-4xl font-black italic tracking-tighter uppercase leading-none">
          {resetMode ? 'SHIELD' : 'SISTEMA'} <span className="text-orange-500">{resetMode ? 'RECOVERY' : 'CONTROL'}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-8 pb-10 px-8">
        {!resetMode ? (
          <form className="grid gap-5" onSubmit={handleLogin}>
            <div className="grid gap-2 relative">
              <Label className="text-[9px] uppercase font-black ml-4 text-slate-500 italic">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-4 w-4" />
                <Input type="email" required className="bg-white/5 border-white/5 h-14 rounded-2xl pl-12 text-xs" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2 relative">
              <Label className="text-[9px] uppercase font-black ml-4 text-slate-500 italic">Sede ID</Label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-4 w-4" />
                <Input type="text" required className="bg-white/5 border-white/5 h-14 rounded-2xl pl-12 text-xs" placeholder="ID INSTITUTO" value={institutoId} onChange={(e) => setInstitutoId(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2 relative">
              <div className="flex items-center justify-between px-1">
                <Label className="text-[9px] uppercase font-black ml-3 text-slate-500 italic">Password</Label>
                <button type="button" onClick={() => setResetMode(true)} className="text-[9px] uppercase font-black text-orange-500 italic hover:underline">Recuperar</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-4 w-4" />
                <Input type="password" required className="bg-white/5 border-white/5 h-14 rounded-2xl pl-12 text-xs" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            {error && <Alert variant="destructive" className="bg-red-500/5 text-red-500 py-3 border-red-500/10 rounded-2xl"><AlertDescription className="text-[9px] font-black uppercase text-center italic">{error}</AlertDescription></Alert>}
            
            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black italic uppercase text-xs h-16 rounded-[1.5rem] mt-2 shadow-xl shadow-orange-900/20 active:scale-95 transition-all">
              Sincronizar Acceso
            </Button>
          </form>
        ) : (
          <form className="grid gap-5" onSubmit={handleResetPassword}>
            <div className="grid gap-2 relative">
              <Label className="text-[9px] uppercase font-black ml-4 text-slate-500 italic">Email de Recuperación</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-4 w-4" />
                <Input type="email" required className="bg-white/5 border-white/5 h-14 rounded-2xl pl-12 text-xs" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            {error && <Alert variant="destructive" className="bg-red-500/10 text-red-500 py-3 border-red-500/20 rounded-2xl"><AlertDescription className="text-[9px] font-black uppercase text-center">{error}</AlertDescription></Alert>}
            <Button type="submit" disabled={resetLoading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black italic uppercase text-xs h-16 rounded-[1.5rem] shadow-lg shadow-orange-900/20">Enviar Enlace</Button>
            <button type="button" onClick={() => setResetMode(false)} className="flex items-center justify-center gap-2 text-[9px] uppercase font-black text-slate-500 italic hover:text-white transition-colors"><ArrowLeft size={12} /> Volver al Login</button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
