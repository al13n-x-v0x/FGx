package com.fgx.server.economy;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class EconomyManager {

    private static final Path ECONOMY_FILE = Path.of("config", "fgx-economy.json");
    private static final Map<UUID, Double> balances = new ConcurrentHashMap<>();
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static void load() {
        try {
            if (Files.exists(ECONOMY_FILE)) {
                JsonObject obj = GSON.fromJson(Files.readString(ECONOMY_FILE), JsonObject.class);
                for (var e : obj.entrySet()) balances.put(UUID.fromString(e.getKey()), e.getValue().getAsDouble());
                FGXServerMod.LOGGER.info("Loaded economy for {} players", balances.size());
            }
        } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load economy", e); }
    }

    public static void save() {
        try {
            Files.createDirectories(ECONOMY_FILE.getParent());
            JsonObject obj = new JsonObject();
            for (var e : balances.entrySet()) obj.addProperty(e.getKey().toString(), e.getValue());
            Files.writeString(ECONOMY_FILE, GSON.toJson(obj));
        } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save economy", e); }
    }

    public static double getBalance(UUID uuid) { return balances.getOrDefault(uuid, 0.0); }
    public static void setBalance(UUID uuid, double amount) { balances.put(uuid, Math.max(0, amount)); save(); }
    public static boolean withdraw(UUID uuid, double amount) { double c = getBalance(uuid); if (c < amount) return false; setBalance(uuid, c - amount); return true; }
    public static void deposit(UUID uuid, double amount) { setBalance(uuid, getBalance(uuid) + amount); }
    public static boolean transfer(UUID from, UUID to, double amount) { if (!withdraw(from, amount)) return false; deposit(to, amount); return true; }
    public static String formatAmount(double amount) { if (amount >= 1000000) return String.format("%.1fM", amount/1000000); if (amount >= 1000) return String.format("%.1fK", amount/1000); return String.format("%.0f", amount); }
    public static Map<UUID, Double> getAllBalances() { return Collections.unmodifiableMap(balances); }
    public static List<Map.Entry<UUID, Double>> getTopPlayers(int count) { return balances.entrySet().stream().sorted(Map.Entry.<UUID,Double>comparingByValue().reversed()).limit(count).toList(); }
}
