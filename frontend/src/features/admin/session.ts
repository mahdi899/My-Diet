import { createBoundSession } from '@shared/api/bind-session'

export const adminAuth = createBoundSession('admin')
export const staff = adminAuth.session
