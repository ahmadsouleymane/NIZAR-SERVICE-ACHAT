import { CameraIcon } from '@/components/ui/icons'
import { ScanForm } from '@/components/scanner/ScanForm'

export default function ScannerPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <CameraIcon size={24} className="text-blue-600" />
          Scanner un planning
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Le système lit le tableau automatiquement, puis vous validez et corrigez avant l&apos;enregistrement.
        </p>
      </div>
      <ScanForm />
    </div>
  )
}
