import { ScanForm } from '@/components/scanner/ScanForm'

export default function ScannerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Scanner un planning</h1>
      <p className="text-sm text-gray-500">
        Photographiez la feuille de planning. Le système lit le tableau automatiquement, puis vous validez et corrigez avant l&apos;enregistrement.
      </p>
      <ScanForm />
    </div>
  )
}
