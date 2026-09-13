package com.fgx.server.cosmetics;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class CosmeticManager {
    private static final Path FILE = Path.of("config", "fgx-cosmetics.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public enum TrailType { NONE, FLAMES, HEARTS, SPARKLES }
    public enum TagType { NONE, VIP, DONOR, BUILDER, VETERAN, LEGENDARY }

    public static class PlayerCosmetics {
        public UUID uuid; public TrailType trail; public TagType tag;
        public PlayerCosmetics(UUID u) { uuid=u; trail=TrailType.NONE; tag=TagType.NONE; }
    }

    private static final Map<UUID, PlayerCosmetics> data = new ConcurrentHashMap<>();

    public static void load() { try { if (Files.exists(FILE)) { JsonObject o = GSON.fromJson(Files.readString(FILE), JsonObject.class); for (var e : o.entrySet()) { var c = e.getValue().getAsJsonObject(); PlayerCosmetics pc = new PlayerCosmetics(UUID.fromString(e.getKey())); pc.trail = TrailType.valueOf(c.get("trail").getAsString()); pc.tag = TagType.valueOf(c.get("tag").getAsString()); data.put(pc.uuid,pc); } } } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load cosmetics",e); } }
    public static void save() { try { Files.createDirectories(FILE.getParent()); JsonObject o = new JsonObject(); for (var e : data.entrySet()) { JsonObject c = new JsonObject(); PlayerCosmetics pc = e.getValue(); c.addProperty("trail",pc.trail.name()); c.addProperty("tag",pc.tag.name()); o.add(e.getKey().toString(),c); } Files.writeString(FILE,GSON.toJson(o)); } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save cosmetics",e); } }

    public static PlayerCosmetics getCosmetics(UUID u) { return data.computeIfAbsent(u, PlayerCosmetics::new); }
    public static void setTrail(UUID u, TrailType t) { getCosmetics(u).trail = t; save(); }
    public static void setTag(UUID u, TagType t) { getCosmetics(u).tag = t; save(); }
}
