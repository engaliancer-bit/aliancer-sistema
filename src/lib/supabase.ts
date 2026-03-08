import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});

export interface Product {
  id: string;
  name: string;
  description: string;
  unit: string;
  recipe_id?: string;
  total_weight?: number;
  sale_price?: number;
  margin_percentage?: number;
  last_price_update?: string;
  has_flange?: boolean;
  flange_length_meters?: number;
  flange_volume_m3?: number;
  created_at: string;
}

export interface Production {
  id: string;
  product_id: string;
  quantity: number;
  production_date: string;
  notes: string;
  created_at: string;
}

export interface InventoryItem {
  product_id: string;
  product_name: string;
  unit: string;
  total_quantity: number;
}

export interface ProductTracking {
  id: string;
  qr_token: string;
  production_id?: string;
  production_order_id?: string;
  product_id: string;
  recipe_name: string;
  quantity: number;
  production_date: string;
  expedition_date?: string;
  assembly_date?: string;
  additional_notes?: string;
  created_at: string;
  updated_at: string;
  products?: Product;
}
