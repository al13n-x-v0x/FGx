package com.fgx.server.qol;

import com.fgx.server.FGXServerMod;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.ItemStack;
import java.util.*;

public class InventorySorter {
    public static void sortInventory(ServerPlayer p) {
        var inv = p.getInventory();
        List<ItemStack> items = new ArrayList<>();
        for (int i = 0; i < inv.getContainerSize(); i++) { ItemStack s = inv.getItem(i); if (!s.isEmpty()) items.add(s.copy()); inv.setItem(i, ItemStack.EMPTY); }
        items.sort(Comparator.comparing(s -> s.getHoverName().getString()));
        for (int i = 0; i < items.size() && i < inv.getContainerSize(); i++) inv.setItem(i, items.get(i));
        p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aSorted!"));
    }
    public static void countItems(ServerPlayer p) {
        Map<String, Integer> counts = new TreeMap<>(); int total = 0;
        for (int i = 0; i < p.getInventory().getContainerSize(); i++) { ItemStack s = p.getInventory().getItem(i); if (!s.isEmpty()) { counts.merge(s.getHoverName().getString(), s.getCount(), Integer::sum); total += s.getCount(); } }
        p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76Inventory ("+total+" items):"));
        for (var e : counts.entrySet()) p.sendSystemMessage(Component.literal("\u00A77  \u00BB \u00A7e"+e.getKey()+" \u00A77x"+e.getValue()));
    }
}
