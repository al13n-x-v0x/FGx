package com.fgx.server.chat;

import com.fgx.server.FGXServerMod;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;
import net.minecraft.world.entity.player.Player;

public class ChatManager {
    public static void register() {}
    public static Component formatChatMessage(Player player, String raw) {
        String name = player.getName().getString();
        ChatFormatting color = name.toLowerCase().startsWith("fgx") ? ChatFormatting.GOLD : ChatFormatting.YELLOW;
        return Component.empty().append(Component.literal(name).withStyle(color, ChatFormatting.BOLD)).append(Component.literal(" \u00BB ").withStyle(ChatFormatting.DARK_GRAY)).append(Component.literal(raw).withStyle(ChatFormatting.WHITE));
    }
}
