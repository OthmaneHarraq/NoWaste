// Row types matching supabase/migrations/*_nowaste_schema.sql.
// If you change a table, update the type here in the same pull request.

export type Household = {
  id: string
  name: string
  join_code: string
  created_by: string
  created_at: string
}

export type InventoryItem = {
  id: string
  household_id: string
  food_id: string | null
  name: string
  quantity: number
  added_at: string
  expires_on: string | null // 'YYYY-MM-DD'
  added_by: string | null
  updated_at: string
}

export type FridgeEvent = {
  id: string
  household_id: string
  action: 'in' | 'out'
  item_name: string
  raw_label: string | null
  quantity: number
  confidence: number | null
  source: 'camera' | 'manual'
  status: 'applied' | 'undone'
  matched: boolean
  expires_on: string | null
  replaced_by: string | null
  created_by: string | null
  created_at: string
}
