package com.fgx.server.events;

import com.fgx.server.FGXServerMod;
import com.fgx.server.economy.EconomyManager;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import java.util.*;

public class ServerEventManager {
    private static int tick = 0;
    private static final Random rand = new Random();
    private static final String[] EVENTS = {"Meteor Shower","Double XP","Player Bonus (+100 coins)","PvP Arena Open"};

    public static void tick(MinecraftServer server) {
        tick++;
        if (tick >= 6000) { tick = 0; String event = EVENTS[rand.nextInt(EVENTS.length)]; for (ServerPlayer p : server.getPlayerList().getPlayers()) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76\u2605 EVENT: \u00A7e"+event)); if (event.contains("Bonus")) for (ServerPlayer p : server.getPlayerList().getPlayers()) EconomyManager.deposit(p.getUUID(), 100); }
    }
}
