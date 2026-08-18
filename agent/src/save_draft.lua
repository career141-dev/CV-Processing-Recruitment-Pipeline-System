-- KEYS[1]: call:active:{callId}
-- KEYS[2]: call:version:{callId}
-- KEYS[3]: call:drafts:{callId}
-- ARGV[1]: expectedStateVersion
-- ARGV[2]: turnId
-- ARGV[3]: jsonPayload

local isActive = redis.call('GET', KEYS[1])
if not isActive then
    return {0, "ERR_CALL_INACTIVE"}
end

local currentVersion = redis.call('GET', KEYS[2])
if currentVersion ~= ARGV[1] then
    return {0, "ERR_VERSION_MISMATCH"}
end

if redis.call('HEXISTS', KEYS[3], ARGV[2]) == 1 then
    return {0, "ERR_DRAFT_ALREADY_EXISTS"}
end

redis.call('HSET', KEYS[3], ARGV[2], ARGV[3])
return {1, "OK"}
