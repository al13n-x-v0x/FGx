package com.fgx.server.commands;

import com.fgx.server.FGXServerMod;
import com.fgx.server.mapimage.MapImageConfig;
import com.fgx.server.mapimage.MapImageRenderer;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.Commands;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;

public class MapImageCommands {
    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("mapimage")
            .then(Commands.literal("create").then(Commands.argument("url", StringArgumentType.greedyString())
                .executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); return p != null ? MapImageRenderer.renderImage(p, StringArgumentType.getString(ctx, "url").trim(), 1, 1) ? 1 : 0 : 0; })
                .then(Commands.argument("width", IntegerArgumentType.integer(1, MapImageRenderer.MAX_GRID))
                    .then(Commands.argument("height", IntegerArgumentType.integer(1, MapImageRenderer.MAX_GRID)).executes(ctx -> {
                        ServerPlayer p = ctx.getSource().getPlayer(); return p != null ? MapImageRenderer.renderImage(p, StringArgumentType.getString(ctx, "url").trim(), IntegerArgumentType.getInteger(ctx, "width"), IntegerArgumentType.getInteger(ctx, "height")) ? 1 : 0 : 0;
                    })))))
            .then(Commands.literal("domains").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p != null) { for (String d : MapImageConfig.getAllowedDomains()) p.sendSystemMessage(Component.literal("\u00A77  \u2022 \u00A7a" + d)); } return 1; }))
            .then(Commands.literal("reload").executes(ctx -> { MapImageConfig.load(); ctx.getSource().sendSuccess(() -> Component.literal(FGXServerMod.PREFIX + "\u00A7aReloaded!"), false); return 1; }))
            .then(Commands.literal("toggle").executes(ctx -> { MapImageConfig.setEnabled(!MapImageConfig.isEnabled()); ctx.getSource().sendSuccess(() -> Component.literal(FGXServerMod.PREFIX + "\u00A7a" + (MapImageConfig.isEnabled() ? "Enabled" : "Disabled")), false); return 1; }))
        );
    }
}
