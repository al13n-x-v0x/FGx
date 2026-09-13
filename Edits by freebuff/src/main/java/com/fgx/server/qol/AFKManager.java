package com.fgx.server.qol;

import com.fgx.server.FGXServerMod;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class AFKManager {
    private static final Map<UUID, Long> lastActivity = new ConcurrentHashMap<>();
    private static final Map<UUID, Boolean> isAFK = new ConcurrentHashMap<>();

    public static void tick() {
        long now = System.currentTimeMillis();
        if (FGXServerMod.getServer() == null) return;
        for (ServerPlayer p : FGXServerMod.getServer().getPlayerList().getPlayers()) {
            long last = lastActivity.getOrDefault(p.getUUID(), now);
            if (!isAFK.containsKey(p.getUUID()) && (now - last) > 300000) {
                isAFK.put(p.getUUID(), true);
                p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7eYou are now AFK."));
            }
        }
    }

    public static void updateActivity(UUID uuid) { lastActivity.put(uuid, System.currentTimeMillis()); isAFK.remove(uuid); }
    public static boolean isPlayerAFK(UUID uuid) { return isAFK.getOrDefault(uuid, false); }
}
