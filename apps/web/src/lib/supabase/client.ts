'use client'

import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://trwraypolgqhkrxlijql.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyd3JheXBvbGdxaGtyeGxpanFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDYyNjQsImV4cCI6MjEwNjUyMjI2NH0.PyOJX0issEMtgs80pWdcsFIzb-MaGwgdLoPEJYkRWBw'

export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
