// The dashboard's data contract. Every screen reads these shapes, never raw table rows.
// Live mode builds them from the real tables in ./adapter.ts (the one file to touch
// if the schema changes); mock mode builds them in ./mockSource.ts.

export type FoodCategory = 'meat' | 'dairy' | 'produce' | 'takeout' | 'beverage' | 'condiment' | 'other'

/** Where an item sits. The four fridge spots follow the category; the freezer is the user's call. */
export type FridgeLocation = 'top_shelf' | 'middle_shelf' | 'drawer' | 'door' | 'freezer'

export type ItemStatus =
  | 'in_fridge'
  | 'pending_removal' // taken out, waiting to see if it comes back
  | 'consumed'        // used up in time: food saved
  | 'expired'         // left the fridge after its date: food wasted
  | 'thrown_away'     // someone confirmed it went in the bin: food wasted

export type FridgeItem = {
  id: string
  name: string
  category: FoodCategory
  /** Restaurant for takeout, brand for packaged goods. */
  source: string | null
  quantity: number
  location: FridgeLocation
  added_at: string          // ISO timestamp
  /** From the backend when it has one (fridge only), else estimated by ./expiration.ts. */
  expires_at: string | null // ISO timestamp
  status: ItemStatus
  /** When it entered pending_removal (and, once resolved, when it left the fridge). */
  removed_at: string | null
  image_url: string | null
  /** Live mode: the camera "out" event behind a pending item, so Put back can undo it. */
  eventId?: string
  /** thrown_away only: it went to compost, not the trash. Still wasted food, less methane. */
  composted?: boolean
}

export type ActivityKind = 'added' | 'removed' | 'returned' | 'consumed' | 'expired' | 'thrown_away'

export type ActivityEntry = {
  id: string
  kind: ActivityKind
  itemName: string
  category: FoodCategory
  source: string | null
  at: string // ISO timestamp
  via: 'camera' | 'manual' | 'system'
  quantity: number
  confidence: number | null
  /** What the AI literally said, when it differs from the name. */
  rawLabel: string | null
  undone: boolean
  /** Set when this entry can be undone / fixed. */
  eventId: string | null
}

export type FridgeSnapshot = {
  /** Current items (in_fridge, pending_removal) plus resolved history. */
  items: FridgeItem[]
  /** Newest first. */
  activity: ActivityEntry[]
}

export type ConnectionState = 'connecting' | 'live' | 'offline' | 'demo'

/** What the dashboard can ask a data source to do. Both mock and live implement it. */
export interface FridgeSource {
  subscribe(onChange: (snapshot: FridgeSnapshot) => void, onConnection: (state: ConnectionState) => void): () => void
  /** Eaten / used up in time. */
  markUsed(item: FridgeItem): Promise<string | null>
  /** Confirmed it went in the bin. */
  markThrownAway(item: FridgeItem): Promise<string | null>
  /** It went to compost, not the trash (also right after markThrownAway on the same item). */
  markComposted(item: FridgeItem): Promise<string | null>
  /** Freezer ↔ fridge. Moving to the freezer re-estimates the date from added_at;
   *  moving out starts the fridge clock from now (it's thawing). */
  moveTo(item: FridgeItem, where: 'freezer' | 'fridge'): Promise<string | null>
  /** Set the expiry by hand ('YYYY-MM-DD'), or null to go back to the estimate. */
  setExpiry(item: FridgeItem, date: string | null): Promise<string | null>
  /** A pending_removal item came back. */
  putBack(item: FridgeItem): Promise<string | null>
  addItem(name: string): Promise<string | null>
  undo(entry: ActivityEntry): Promise<string | null>
  correct(entry: ActivityEntry, name: string, action: 'in' | 'out'): Promise<string | null>
  /** Mock only: fake camera detections so the demo moves on its own. */
  setSimulatedCamera?(on: boolean): void
}
