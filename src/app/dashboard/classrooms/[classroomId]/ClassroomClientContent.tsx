'use client';
import React from 'react';

export default function ClassroomClientContent({ classroomId }: { classroomId: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-black italic uppercase text-slate-800">Aula: {classroomId}</h1>
      <p className="text-orange-500 font-bold uppercase tracking-widest text-xs">EFAS ServControlPro</p>
    </div>
  );
}
