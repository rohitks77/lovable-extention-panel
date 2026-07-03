import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

// Use service role key for full admin access in this panel
export const supabase = createClient(supabaseUrl, supabaseServiceKey)

export type Plan = 'hourly' | 'daily' | 'monthly' | 'yearly' | 'lifetime'
export type Status = 'active' | 'inactive' | 'expired'

export interface License {
  id: string
  key: string
  domain: string
  plan: Plan
  status: Status
  customer_name: string
  customer_email: string
  notes: string
  expires_at: string | null
  activated_at: string | null
  created_at: string
  updated_at: string
}

// Generate a secure MeroTools license key
export function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `MT-${seg(4)}-${seg(4)}-${seg(4)}-${seg(4)}`
}

// Calculate expiry date from plan
export function calcExpiry(plan: Plan): Date | null {
  if (plan === 'lifetime') return null
  const now = new Date()
  switch (plan) {
    case 'hourly': return new Date(now.getTime() + 1 * 60 * 60 * 1000)
    case 'daily':  return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case 'monthly':
      now.setMonth(now.getMonth() + 1)
      return now
    case 'yearly':
      now.setFullYear(now.getFullYear() + 1)
      return now
    default: return null
  }
}
