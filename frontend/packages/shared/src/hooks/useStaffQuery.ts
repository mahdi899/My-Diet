import { useQuery } from '@tanstack/react-query'
import type { StaffSession } from '../api/staff-session'

export function useStaffQuery<T>(session: StaffSession, key: unknown[], path: string | null) {
  return useQuery({
    queryKey: key,
    queryFn: () => session.api<T>(path ?? ''),
    enabled: session.active && !!path,
  })
}
