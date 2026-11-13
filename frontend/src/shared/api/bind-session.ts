import { createStaffSession, type StaffRole } from '@shared/api/staff-session'

export function createBoundSession(role: StaffRole) {
  let onExpired = () => {}
  const session = createStaffSession(role, () => onExpired())
  return {
    session,
    bindExpiry(handler: () => void) {
      onExpired = handler
    },
  }
}
