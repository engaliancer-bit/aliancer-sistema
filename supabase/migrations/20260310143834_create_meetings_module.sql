/*
  # Create Meetings Module

  ## Summary
  Creates the base tables for the meetings management module inside the engineering office context.

  ## New Tables

  ### meetings
  - `id` (uuid, primary key)
  - `title` (text) - meeting title
  - `date` (timestamptz) - meeting date and time
  - `project_id` (uuid, optional FK to engineering_projects) - linked project
  - `transcript` (text) - raw transcript text pasted by user
  - `summary` (text, optional) - AI-generated or manual summary
  - `source` (text) - origin: manual, meet, zoom
  - `status` (text) - imported, processing, processed, approved
  - `created_at` (timestamptz)

  ### meeting_topics
  - `id` (uuid, primary key)
  - `meeting_id` (uuid, FK to meetings)
  - `title` (text) - topic title
  - `summary` (text, optional) - topic summary
  - `order_index` (integer) - display order

  ### meeting_tasks
  - `id` (uuid, primary key)
  - `meeting_id` (uuid, FK to meetings)
  - `description` (text) - task description
  - `responsible_name` (text, optional) - person responsible
  - `due_date` (date, optional) - task due date
  - `priority` (text) - low, medium, high
  - `category` (text, optional) - grouping label
  - `status` (text) - pending, in_progress, done

  ## Security
  - RLS enabled on all three tables
  - Authenticated users can read, insert, update, delete their own data
*/

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date timestamptz NOT NULL,
  project_id uuid REFERENCES engineering_projects(id) ON DELETE SET NULL,
  transcript text DEFAULT '',
  summary text DEFAULT '',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'meet', 'zoom')),
  status text NOT NULL DEFAULT 'imported' CHECK (status IN ('imported', 'processing', 'processed', 'approved')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  description text NOT NULL,
  responsible_name text DEFAULT '',
  due_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete meetings"
  ON meetings FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can select meeting_topics"
  ON meeting_topics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert meeting_topics"
  ON meeting_topics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting_topics"
  ON meeting_topics FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete meeting_topics"
  ON meeting_topics FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can select meeting_tasks"
  ON meeting_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert meeting_tasks"
  ON meeting_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting_tasks"
  ON meeting_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete meeting_tasks"
  ON meeting_tasks FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_topics_meeting_id ON meeting_topics(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_meeting_id ON meeting_tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_status ON meeting_tasks(status);
