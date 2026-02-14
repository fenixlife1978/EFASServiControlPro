'use client';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

interface QRProps {
  activeId: string;      // ID de la Institución
  workingCondoId: string; // ID del Aula
}

export default function EnrollmentQR({ activeId, workingCondoId }: QRProps) {
  const [qrData, setQrData] = useState("");

  useEffect(() => {
    // El QR contiene los IDs necesarios para que la tablet sepa dónde inscribirse
    const data = JSON.stringify({
      action: 'enroll',
      activeId: activeId,
      workingCondoId: workingCondoId,
      timestamp: Date.now()
    });
    setQrData(data);
  }, [activeId, workingCondoId]);

  return (
    <div className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-xl border border-slate-200">
      <div className="mb-4 text-center">
          <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">EFAS ServiControlPro</h3>
          <h3 className="text-lg font-black text-slate-800 uppercase italic">Escáner de Registro</h3>
      </div>
      
      <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        {qrData && (
          <QRCodeSVG 
            value={qrData} 
            size={256}
            level={"H"}
            includeMargin={true}
          />
        )}
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Sector Activo</p>
        <p className="text-sm text-blue-600 font-mono font-bold">{workingCondoId}</p>
      </div>
      
      <p className="mt-4 text-[10px] text-slate-400 text-center max-w-[200px]">
        Apunta la cámara de la tablet a este código para iniciar el registro cronológico.
      </p>
    </div>
  );
}
