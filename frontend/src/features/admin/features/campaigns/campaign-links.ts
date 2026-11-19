import { asRows } from '@shared/utils'
import { staff } from '../../session'

export type CampaignLink = { id: string; name: string; slug: string; source: string; active: boolean; opens: number }

export const campaignLinksQuery = {
  queryKey: ['admin-campaign-links'],
  queryFn: async (): Promise<CampaignLink[]> => asRows(await staff.api('admin/campaign-links')).flatMap((row) => {
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.slug !== 'string' || typeof row.source !== 'string') return []
    return [{ id: row.id, name: row.name, slug: row.slug, source: row.source, active: Boolean(row.active), opens: typeof row.opens === 'number' ? row.opens : 0 }]
  }),
}
