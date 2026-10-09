/*
# Testing module — seed real catalog data (chunk 6/6)

Final chunk of the actual test-case catalog (SD/MEM directory cases 300–301 of 302),
plus removal of 13 placeholder rows from the earlier reconstruction seed that do not
exist in the real catalog (they are replaced by the real cases above). The placeholder
test_case_ids removed: AUTH-TC-014 to AUTH-TC-014 reconstruction variants — specifically
the reconstruction-only IDs not present in the real catalog. ON CONFLICT upserts for
inserts; the DELETE below removes only reconstruction-only placeholder rows so the
catalog matches the real 302-case list exactly.
*/

INSERT INTO test_cases (test_case_id,module_code,title,priority,description,feature,sort_order) VALUES
('MEM-TC-007','SD/MEM','Empty state when no members found','P2','Empty state shown when no members match search.','Directory',300),
('MEM-TC-008','SD/MEM','Member count shown per group','P2','Member count shown per group filter.','Directory',301)
ON CONFLICT (test_case_id) DO UPDATE SET
module_code=EXCLUDED.module_code, title=EXCLUDED.title, priority=EXCLUDED.priority,
description=EXCLUDED.description, feature=EXCLUDED.feature, sort_order=EXCLUDED.sort_order;

-- Remove placeholder rows from the earlier reconstruction seed that are not in the
-- real 302-case catalog (catalog-only check; test results/history are keyed by
-- test_case_id text and are unaffected).
DELETE FROM test_cases
WHERE test_case_id IN (
  'AUTH-TC-015','AUTH-TC-016','HOME-TC-TC-017',
  'REG-TC-054','REG-TC-055','REG-TC-056',
  'ADMIN-SEP-TC-032','ADMIN-APP-TC-008','ADMIN-APP-TC-009',
  'ADMIN-SEBA-TC-020','ADMIN-MGMT-TC-019','ADMIN-MGMT-TC-020'
) OR test_case_id LIKE 'HOME-TC-TC-%';