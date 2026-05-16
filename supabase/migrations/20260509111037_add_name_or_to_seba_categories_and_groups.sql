/*
  # Add Odia name columns to seba_categories and seba_groups

  ## Summary
  Adds optional `name_or` columns to allow Odia translations of seba category
  and seba group names. The app uses pickLocalized() to show Odia names when
  the language is set to Odia, falling back to the English name.

  Also pre-populates known Odia translations for the existing seba categories
  and seba groups based on the standard Pratihari Nijog nomenclature.

  ## New Columns

  ### seba_categories
  - `name_or` (text, nullable) — Odia translation of category name
  - `description_or` (text, nullable) — Odia translation of description

  ### seba_groups
  - `name_or` (text, nullable) — Odia translation of group name

  ## Notes
  - All columns nullable; existing records unaffected until populated
  - No RLS changes needed
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seba_categories' AND column_name = 'name_or') THEN
    ALTER TABLE seba_categories ADD COLUMN name_or text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seba_categories' AND column_name = 'description_or') THEN
    ALTER TABLE seba_categories ADD COLUMN description_or text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seba_groups' AND column_name = 'name_or') THEN
    ALTER TABLE seba_groups ADD COLUMN name_or text;
  END IF;
END $$;

-- Pre-populate Odia names for seba_groups
UPDATE seba_groups SET name_or = 'ଗୋଛିକାର' WHERE code = 'gochhikar';
UPDATE seba_groups SET name_or = 'ପ୍ରତିହାର' WHERE code = 'pratihari';

-- Pre-populate Odia names for seba_categories (by English name)
UPDATE seba_categories SET name_or = 'ଦକ୍ଷିଣୀ'                              WHERE name = 'Dakhini';
UPDATE seba_categories SET name_or = 'ବଡ଼ଦ୍ୱାର'                              WHERE name = 'Badadwara';
UPDATE seba_categories SET name_or = 'ସିଂହଦ୍ୱାର'                             WHERE name = 'Singha Dwara';
UPDATE seba_categories SET name_or = 'ଧୂଖୁଡ଼ି'                               WHERE name = 'Dhukudi';
UPDATE seba_categories SET name_or = 'ଭୋଗ ମଣ୍ଡପ ପ୍ରତିହାର-ଗରୁଡ଼ ଦ୍ୱାର'       WHERE name = 'Bhogamandap Pratihari-Garuda Dwara';
UPDATE seba_categories SET name_or = 'ଭୋଗ ମଣ୍ଡପ ପ୍ରତିହାର-ସ୍ୱର୍ଣ୍ଣ ଦ୍ୱାର'     WHERE name = 'Bhogamandap Pratihari-Serikia';
UPDATE seba_categories SET name_or = 'ଦ୍ୱାର ଘର'                              WHERE name = 'Dwara Ghara';
UPDATE seba_categories SET name_or = 'ଜୟ ବିଜୟ ଦ୍ୱାର (ଗୋଛିକାର)'              WHERE name = 'Jay Bijay Dwara (Gochhikar)';
