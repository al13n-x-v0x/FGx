package com.fgx.server.bounties;

import com.fgx.server.FGXServerMod;
import com.fgx.server.economy.EconomyManager;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class BountyManager {

    private static final Path BOUNTIES_FILE = Path.of("config", "fgx-bounties.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<UUID, BountyData> bounties = new ConcurrentHashMap<>();

    public static class BountyData {
        public UUID targetUUID; public String targetName; public UUID placerUUID; public String placerName; public double reward; public long createdAt; public boolean claimed;
        public BountyData(UUID t, String tn, UUID p, String pn, double r) { targetUUID=t; targetName=tn; placerUUID=p; placerName=pn; reward=r; createdAt=System.currentTimeMillis(); claimed=false; }
    }

    public static void load() {
        try {
            if (Files.exists(BOUNTIES_FILE)) {
                JsonObject obj = GSON.fromJson(Files.readString(BOUNTIES_FILE), JsonObject.class);
                for (Map.Entry<String, JsonElement> e : obj.entrySet()) {
                    JsonObject b = e.getValue().getAsJsonObject();
                    BountyData bd = new BountyData(UUID.fromString(b.get("targetUUID").getAsString()), b.get("targetName").getAsString(),
                        UUID.fromString(b.get("placerUUID").getAsString()), b.get("placerName").getAsString(), b.get("reward").getAsDouble());
                    bd.createdAt = b.get("createdAt").getAsLong(); bd.claimed = b.get("claimed").getAsBoolean();
                    bounties.put(bd.targetUUID, bd);
                }
            }
        } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load bounties", e); }
    }

    public static void save() {
        try {
            Files.createDirectories(BOUNTIES_FILE.getParent());
            JsonObject obj = new JsonObject();
            for (var e : bounties.entrySet()) {
                JsonObject b = new JsonObject(); BountyData bd = e.getValue();
                b.addProperty("targetUUID", bd.targetUUID.toString()); b.addProperty("targetName", bd.targetName);
                b.addProperty("placerUUID", bd.placerUUID.toString()); b.addProperty("placerName", bd.placerName);
                b.addProperty("reward", bd.reward); b.addProperty("createdAt", bd.createdAt); b.addProperty("claimed", bd.claimed);
                obj.add(e.getKey().toString(), b);
            }
            Files.writeString(BOUNTIES_FILE, GSON.toJson(obj));
        } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save bounties", e); }
    }

    public static boolean placeBounty(ServerPlayer placer, String targetName, double reward) {
        if (!EconomyManager.withdraw(placer.getUUID(), reward)) return false;
        UUID targetUUID = findPlayerUUID(targetName);
        if (targetUUID == null) return false;
        BountyData existing = bounties.get(targetUUID);
        if (existing != null) { existing.reward += reward; } else {
            bounties.put(targetUUID, new BountyData(targetUUID, targetName, placer.getUUID(), placer.getName().getString(), reward));
        }
        save();
        broadcastMessage(Component.literal(FGXServerMod.PREFIX + "§c☠ §e" + placer.getName().getString() + " §cplaced a §6" + EconomyManager.formatAmount(reward) + " coin §cbounty on §e" + targetName + "§c!"));
        return true;
    }

    public static boolean claimBounty(ServerPlayer killer, UUID killedUUID) {
        BountyData bounty = bounties.remove(killedUUID);
        if (bounty == null || bounty.claimed) return false;
        bounty.claimed = true;
        EconomyManager.deposit(killer.getUUID(), bounty.reward);
        broadcastMessage(Component.literal(FGXServerMod.PREFIX + "§6★ §e" + killer.getName().getString() + " §6claimed the §6" + EconomyManager.formatAmount(bounty.reward) + " coin §6bounty on §e" + bounty.targetName + "§6!"));
        save(); return true;
    }

    public static BountyData getBounty(UUID t) { return bounties.get(t); }
    public static List<BountyData> getAllBounties() { return new ArrayList<>(bounties.values()); }
    public static double getTotalBounty(UUID t) { BountyData b = bounties.get(t); return b != null ? b.reward : 0; }

    private static UUID findPlayerUUID(String name) {
        if (FGXServerMod.getServer() == null) return null;
        var p = FGXServerMod.getServer().getPlayerList().getPlayerByName(name);
        return p != null ? p.getUUID() : null;
    }

    private static void broadcastMessage(Component message) {
        if (FGXServerMod.getServer() == null) return;
        for (var p : FGXServerMod.getServer().getPlayerList().getPlayers()) p.sendSystemMessage(message);
    }
}
