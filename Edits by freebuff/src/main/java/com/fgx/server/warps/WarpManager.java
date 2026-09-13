package com.fgx.server.warps;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerLevel;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class WarpManager {
    private static final Path FILE = Path.of("config", "fgx-warps.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, WarpData> warps = new ConcurrentHashMap<>();

    public static class WarpData {
        public String name, world; public double x, y, z; public float yaw, pitch; public UUID creator; public boolean isPublic;
        public WarpData(String n, double x, double y, double z, float yaw, float pitch, String w, UUID c, boolean p) { name=n; this.x=x; this.y=y; this.z=z; this.yaw=yaw; this.pitch=pitch; world=w; creator=c; isPublic=p; }
    }

    public static void load() { try { if (Files.exists(FILE)) { JsonObject o = GSON.fromJson(Files.readString(FILE), JsonObject.class); for (var e : o.entrySet()) { var w = e.getValue().getAsJsonObject(); warps.put(e.getKey(), new WarpData(w.get("name").getAsString(),w.get("x").getAsDouble(),w.get("y").getAsDouble(),w.get("z").getAsDouble(),w.get("yaw").getAsFloat(),w.get("pitch").getAsFloat(),w.get("world").getAsString(),UUID.fromString(w.get("creator").getAsString()),w.get("isPublic").getAsBoolean())); } } } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load warps", e); } }
    public static void save() { try { Files.createDirectories(FILE.getParent()); JsonObject o = new JsonObject(); for (var e : warps.entrySet()) { JsonObject w = new JsonObject(); var wd = e.getValue(); w.addProperty("name",wd.name); w.addProperty("x",wd.x); w.addProperty("y",wd.y); w.addProperty("z",wd.z); w.addProperty("yaw",wd.yaw); w.addProperty("pitch",wd.pitch); w.addProperty("world",wd.world); w.addProperty("creator",wd.creator.toString()); w.addProperty("isPublic",wd.isPublic); o.add(e.getKey(),w); } Files.writeString(FILE, GSON.toJson(o)); } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save warps", e); } }

    public static boolean createWarp(String name, ServerPlayer player, boolean isPublic) {
        if (warps.containsKey(name.toLowerCase())) return false;
        warps.put(name.toLowerCase(), new WarpData(name.toLowerCase(), player.getX(), player.getY(), player.getZ(), player.getYRot(), player.getXRot(), "overworld", player.getUUID(), isPublic));
        save(); return true;
    }
    public static boolean deleteWarp(String name) { return warps.remove(name.toLowerCase()) != null; }
    public static List<WarpData> getPublicWarps() { return warps.values().stream().filter(w -> w.isPublic).toList(); }

    public static boolean teleportToWarp(ServerPlayer player, String name) {
        WarpData warp = warps.get(name.toLowerCase());
        if (warp == null) return false;
        player.teleportTo(warp.x, warp.y, warp.z);
        return true;
    }
}
