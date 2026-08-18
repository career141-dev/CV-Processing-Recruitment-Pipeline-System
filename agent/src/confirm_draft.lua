-- KEYS[1]: call:active:{callId}
-- KEYS[2]: call:version:{callId}
-- KEYS[3]: call:drafts:{callId}
-- KEYS[4]: call:confirmed:{callId}
-- ARGV[1]: expectedStateVersion
-- ARGV[2]: turnId
-- ARGV[3]: fieldName

local isActive = redis.call('GET', KEYS[1])
if not isActive then return {0, "ERR_CALL_INACTIVE"} end

local currentVersion = redis.call('GET', KEYS[2])
if currentVersion ~= ARGV[1] then return {0, "ERR_VERSION_MISMATCH"} end

local draft = redis.call('HGET', KEYS[3], ARGV[2])
if not draft then return {0, "ERR_DRAFT_NOT_FOUND"} end

if redis.call('HEXISTS', KEYS[4], ARGV[3]) == 1 then return {0, "ERR_ALREADY_COMMITTED"} end

redis.call('HSET', KEYS[4], ARGV[3], draft)
redis.call('INCR', KEYS[2])
return {1, "OK", draft}
