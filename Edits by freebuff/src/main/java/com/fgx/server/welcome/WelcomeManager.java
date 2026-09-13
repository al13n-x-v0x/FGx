package com.fgx.server.welcome;

import com.fgx.server.FGXServerMod;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class WelcomeManager {
    private static final Set<UUID> seen = ConcurrentHashMap.newKeySet();
    private static final String[] JOIN_MSGS = {
        "\u00A76Welcome back, \u00A7e%s\u00A76! \u00A77Good to see you!",
        "\u00A76\u00A7l\u2605 \u00A7e%s \u00A76has returned to FGX SMP!",
        "\u00A76Greetings, \u00A7e%s\u00A76! \u00A77Ready to build?",
        "\u00A76\u00A7lHey \u00A7e%s\u00A76\u00A7l! \u00A77Welcome back to the adventure!",
        "\u00A76The legend \u00A7e%s \u00A76has arrived!"
    };
    private static final String[] FIRST_MSGS = {
        "\u00A76\u00A7l\u2605 \u00A7e\u00A7lNEW PLAYER \u00A76\u2605 \u00A7e%s \u00A76just joined FGX SMP!",
        "\u00A76\u00A7l\u2605 \u00A7e\u00A7lWELCOME \u00A76\u2605 \u00A7e%s \u00A76has discovered FGX SMP!",
        "\u00A76\u00A7l\u2605 \u00A7e\u00A7lHELLO \u00A76\u2605 Everyone welcome \u00A7e%s\u00A76!"
    };
    private static final String[] LEAVE_MSGS = {
        "\u00A7c%s \u00A77left the server. \u00A77See you next time!",
        "\u00A7c%s \u00A77went offline. \u00A77They'll be back!",
        "\u00A77\u00A7o%s \u00A77disconnected."
    };

    public static void onPlayerJoin(Player player) {
        String name = player.getName().getString();
        String msg;
        if (!seen.contains(player.getUUID())) {
            seen.add(player.getUUID());
            msg = FIRST_MSGS[rand(FIRST_MSGS.length)];
            FGXServerMod.LOGGER.info("NEW PLAYER: {}", name);
        } else {
            msg = JOIN_MSGS[rand(JOIN_MSGS.length)];
        }
        broadcast(String.format(msg, name));
    }

    public static void onPlayerLeave(Player player) {
        broadcast(String.format(LEAVE_MSGS[rand(LEAVE_MSGS.length)], player.getName().getString()));
    }

    private static void broadcast(String msg) {
        if (FGXServerMod.getServer() == null) return;
        Component full = Component.literal(FGXServerMod.PREFIX + msg);
        for (ServerPlayer p : FGXServerMod.getServer().getPlayerList().getPlayers()) p.sendSystemMessage(full);
    }

    private static int rand(int max) { return (int) (Math.random() * max); }
}
