package com.fgx.server.events;

import com.fgx.server.FGXServerMod;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;

public class PlayerEventManager {
    public static void onPlayerRespawn(ServerPlayer player) {
        player.sendSystemMessage(Component.literal(FGXServerMod.PREFIX + "\u00A7aWelcome back!"));
    }
}
