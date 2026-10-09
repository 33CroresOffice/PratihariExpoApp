/*
# Add hobby column to sebayats

1. Changes
- Adds `hobby` text column to the `sebayats` table.
- Allows sebayats to store their hobbies or personal interests.
- Nullable — optional field.
2. Security
- No RLS changes. Existing policies on `sebayats` remain unchanged.
*/

ALTER TABLE sebayats ADD COLUMN IF NOT EXISTS hobby text;
