import type { SupabaseClient } from '@supabase/supabase-js'
import type { FuelingAuditAction } from '@/lib/types'

// Trace une action sur un plein (créé/modifié/approuvé/payé/annulé) dans le
// journal d'audit, avec l'utilisateur connecté comme acteur.
export async function logFuelingAudit(
  supabase: SupabaseClient,
  fuelingId: string,
  action: FuelingAuditAction,
  details = ''
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('fueling_audit_log').insert({
    fueling_id: fuelingId,
    action,
    actor: user?.id ?? null,
    details,
  })
}
