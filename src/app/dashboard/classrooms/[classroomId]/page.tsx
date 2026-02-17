import React from 'react';
import ClassroomClientContent from './ClassroomClientContent';

export const dynamic = 'force-static';
export const dynamicParams = false;

// El nombre de la clave debe ser idéntico al nombre de la carpeta [classroomId]
export async function generateStaticParams() {
  return [
    { classroomId: 'default' }
  ];
}

type PageProps = {
  params: Promise<{ classroomId: string }>;
};

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  
  return (
    <ClassroomClientContent classroomId={resolvedParams.classroomId} />
  );
}
