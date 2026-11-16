-- Optional RedM server bridge: reports currently online players by Discord identifier.
-- Reports player identifiers only to the configured GamePortal backend.
-- Publish a clear privacy notice on the community server; players can request exclusion.
local endpoint = GetConvar('gameportal_bridge_url', '')
local secret = GetConvar('gameportal_bridge_secret', '')

local function heartbeat()
    if endpoint ~= '' and secret ~= '' then
        local players = {}
        for _, src in ipairs(GetPlayers()) do
            local discord = GetPlayerIdentifierByType(src, 'discord')
            if discord and discord:match('^discord:%d+$') then
                players[#players + 1] = discord:sub(9)
            end
        end
        PerformHttpRequest(endpoint .. '/api/bridge/heartbeat', function(status, response)
            if status < 200 or status >= 300 then
                print(('[GamePortal] Heartbeat HTTP %s. Check URL/secret/Discord IDs.'):format(status))
            end
        end, 'POST', json.encode({ players = players }), {
            ['Content-Type'] = 'application/json',
            ['Authorization'] = 'Bearer ' .. secret
        })
    end
    SetTimeout(60000, heartbeat)
end

SetTimeout(5000, heartbeat)
