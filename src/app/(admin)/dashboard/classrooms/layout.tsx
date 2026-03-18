'use client';
import React, { createContext, useContext, useState } from 'react';

// Creamos el contexto para el aula
const ClassroomContext = createContext<any>(null);

const useClassroom = () => useContext(ClassroomContext);

export default function ClassroomsLayout({ children }: { children: React.ReactNode }) {
  const [selectedClassroom, setSelectedClassroom] = useState(null);

  return (
    <ClassroomContext.Provider value={{ selectedClassroom, setSelectedClassroom }}>
      <div className="relative min-h-screen">
        {children}
      </div>
    </ClassroomContext.Provider>
  );
}
