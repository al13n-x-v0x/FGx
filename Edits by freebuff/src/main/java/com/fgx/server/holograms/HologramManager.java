package com.fgx.server.holograms;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class HologramManager {
    private static final Path FILE = Path.of("config", "fgx-holograms.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, HologramData> holograms = new ConcurrentHashMap<>();

    public static class HologramData {
        public String id, text; public double x, y, z;
        public HologramData(String id, String text, double x, double y, double z) { this.id=id; this.text=text; this.x=x; this.y=y; this.z=z; }
    }

    public static void load() { try { if (Files.exists(FILE)) { JsonObject o = GSON.fromJson(Files.readString(FILE), JsonObject.class); for (var e : o.entrySet()) { var h = e.getValue().getAsJsonObject(); holograms.put(e.getKey(), new HologramData(h.get("id").getAsString(),h.get("text").getAsString(),h.get("x").getAsDouble(),h.get("y").getAsDouble(),h.get("z").getAsDouble())); } } } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load holograms",e); } }
    public static void save() { try { Files.createDirectories(FILE.getParent()); JsonObject o = new JsonObject(); for (var e : holograms.entrySet()) { JsonObject h = new JsonObject(); HologramData d = e.getValue(); h.addProperty("id",d.id); h.addProperty("text",d.text); h.addProperty("x",d.x); h.addProperty("y",d.y); h.addProperty("z",d.z); o.add(e.getKey(),h); } Files.writeString(FILE, GSON.toJson(o)); } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save holograms",e); } }

    public static boolean createHologram(String id, String text, ServerPlayer p) { if (holograms.containsKey(id)) return false; holograms.put(id, new HologramData(id, text, p.getX(), p.getY()+2, p.getZ())); save(); return true; }
    public static boolean deleteHologram(String id) { return holograms.remove(id) != null; }
}
