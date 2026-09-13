package com.fgx.server.commands;

import com.fgx.server.FGXServerMod;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.Commands;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class FGXCommands {
    private static final Map<UUID, double[]> lastPositions = new HashMap<>();
    private static final Map<UUID, double[]> homeLocations = new HashMap<>();

    public static void register(CommandDispatcher<CommandSourceStack> d) {
        d.register(Commands.literal("fgx").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p != null) sendInfo(p); return 1; }));
        d.register(Commands.literal("rules").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p != null) p.sendSystemMessage(Component.literal("\u00A76Rules: No griefing, no hacking, be respectful!")); return 1; }));
        d.register(Commands.literal("spawn").executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer();
            if (p != null) { saveLast(p); p.teleportTo(0, 64, 0); p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aTeleported to spawn!")); }
            return 1;
        }));
        d.register(Commands.literal("back").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p != null) teleportBack(p); return 1; }));
        d.register(Commands.literal("sethome").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p != null) { homeLocations.put(p.getUUID(), new double[]{p.getX(),p.getY(),p.getZ()}); p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aHome set!")); } return 1; }));
        d.register(Commands.literal("home").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p != null) teleportHome(p); return 1; }));
        d.register(Commands.literal("tpa").then(Commands.argument("player", StringArgumentType.word()).executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer(); if (p == null) return 0;
            var target = ctx.getSource().getServer().getPlayerList().getPlayerByName(StringArgumentType.getString(ctx, "player"));
            if (target == null) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cPlayer not found!")); return 0; }
            saveLast(p); p.teleportTo(target.getX(), target.getY(), target.getZ());
            p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aTeleported to \u00A7e"+target.getName().getString()+"\u00A7a!"));
            return 1;
        })));
        d.register(Commands.literal("broadcast").then(Commands.argument("message", StringArgumentType.greedyString()).executes(ctx -> {
            String msg = StringArgumentType.getString(ctx, "message");
            for (var p : ctx.getSource().getServer().getPlayerList().getPlayers()) p.sendSystemMessage(Component.literal("\u00A76\u00A7l\u2605 BROADCAST \u00A7r\u00A7e"+msg));
            return 1;
        })));
        d.register(Commands.literal("peek").executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer(); if (p == null) return 1;
            var s = ctx.getSource().getServer();
            long mem = (Runtime.getRuntime().totalMemory()-Runtime.getRuntime().freeMemory())/1024/1024;
            long total = Runtime.getRuntime().totalMemory()/1024/1024;
            p.sendSystemMessage(Component.literal("\u00A76FGX SMP \u00A77Players: \u00A7e"+s.getPlayerCount()+"/"+s.getMaxPlayers()+" \u00A77RAM: \u00A7b"+mem+"MB/"+total+"MB"));
            return 1;
        }));
    }

    private static void sendInfo(ServerPlayer p) {
        p.sendSystemMessage(Component.literal("\n\u00A76\u00A7lFGX SMP \u00A77v26.2\n\u00A77/fgx /spawn /home /back /tpa /warp /bal /claim /job /bounty /waypoint /collectibles /playtime"));
    }

    private static void teleportBack(ServerPlayer p) {
        double[] pos = lastPositions.remove(p.getUUID());
        if (pos == null) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cNo previous position!")); return; }
        p.teleportTo(pos[0], pos[1], pos[2]);
        p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aTeleported back!"));
    }

    private static void teleportHome(ServerPlayer p) {
        double[] pos = homeLocations.get(p.getUUID());
        if (pos == null) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cNo home! Use /sethome")); return; }
        saveLast(p); p.teleportTo(pos[0], pos[1], pos[2]);
        p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aTeleported home!"));
    }

    private static void saveLast(ServerPlayer p) {
        lastPositions.put(p.getUUID(), new double[]{p.getX(),p.getY(),p.getZ()});
    }
}
