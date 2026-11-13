// Auth types
export interface LoginCredentials {
  username: string
  password: string
}

export interface Session {
  accessToken: string
  refreshToken?: string
  totpRequired?: boolean
  totpToken?: string
}

export interface User {
  id: string
  phone: string
  displayName?: string
  status: 'active' | 'suspended' | 'deleted'
}

// Admin types
export interface DashboardStats {
  users: number
  newUsers: number
  revenueToman: number
  paidOrders: number
  unreadMessages: number
  aiToday: number
}

export interface Payment {
  id: string
  userId: string
  user: User
  packageCode: string
  amountToman: number
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  createdAt: string
}

// Onboarding types
export interface WizardStep {
  stage: string
  index: number
  data?: Record<string, any>
}

// Specialist types
export interface Specialist {
  id: string
  phone: string
  displayName: string
  firstName?: string
  lastName?: string
  education?: string
  councilNo?: string
  capacity: number
  subordinateCount?: number
}
