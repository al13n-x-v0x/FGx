package com.fgx.server.jobs;

import com.fgx.server.FGXServerMod;
import com.fgx.server.economy.EconomyManager;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class JobManager {

    private static final Path JOBS_FILE = Path.of("config", "fgx-jobs.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public enum JobType {
        MINER("\u00A77\u26CF Miner", "\u00A77Mine ores and stones", 1.0),
        FARMER("\u00A7a\uD83C\uDF31 Farmer", "\u00A77Grow and harvest crops", 1.0),
        LUMBERJACK("\u00A76\uD83E\uDE93 Lumberjack", "\u00A77Chop trees for wood", 1.0),
        FISHERMAN("\u00A7b\uD83C\uDFA3 Fisherman", "\u00A77Catch fish and treasure", 1.0),
        HUNTER("\u00A7c\uD83C\uDFF9 Hunter", "\u00A77Hunt animals and monsters", 1.0),
        BLACKSMITH("\u00A74\uD83D\uDD28 Blacksmith", "\u00A77Smelt and craft items", 1.0),
        BUILDER("\u00A7e\uD83C\uDFD7 Builder", "\u00A77Place blocks and build", 1.0),
        EXPLORER("\u00A7d\uD83D\uDDFA Explorer", "\u00A77Discover new places", 1.0);

        public final String displayName; public final String description; public final double payMultiplier;
        JobType(String d, String desc, double pm) { displayName=d; description=desc; payMultiplier=pm; }
    }

    public static class PlayerJob {
        public UUID uuid; public JobType job; public int level, xp, totalEarned;
        public PlayerJob(UUID uuid, JobType job) { this.uuid=uuid; this.job=job; this.level=1; this.xp=0; this.totalEarned=0; }
    }

    private static final Map<UUID, PlayerJob> playerJobs = new ConcurrentHashMap<>();

    public static void load() {
        try {
            if (Files.exists(JOBS_FILE)) {
                JsonObject obj = GSON.fromJson(Files.readString(JOBS_FILE), JsonObject.class);
                for (var e : obj.entrySet()) {
                    JsonObject j = e.getValue().getAsJsonObject();
                    PlayerJob pj = new PlayerJob(UUID.fromString(e.getKey()), JobType.valueOf(j.get("job").getAsString()));
                    pj.level = j.get("level").getAsInt(); pj.xp = j.get("xp").getAsInt(); pj.totalEarned = j.get("totalEarned").getAsInt();
                    playerJobs.put(pj.uuid, pj);
                }
            }
        } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load jobs", e); }
    }

    public static void save() {
        try {
            Files.createDirectories(JOBS_FILE.getParent());
            JsonObject obj = new JsonObject();
            for (var e : playerJobs.entrySet()) {
                JsonObject j = new JsonObject(); PlayerJob pj = e.getValue();
                j.addProperty("job", pj.job.name()); j.addProperty("level", pj.level); j.addProperty("xp", pj.xp); j.addProperty("totalEarned", pj.totalEarned);
                obj.add(e.getKey().toString(), j);
            }
            Files.writeString(JOBS_FILE, GSON.toJson(obj));
        } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save jobs", e); }
    }

    public static boolean joinJob(ServerPlayer player, JobType type) {
        if (playerJobs.containsKey(player.getUUID())) return false;
        playerJobs.put(player.getUUID(), new PlayerJob(player.getUUID(), type));
        save(); return true;
    }

    public static boolean quitJob(ServerPlayer player) { return playerJobs.remove(player.getUUID()) != null; }
    public static PlayerJob getPlayerJob(UUID uuid) { return playerJobs.get(uuid); }

    public static void addXp(ServerPlayer player, int amount) {
        PlayerJob job = playerJobs.get(player.getUUID());
        if (job == null) return;
        job.xp += amount;
        int xpNeeded = job.level * 100;
        while (job.xp >= xpNeeded) { job.xp -= xpNeeded; job.level++; xpNeeded = job.level * 100;
            player.sendSystemMessage(Component.literal(FGXServerMod.PREFIX + "§6★ §eLevel up! Now §6" + job.level + " §ein " + job.job.displayName + "§e!"));
        }
        save();
    }

    public static Map<UUID, PlayerJob> getPlayerJobs() { return Collections.unmodifiableMap(playerJobs); }
}
