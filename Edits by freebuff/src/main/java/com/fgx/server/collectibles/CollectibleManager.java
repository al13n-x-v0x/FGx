package com.fgx.server.collectibles;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class CollectibleManager {
    private static final Path FILE = Path.of("config", "fgx-collectibles.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, CollectibleData> collectibles = new ConcurrentHashMap<>();
    private static final Map<UUID, List<String>> playerCollectibles = new ConcurrentHashMap<>();

    public static class CollectibleData {
        public String id, name; public int rarity, maxSupply, currentSupply;
        public CollectibleData(String id, String name, int rarity, int max) { this.id=id; this.name=name; this.rarity=rarity; maxSupply=max; currentSupply=0; }
    }

    public static void load() { try { if (Files.exists(FILE)) { JsonObject o = GSON.fromJson(Files.readString(FILE), JsonObject.class); if (o.has("collectibles")) for (var e : o.getAsJsonObject("collectibles").entrySet()) { var c = e.getValue().getAsJsonObject(); CollectibleData d = new CollectibleData(c.get("id").getAsString(),c.get("name").getAsString(),c.get("rarity").getAsInt(),c.get("maxSupply").getAsInt()); d.currentSupply=c.get("currentSupply").getAsInt(); collectibles.put(e.getKey(),d); } if (o.has("playerCollectibles")) for (var e : o.getAsJsonObject("playerCollectibles").entrySet()) { List<String> l = new ArrayList<>(); for (var i : e.getValue().getAsJsonArray()) l.add(i.getAsString()); playerCollectibles.put(UUID.fromString(e.getKey()),l); } } } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load collectibles",e); } }
    public static void save() { try { Files.createDirectories(FILE.getParent()); JsonObject o = new JsonObject(); JsonObject c = new JsonObject(); for (var e : collectibles.entrySet()) { JsonObject j = new JsonObject(); CollectibleData d = e.getValue(); j.addProperty("id",d.id); j.addProperty("name",d.name); j.addProperty("rarity",d.rarity); j.addProperty("maxSupply",d.maxSupply); j.addProperty("currentSupply",d.currentSupply); c.add(e.getKey(),j); } o.add("collectibles",c); JsonObject pc = new JsonObject(); for (var e : playerCollectibles.entrySet()) { JsonArray a = new JsonArray(); for (String i : e.getValue()) a.add(i); pc.add(e.getKey().toString(),a); } o.add("playerCollectibles",pc); Files.writeString(FILE,GSON.toJson(o)); } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save collectibles",e); } }

    public static boolean giveCollectible(ServerPlayer p, String id) { CollectibleData c = collectibles.get(id); if (c==null||(c.maxSupply>0&&c.currentSupply>=c.maxSupply)) return false; List<String> l = playerCollectibles.computeIfAbsent(p.getUUID(), k -> new ArrayList<>()); if (l.contains(id)) return false; l.add(id); c.currentSupply++; save(); return true; }
    public static int getPlayerCollectibleCount(UUID u) { return playerCollectibles.getOrDefault(u, new ArrayList<>()).size(); }
    public static int getTotalCollectibles() { return collectibles.size(); }
}
