import { createBoundSession } from '@shared/api/bind-session'

export const doctorAuth = createBoundSession('specialist')
export const staff = doctorAuth.session
