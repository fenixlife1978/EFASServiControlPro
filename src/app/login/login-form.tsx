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
import { AlertCircle, Loader2, Building2, Lock, Mail, QrCode } from 'lucide-react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutoId, setInstitutoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  const { toast } = useToast();

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, ingresa tu email para enviarte el enlace de recuperación.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({
        title: 'Correo enviado',
        description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
      });
      setError(null);
    } catch (err: any) {
      setError('Error al enviar el correo. Verifica que el email sea válido.');
    } finally {
      setResetLoading(false);
    }
  };

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

      toast({ title: 'Sincronizado', description: 'Accediendo a EDUControlPro...' });

      // 4. EL TRUCO FINAL: Un pequeño delay y navegación nativa para asegurar que el Middleware lea la cookie
      setTimeout(() => {
        window.location.replace('/dashboard');
      }, 500);

    } catch (err: any) {
      setError('Credenciales inválidas.');
      setLoading(false);
    }
  };

  // Función para manejar el escaneo de vinculación
  const startScan = async () => {
    try {
      const granted = await BarcodeScanner.requestPermissions();
      if (granted.camera !== 'granted') {
        toast({ title: "Acceso denegado", description: "Se requiere permiso de cámara." });
        return;
      }
      // Esta función disparará la visibilidad en LoginPage
      const event = new CustomEvent('start-qr-scan');
      window.dispatchEvent(event);
    } catch (err) {
      console.error(err);
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
          ACCESO <span className="text-[#f97316]">CONTROL PRO</span>
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
            <div className="flex items-center justify-between">
              <Label className="text-[9px] uppercase font-black ml-1 text-slate-500 italic">Password</Label>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="text-[9px] uppercase font-black text-[#f97316] hover:text-white italic transition-colors disabled:opacity-50"
              >
                {resetLoading ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
              </button>
            </div>
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

          <Button type="submit" className="w-full bg-[#f97316] hover:bg-white hover:text-[#f97316] text-white font-black italic uppercase text-xs h-14 rounded-2xl shadow-lg mt-2 transition-all">
            Sincronizar
          </Button>

          {/* SECCIÓN DE VINCULACIÓN QR */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-800" /></div>
            <div className="relative flex justify-center text-[8px] uppercase font-black italic"><span className="bg-[#0f1117] px-2 text-slate-600">O vincula hardware</span></div>
          </div>

          <button 
            type="button"
            onClick={startScan}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-slate-800 bg-slate-900/30 hover:bg-slate-800 text-slate-400 hover:text-white transition-all text-[9px] font-black uppercase italic"
          >
            <QrCode size={16} />
            Vinculación EDUControlPro
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
