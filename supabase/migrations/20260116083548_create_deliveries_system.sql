/*
  # Create Deliveries System

  1. New Tables
    - `deliveries`
      - `id` (uuid, primary key)
      - `delivery_date` (timestamptz) - Data da entrega
      - `quote_id` (uuid, nullable) - Referência ao orçamento padrão
      - `ribbed_slab_quote_id` (uuid, nullable) - Referência ao orçamento de laje
      - `status` (text) - Status: 'open' (em aberto), 'closed' (finalizada)
      - `vehicle_info` (text, nullable) - Informações do veículo
      - `driver_name` (text, nullable) - Nome do motorista
      - `notes` (text, nullable) - Observações
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `delivery_items`
      - `id` (uuid, primary key)
      - `delivery_id` (uuid) - Referência à entrega
      - `product_id` (uuid, nullable) - Referência ao produto
      - `quote_item_id` (uuid, nullable) - Referência ao item do orçamento
      - `ribbed_slab_room_id` (uuid, nullable) - Referência ao cômodo do orçamento de laje
      - `quantity` (decimal) - Quantidade entregue
      - `is_additional` (boolean) - Se é um item adicional (não estava no orçamento)
      - `unit_price` (decimal, nullable) - Preço unitário (para itens adicionais)
      - `notes` (text, nullable) - Observações
      - `scanned_at` (timestamptz, nullable) - Quando foi escaneado o QR code
      - `created_at` (timestamptz)

  2. Updates to Existing Tables
    - Add `delivered_quantity` to `quote_items`
    - Add `delivered_joists` to `ribbed_slab_rooms` (vigotas entregues)

  3. Security
    - Enable RLS on all tables
    - Add policies for public access (anonymous users)
*/

-- Create deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date timestamptz DEFAULT now(),
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  ribbed_slab_quote_id uuid REFERENCES ribbed_slab_quotes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  vehicle_info text,
  driver_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create delivery_items table
CREATE TABLE IF NOT EXISTS delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  quote_item_id uuid REFERENCES quote_items(id) ON DELETE SET NULL,
  ribbed_slab_room_id uuid REFERENCES ribbed_slab_rooms(id) ON DELETE SET NULL,
  quantity decimal(10, 2) NOT NULL DEFAULT 0,
  is_additional boolean DEFAULT false,
  unit_price decimal(10, 2),
  notes text,
  scanned_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add delivered_quantity to quote_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_items' AND column_name = 'delivered_quantity'
  ) THEN
    ALTER TABLE quote_items ADD COLUMN delivered_quantity decimal(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add delivered_joists to ribbed_slab_rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_rooms' AND column_name = 'delivered_joists'
  ) THEN
    ALTER TABLE ribbed_slab_rooms ADD COLUMN delivered_joists integer DEFAULT 0;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;

-- Create policies for deliveries (public access)
CREATE POLICY "Allow public to view deliveries"
  ON deliveries FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public to insert deliveries"
  ON deliveries FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public to update deliveries"
  ON deliveries FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public to delete deliveries"
  ON deliveries FOR DELETE
  TO public
  USING (true);

-- Create policies for delivery_items (public access)
CREATE POLICY "Allow public to view delivery_items"
  ON delivery_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public to insert delivery_items"
  ON delivery_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public to update delivery_items"
  ON delivery_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public to delete delivery_items"
  ON delivery_items FOR DELETE
  TO public
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deliveries_quote_id ON deliveries(quote_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_ribbed_slab_quote_id ON deliveries(ribbed_slab_quote_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_product_id ON delivery_items(product_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_quote_item_id ON delivery_items(quote_item_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_ribbed_slab_room_id ON delivery_items(ribbed_slab_room_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for deliveries
DROP TRIGGER IF EXISTS update_deliveries_updated_at_trigger ON deliveries;
CREATE TRIGGER update_deliveries_updated_at_trigger
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_deliveries_updated_at();