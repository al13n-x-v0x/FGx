package com.fgx.server.claims;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.ChunkPos;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ClaimManager {
    private static final Path FILE = Path.of("config", "fgx-claims.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, UUID> claims = new ConcurrentHashMap<>();
    private static final Map<UUID, List<String>> playerClaims = new ConcurrentHashMap<>();
    private static final int MAX = 16;
    private static final double COST = 500.0;

    public static void load() { try { if (Files.exists(FILE)) { JsonObject o = GSON.fromJson(Files.readString(FILE), JsonObject.class); if (o.has("claims")) for (var e : o.getAsJsonObject("claims").entrySet()) { UUID owner = UUID.fromString(e.getValue().getAsString()); claims.put(e.getKey(), owner); playerClaims.computeIfAbsent(owner, k -> new ArrayList<>()).add(e.getKey()); } } } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load claims", e); } }
    public static void save() { try { Files.createDirectories(FILE.getParent()); JsonObject o = new JsonObject(); JsonObject c = new JsonObject(); for (var e : claims.entrySet()) c.addProperty(e.getKey(), e.getValue().toString()); o.add("claims", c); Files.writeString(FILE, GSON.toJson(o)); } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save claims", e); } }

    public static String key(ServerPlayer p) { return (p.blockPosition().getX()>>4)+","+(p.blockPosition().getZ()>>4); }
    public static boolean claimChunk(ServerPlayer p, ChunkPos pos) { String k = key(p); if (claims.containsKey(k)) return false; List<String> my = playerClaims.getOrDefault(p.getUUID(), new ArrayList<>()); if (my.size() >= MAX) return false; claims.put(k, p.getUUID()); my.add(k); playerClaims.put(p.getUUID(), my); save(); return true; }
    public static boolean unclaimChunk(ChunkPos pos) { String k = (pos.getMiddleBlockPosition(0).getX()>>4)+","+(pos.getMiddleBlockPosition(0).getZ()>>4); UUID o = claims.remove(k); if (o != null) { var l = playerClaims.get(o); if (l != null) l.remove(k); save(); return true; } return false; }
    public static boolean canAccess(Player p, ChunkPos pos) { UUID o = claims.get((pos.getMiddleBlockPosition(0).getX()>>4)+","+(pos.getMiddleBlockPosition(0).getZ()>>4)); return o == null || o.equals(p.getUUID()); }
    public static int getClaimCount(UUID u) { return playerClaims.getOrDefault(u, new ArrayList<>()).size(); }
    public static int getMaxClaims() { return MAX; }
    public static double getClaimCost() { return COST; }
}
