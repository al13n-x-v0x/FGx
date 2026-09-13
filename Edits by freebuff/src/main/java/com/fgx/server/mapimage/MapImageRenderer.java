package com.fgx.server.mapimage;

import net.minecraft.server.level.ServerPlayer;

public class MapImageRenderer {
    public static final int MAX_GRID = 5;
    public static boolean renderImage(ServerPlayer player, String urlStr, int gridW, int gridH) {
        player.sendSystemMessage(net.minecraft.network.chat.Component.literal("Map image rendering coming soon for 26.2!"));
        return false;
    }
}
