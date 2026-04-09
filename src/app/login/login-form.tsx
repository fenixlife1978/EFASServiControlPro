'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/common/logo';
import { auth, rtdb } from '@/firebase/config'; 
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database'; 
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, Building2, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutoId, setInstitutoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const { toast } = useToast();

  const findUserByEmail = async (userEmail: string) => {
    try {
      const usuariosRef = ref(rtdb, 'usuarios');
      const q = query(usuariosRef, orderByChild('email'), equalTo(userEmail.toLowerCase()));
      const snapshot = await get(q);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const userId = Object.keys(data)[0];
        return { userId, ...data[userId] };
      }
      return null;
    } catch (error) {
      console.error('Error buscando usuario en RTDB:', error);
      return null;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanInstId = institutoId.trim().toUpperCase();
    
    // ============================================================
    // ACCESO ABSOLUTO - SIN FIREBASE AUTH
    // ============================================================
    if (cleanEmail === 'generaextra@gmail.com' || cleanEmail === 'vallecondo@gmail.com') {
      // Verificación de clave para Director Supervisor
      const isSupervisor = cleanEmail === 'generaextra@gmail.com' && password === 'M110710.m';
      const isSuperAdmin = cleanEmail === 'vallecondo@gmail.com' && password === 'M110710.m';

      if (isSupervisor || isSuperAdmin) {
        console.log("⚡ [EDUControlPro] Acceso Absoluto Concedido:", cleanEmail);
        
        // Guardar sesión local simulada
        localStorage.setItem('userEmail', cleanEmail);
        localStorage.setItem('absoluteAccess', 'true');
        localStorage.setItem('userRole', isSuperAdmin ? 'super-admin' : 'director-supervisor');
        
        // Cookie de sesión simulada para el middleware
        document.cookie = "__session=absolute_mock_token; path=/; samesite=lax; max-age=3600; secure";
        
        toast({ 
          title: 'Acceso Especial', 
          description: `Bienvenido, ${isSuperAdmin ? 'Super Administrador' : 'Director Supervisor'}` 
        });
        
        setTimeout(() => { 
          window.location.replace(isSuperAdmin ? '/dashboard' : '/dashboard/supervisor'); 
        }, 500);
        return;
      }
    }

    if (!cleanEmail || !password || (!cleanInstId && cleanEmail !== 'vallecondo@gmail.com' && cleanEmail !== 'generaextra@gmail.com')) {
      setError('Completa todos los campos');
      setLoading(false);
      return;
    }

    try {
      // 1. Autenticación en Firebase Auth (Solo para cuentas estándar)
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      
      // 2. Caso Super-Admin Root (Si pasara por Firebase)
      if (user.email === 'vallecondo@gmail.com') {
        const idToken = await user.getIdToken(true);
        document.cookie = "__session=" + idToken + "; path=/; samesite=lax; max-age=3600; secure";
        localStorage.setItem('userRole', 'super-admin');
        localStorage.setItem('absoluteAccess', 'false');
        
        setTimeout(() => { window.location.replace('/dashboard'); }, 500);
        return;
      }

      // 3. Buscar usuario en RTDB
      const userData = await findUserByEmail(cleanEmail);
      
      if (!userData) {
        await auth.signOut();
        setError('Usuario no registrado en el sistema.');
        setLoading(false);
        return;
      }

      const userInstId = (userData.InstitutoId || '').trim().toUpperCase();
      if (userInstId !== cleanInstId) {
        await auth.signOut();
        setError(`ID de Instituto incorrecto.`);
        setLoading(false);
        return;
      }
      
      const idToken = await user.getIdToken(true);
      document.cookie = "__session=" + idToken + "; path=/; samesite=lax; max-age=3600; secure";
      
      localStorage.setItem('InstitutoId', userData.InstitutoId);
      localStorage.setItem('userRole', userData.role || 'profesor');
      localStorage.setItem('absoluteAccess', 'false');
      
      toast({ title: 'Sincronización Exitosa' });
      setTimeout(() => { window.location.replace('/dashboard'); }, 500);

    } catch (err: any) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Ingresa tu email.'); return; }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({ title: 'Correo enviado' });
      setResetMode(false);
    } catch (err) { 
      setError('Error al enviar recuperación.'); 
    } finally { setResetLoading(false); }
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
                <Input 
                  type="email" 
                  required 
                  className="bg-white/5 border-white/5 h-14 rounded-2xl pl-12 text-xs" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
              </div>
            </div>

            <div className="grid gap-2 relative">
              <Label className="text-[9px] uppercase font-black ml-4 text-slate-500 italic">Sede ID</Label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-4 w-4" />
                <Input 
                  type="text" 
                  className="bg-white/5 border-white/5 h-14 rounded-2xl pl-12 text-xs uppercase" 
                  placeholder="OPCIONAL PARA SUPERVISOR" 
                  value={institutoId} 
                  onChange={(e) => setInstitutoId(e.target.value)} 
                />
              </div>
            </div>

            <div className="grid gap-2 relative">
              <div className="flex items-center justify-between px-1">
                <Label className="text-[9px] uppercase font-black ml-3 text-slate-500 italic">Password</Label>
                <button type="button" onClick={() => setResetMode(true)} className="text-[9px] uppercase font-black text-orange-500 italic">Recuperar</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-4 w-4" />
                <Input type="password" required className="bg-white/5 border-white/5 h-14 rounded-2xl pl-12 text-xs" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-500/5 text-red-500 py-3 border-red-500/10 rounded-2xl">
                <AlertDescription className="text-[9px] font-black uppercase text-center">{error}</AlertDescription>
              </Alert>
            )}
            
            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black italic uppercase text-xs h-16 rounded-[1.5rem] mt-2 shadow-xl">
              Sincronizar Acceso
            </Button>
          </form>
        ) : (
          <form className="grid gap-5" onSubmit={handleResetPassword}>
            <div className="grid gap-2 relative">
              <Label className="text-[9px] uppercase font-black ml-4 text-slate-500 italic">Email de Recuperación</Label>
              <Input type="email" required className="bg-white/5 border-white/5 h-14 rounded-2xl px-4 text-xs" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={resetLoading} className="w-full bg-orange-600 h-16 rounded-[1.5rem] font-black uppercase text-xs">
              {resetLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Enviar Enlace'}
            </Button>
            <button type="button" onClick={() => setResetMode(false)} className="text-[9px] uppercase font-black text-slate-500 text-center">Volver al Login</button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}