package com.fgx.server.graves;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GraveManager {
    private static final Path FILE = Path.of("config", "fgx-graves.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, GraveData> graves = new ConcurrentHashMap<>();

    public static class GraveData {
        public String id, ownerName, world; public UUID ownerUUID; public double x, y, z; public long createdAt; public boolean claimed; public List<String> itemNames;
        public GraveData(String id, UUID owner, String name, double x, double y, double z, String w) { this.id=id; ownerUUID=owner; ownerName=name; this.x=x; this.y=y; this.z=z; world=w; createdAt=System.currentTimeMillis(); claimed=false; itemNames=new ArrayList<>(); }
    }

    public static void load() { try { if (Files.exists(FILE)) { JsonObject o = GSON.fromJson(Files.readString(FILE), JsonObject.class); for (var e : o.entrySet()) { var g = e.getValue().getAsJsonObject(); GraveData d = new GraveData(g.get("id").getAsString(),UUID.fromString(g.get("ownerUUID").getAsString()),g.get("ownerName").getAsString(),g.get("x").getAsDouble(),g.get("y").getAsDouble(),g.get("z").getAsDouble(),g.get("world").getAsString()); d.createdAt=g.get("createdAt").getAsLong(); d.claimed=g.get("claimed").getAsBoolean(); if (g.has("itemNames")) for (var i : g.getAsJsonArray("itemNames")) d.itemNames.add(i.getAsString()); graves.put(e.getKey(),d); } } } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load graves",e); } }
    public static void save() { try { Files.createDirectories(FILE.getParent()); JsonObject o = new JsonObject(); for (var e : graves.entrySet()) { JsonObject g = new JsonObject(); GraveData d = e.getValue(); g.addProperty("id",d.id); g.addProperty("ownerUUID",d.ownerUUID.toString()); g.addProperty("ownerName",d.ownerName); g.addProperty("x",d.x); g.addProperty("y",d.y); g.addProperty("z",d.z); g.addProperty("world",d.world); g.addProperty("createdAt",d.createdAt); g.addProperty("claimed",d.claimed); JsonArray a = new JsonArray(); for (String i : d.itemNames) a.add(i); g.add("itemNames",a); o.add(e.getKey(),g); } Files.writeString(FILE, GSON.toJson(o)); } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save graves",e); } }

    public static void createGrave(ServerPlayer p) {
        GraveData g = new GraveData(p.getName().getString().toLowerCase()+"_"+System.currentTimeMillis(), p.getUUID(), p.getName().getString(), p.getX(), p.getY(), p.getZ(), "overworld");
        for (int i = 0; i < p.getInventory().getContainerSize(); i++) { var s = p.getInventory().getItem(i); if (!s.isEmpty()) g.itemNames.add(s.getHoverName().getString()+" x"+s.getCount()); }
        p.getInventory().clearContent();
        graves.put(g.id, g); save();
        p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7c\u2620 Grave created!"));
    }
    public static boolean claimGrave(ServerPlayer p, String id) { GraveData g = graves.get(id); if (g==null||g.claimed) return false; g.claimed=true; save(); p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aGrave claimed!")); return true; }
    public static List<GraveData> getPlayerGraves(UUID u) { return graves.values().stream().filter(g -> g.ownerUUID.equals(u)).toList(); }
}
