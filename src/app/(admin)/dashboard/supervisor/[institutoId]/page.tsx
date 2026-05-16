import SedeMonitorClient from './SedeMonitorClient';

// Generar rutas estáticas para el export
export async function generateStaticParams() {
  // Si no hay institutos predefinidos, devolver array vacío
  // En build estático, esto genera las rutas
  return [];
}

export default function Page({ params }: { params: { institutoId: string } }) {
  return <SedeMonitorClient institutoId={params.institutoId} />;
}
