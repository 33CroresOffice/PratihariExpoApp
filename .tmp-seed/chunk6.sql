/*
# Testing module — seed real catalog data (chunk 6/6)

Upserts the actual test-case catalog extracted from the previous version of the testing page.
ON CONFLICT upserts — safe to re-run, nothing deleted. This replaces the earlier
reconstruction with the exact original catalog data.
*/

INSERT INTO test_cases (test_case_id,module_code,title,priority,description,feature,sort_order) VALUES
('MEM-TC-007','SD/MEM','Empty state when no members found','P2','Empty state shown when no members match search.','Directory',300),
('MEM-TC-008','SD/MEM','Member count shown per group','P2','Member count shown per group filter.','Directory',301)
ON CONFLICT (test_case_id) DO UPDATE SET
module_code=EXCLUDED.module_code, title=EXCLUDED.title, priority=EXCLUDED.priority,
description=EXCLUDED.description, feature=EXCLUDED.feature, sort_order=EXCLUDED.sort_order;