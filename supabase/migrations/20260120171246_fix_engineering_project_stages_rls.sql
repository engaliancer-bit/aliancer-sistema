/*
  # Fix Engineering Project Stages RLS Policies

  1. Changes
    - Add missing RLS policies for engineering_project_stages table
    - Enable full access for all operations (SELECT, INSERT, UPDATE, DELETE)

  2. Security
    - Policies allow public access for now (consistent with other tables in the system)
    - Future enhancement: restrict to authenticated users only
*/

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access to engineering_project_stages" ON engineering_project_stages;
DROP POLICY IF EXISTS "Allow public insert access to engineering_project_stages" ON engineering_project_stages;
DROP POLICY IF EXISTS "Allow public update access to engineering_project_stages" ON engineering_project_stages;
DROP POLICY IF EXISTS "Allow public delete access to engineering_project_stages" ON engineering_project_stages;

-- Create policies for full public access
CREATE POLICY "Allow public read access to engineering_project_stages"
  ON engineering_project_stages
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to engineering_project_stages"
  ON engineering_project_stages
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to engineering_project_stages"
  ON engineering_project_stages
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to engineering_project_stages"
  ON engineering_project_stages
  FOR DELETE
  USING (true);
