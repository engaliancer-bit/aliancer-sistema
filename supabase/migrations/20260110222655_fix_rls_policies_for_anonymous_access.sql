/*
  # Fix RLS Policies for Anonymous Access

  1. Changes
    - Update all RLS policies to allow anonymous (anon) access
    - This is necessary because the application doesn't have authentication implemented yet
    - Policies now grant access to both authenticated and anonymous users

  2. Security Note
    - In production, you should implement proper authentication
    - These policies should then be restricted to authenticated users only
*/

-- Products table policies
DROP POLICY IF EXISTS "Users can delete products" ON products;
DROP POLICY IF EXISTS "Users can insert products" ON products;
DROP POLICY IF EXISTS "Users can update products" ON products;
DROP POLICY IF EXISTS "Users can view products" ON products;

CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert products"
  ON products FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update products"
  ON products FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete products"
  ON products FOR DELETE
  TO anon, authenticated
  USING (true);

-- Recipes table policies
DROP POLICY IF EXISTS "Users can delete recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view recipes" ON recipes;

CREATE POLICY "Anyone can view recipes"
  ON recipes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert recipes"
  ON recipes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update recipes"
  ON recipes FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete recipes"
  ON recipes FOR DELETE
  TO anon, authenticated
  USING (true);

-- Materials table policies
DROP POLICY IF EXISTS "Users can delete materials" ON materials;
DROP POLICY IF EXISTS "Users can insert materials" ON materials;
DROP POLICY IF EXISTS "Users can update materials" ON materials;
DROP POLICY IF EXISTS "Users can view materials" ON materials;

CREATE POLICY "Anyone can view materials"
  ON materials FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert materials"
  ON materials FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update materials"
  ON materials FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete materials"
  ON materials FOR DELETE
  TO anon, authenticated
  USING (true);

-- Recipe items table policies
DROP POLICY IF EXISTS "Users can delete recipe items" ON recipe_items;
DROP POLICY IF EXISTS "Users can insert recipe items" ON recipe_items;
DROP POLICY IF EXISTS "Users can update recipe items" ON recipe_items;
DROP POLICY IF EXISTS "Users can view recipe items" ON recipe_items;

CREATE POLICY "Anyone can view recipe items"
  ON recipe_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert recipe items"
  ON recipe_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update recipe items"
  ON recipe_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete recipe items"
  ON recipe_items FOR DELETE
  TO anon, authenticated
  USING (true);

-- Material movements table policies
DROP POLICY IF EXISTS "Users can delete material movements" ON material_movements;
DROP POLICY IF EXISTS "Users can insert material movements" ON material_movements;
DROP POLICY IF EXISTS "Users can update material movements" ON material_movements;
DROP POLICY IF EXISTS "Users can view material movements" ON material_movements;

CREATE POLICY "Anyone can view material movements"
  ON material_movements FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert material movements"
  ON material_movements FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update material movements"
  ON material_movements FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete material movements"
  ON material_movements FOR DELETE
  TO anon, authenticated
  USING (true);

-- Production table policies
DROP POLICY IF EXISTS "Users can delete production" ON production;
DROP POLICY IF EXISTS "Users can insert production" ON production;
DROP POLICY IF EXISTS "Users can update production" ON production;
DROP POLICY IF EXISTS "Users can view production" ON production;

CREATE POLICY "Anyone can view production"
  ON production FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert production"
  ON production FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update production"
  ON production FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete production"
  ON production FOR DELETE
  TO anon, authenticated
  USING (true);

-- Suppliers table policies
DROP POLICY IF EXISTS "Users can delete suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can update suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can view suppliers" ON suppliers;

CREATE POLICY "Anyone can view suppliers"
  ON suppliers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert suppliers"
  ON suppliers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update suppliers"
  ON suppliers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete suppliers"
  ON suppliers FOR DELETE
  TO anon, authenticated
  USING (true);

-- Product material weights table policies
DROP POLICY IF EXISTS "Users can delete product material weights" ON product_material_weights;
DROP POLICY IF EXISTS "Users can insert product material weights" ON product_material_weights;
DROP POLICY IF EXISTS "Users can update product material weights" ON product_material_weights;
DROP POLICY IF EXISTS "Users can view product material weights" ON product_material_weights;

CREATE POLICY "Anyone can view product material weights"
  ON product_material_weights FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert product material weights"
  ON product_material_weights FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update product material weights"
  ON product_material_weights FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete product material weights"
  ON product_material_weights FOR DELETE
  TO anon, authenticated
  USING (true);