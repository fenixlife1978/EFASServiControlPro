'use client';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

interface QRProps {
  InstitutoId: string;
  aulaId: string;
}

export default function EnrollmentQR({ InstitutoId, aulaId }: QRProps) {
  const [qrData, setQrData] = useState("");

  useEffect(() => {
    const data = JSON.stringify({
      action: 'enroll',
      InstitutoId: InstitutoId,
      aulaId: aulaId,
      timestamp: Date.now()
    });
    setQrData(data);
  }, [InstitutoId, aulaId]);

  return (
    <div className="flex flex-col items-center p-8 bg-white rounded-[3rem] shadow-2xl border border-slate-100">
      <div className="mb-6 text-center">
          <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] italic">EDU ServControlPro</h3>
          <h3 className="text-xl font-black text-slate-900 uppercase italic">Vincular Terminal</h3>
      </div>
      
      <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
        {qrData && (
          <QRCodeSVG 
            value={qrData} 
            size={220}
            level={"H"}
            includeMargin={true}
          />
        )}
      </div>

      <div className="mt-8 text-center space-y-1">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aula Seleccionada</p>
        <p className="text-xs text-slate-900 font-mono font-bold bg-slate-100 px-4 py-1 rounded-full">{aulaId}</p>
      </div>
      
      <p className="mt-6 text-[10px] text-slate-400 text-center max-w-[220px] font-medium leading-relaxed">
        Escanea este código con la tablet para conectarla automáticamente al sistema de control.
      </p>
    </div>
  );
}
