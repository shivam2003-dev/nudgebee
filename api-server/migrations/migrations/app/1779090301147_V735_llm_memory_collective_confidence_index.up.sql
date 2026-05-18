-- Adds an ordered B-tree to support the compose-layer TopForTenant query in
-- llm-server (memory/stores/collective/collective_dao.go):
--
--   WHERE tenant_id = $1
--     AND (agent_module IS NULL OR agent_module = $2)
--   ORDER BY confidence DESC, updated_at DESC
--   LIMIT 8
--
-- Existing indexes (idx_collective_lookup, the unique upsert key, and the
-- GIN tsvector) cover the WHERE clause prefix and the keyword branch, but
-- none of them carry the ordering. The planner narrows by tenant and then
-- sorts every matching row before applying LIMIT — fine at low cardinality,
-- linear in tenant size as collective memory grows.
--
-- With this index, the planner can perform an index-ordered scan, apply the
-- OR filter row-by-row, and stop after LIMIT matches. agent_module is left
-- out of the index key on purpose: OR over (NULL, equality) defeats the
-- ordered-scan optimisation by forcing a bitmap OR.
CREATE INDEX IF NOT EXISTS idx_collective_tenant_confidence_updated
    ON llm_memory_collective (tenant_id, confidence DESC, updated_at DESC);
