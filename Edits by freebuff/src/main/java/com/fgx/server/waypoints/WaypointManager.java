package com.fgx.server.waypoints;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class WaypointManager {
    private static final Path FILE = Path.of("config", "fgx-waypoints.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, WaypointData> waypoints = new ConcurrentHashMap<>();

    public static class WaypointData {
        public String id, name, ownerName; public UUID ownerUUID; public double x, y, z; public boolean isPublic;
        public WaypointData(String id, String name, UUID owner, String ownerName, double x, double y, double z, boolean p) { this.id=id; this.name=name; ownerUUID=owner; this.ownerName=ownerName; this.x=x; this.y=y; this.z=z; isPublic=p; }
    }

    public static void load() { try { if (Files.exists(FILE)) { JsonObject o = GSON.fromJson(Files.readString(FILE), JsonObject.class); for (var e : o.entrySet()) { var w = e.getValue().getAsJsonObject(); waypoints.put(e.getKey(), new WaypointData(w.get("id").getAsString(),w.get("name").getAsString(),UUID.fromString(w.get("ownerUUID").getAsString()),w.get("ownerName").getAsString(),w.get("x").getAsDouble(),w.get("y").getAsDouble(),w.get("z").getAsDouble(),w.get("isPublic").getAsBoolean())); } } } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load waypoints",e); } }
    public static void save() { try { Files.createDirectories(FILE.getParent()); JsonObject o = new JsonObject(); for (var e : waypoints.entrySet()) { JsonObject w = new JsonObject(); WaypointData d = e.getValue(); w.addProperty("id",d.id); w.addProperty("name",d.name); w.addProperty("ownerUUID",d.ownerUUID.toString()); w.addProperty("ownerName",d.ownerName); w.addProperty("x",d.x); w.addProperty("y",d.y); w.addProperty("z",d.z); w.addProperty("isPublic",d.isPublic); o.add(e.getKey(),w); } Files.writeString(FILE, GSON.toJson(o)); } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save waypoints",e); } }

    public static boolean createWaypoint(String name, ServerPlayer p, int color, boolean isPublic) {
        String id = p.getName().getString().toLowerCase()+"_"+name.toLowerCase();
        if (waypoints.containsKey(id)) return false;
        waypoints.put(id, new WaypointData(id, name, p.getUUID(), p.getName().getString(), p.getX(), p.getY(), p.getZ(), isPublic));
        save(); return true;
    }
    public static boolean deleteWaypoint(String id) { return waypoints.remove(id) != null; }
    public static WaypointData getWaypoint(String id) { return waypoints.get(id); }
    public static List<WaypointData> getPublicWaypoints() { return waypoints.values().stream().filter(w -> w.isPublic).toList(); }
}
