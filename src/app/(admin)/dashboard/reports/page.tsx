import { ReportCharts } from "@/components/admin/report-charts";

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Monitor de Reportes</h2>
          <p className="text-slate-500 text-sm">Visualiza el uso de dispositivos y las infracciones.</p>
        </div>
      </header>
      <ReportCharts />
    </div>
  );
}
