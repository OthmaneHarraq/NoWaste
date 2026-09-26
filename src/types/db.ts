// Row types matching supabase/migrations/*_nowaste_schema.sql.
// If you change a table, update the type here in the same pull request.

export type DbLocation = 'top_shelf' | 'middle_shelf' | 'drawer' | 'door' | 'freezer'

/** What happened to something that left. 'composted' = binned, but in the compost. */
export type Disposition = 'consumed' | 'thrown_away' | 'composted'

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
  /** null = the usual spot for its category. */
  location: DbLocation | null
  /** Last time it came out of the freezer. */
  thawed_at: string | null
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
  /** 'in': where it went; 'out': where it came from. */
  location: DbLocation | null
  /** 'out' only: what someone said happened to it. */
  disposition: Disposition | null
  replaced_by: string | null
  created_by: string | null
  created_at: string
}
