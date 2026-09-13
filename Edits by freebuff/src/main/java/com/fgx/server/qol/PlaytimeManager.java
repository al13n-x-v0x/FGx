package com.fgx.server.qol;

import net.minecraft.server.level.ServerPlayer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class PlaytimeManager {

    private static final Map<UUID, Long> joinTimes = new ConcurrentHashMap<>();
    private static final Map<UUID, Long> totalPlaytime = new ConcurrentHashMap<>();

    public static void playerJoin(ServerPlayer player) { joinTimes.put(player.getUUID(), System.currentTimeMillis()); }
    public static void playerLeave(ServerPlayer player) {
        Long joinTime = joinTimes.remove(player.getUUID());
        if (joinTime != null) totalPlaytime.merge(player.getUUID(), System.currentTimeMillis() - joinTime, Long::sum);
    }

    public static long getPlaytime(UUID uuid) {
        long total = totalPlaytime.getOrDefault(uuid, 0L);
        Long joinTime = joinTimes.get(uuid);
        if (joinTime != null) total += System.currentTimeMillis() - joinTime;
        return total;
    }

    public static String formatPlaytime(UUID uuid) {
        long ms = getPlaytime(uuid); long s = ms/1000, m = s/60, h = m/24;
        if (h > 0) return String.format("%dd %dh %dm", h, m%60, s%60);
        if (m > 0) return String.format("%dh %dm %ds", m/60, m%60, s%60);
        return String.format("%dm %ds", m, s%60);
    }
}
