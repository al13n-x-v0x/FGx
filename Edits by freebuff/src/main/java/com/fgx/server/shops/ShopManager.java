package com.fgx.server.shops;

import com.fgx.server.FGXServerMod;
import com.fgx.server.economy.EconomyManager;
import com.google.gson.*;
import net.minecraft.server.level.ServerPlayer;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ShopManager {
    private static final Path FILE = Path.of("config", "fgx-shops.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, ShopData> shops = new ConcurrentHashMap<>();

    public static class ShopData {
        public String id, ownerName, itemName; public UUID ownerUUID; public double buyPrice, sellPrice; public int stock;
        public ShopData(String id, String owner, UUID uuid, String item, double buy, double sell, int stock) { this.id=id; ownerName=owner; ownerUUID=uuid; itemName=item; buyPrice=buy; sellPrice=sell; this.stock=stock; }
    }

    public static void load() { try { if (Files.exists(FILE)) { JsonObject o = GSON.fromJson(Files.readString(FILE), JsonObject.class); for (var e : o.entrySet()) { var s = e.getValue().getAsJsonObject(); shops.put(e.getKey(), new ShopData(s.get("id").getAsString(),s.get("ownerName").getAsString(),UUID.fromString(s.get("ownerUUID").getAsString()),s.get("itemName").getAsString(),s.get("buyPrice").getAsDouble(),s.get("sellPrice").getAsDouble(),s.get("stock").getAsInt())); } } } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load shops",e); } }
    public static void save() { try { Files.createDirectories(FILE.getParent()); JsonObject o = new JsonObject(); for (var e : shops.entrySet()) { JsonObject s = new JsonObject(); ShopData d = e.getValue(); s.addProperty("id",d.id); s.addProperty("ownerName",d.ownerName); s.addProperty("ownerUUID",d.ownerUUID.toString()); s.addProperty("itemName",d.itemName); s.addProperty("buyPrice",d.buyPrice); s.addProperty("sellPrice",d.sellPrice); s.addProperty("stock",d.stock); o.add(e.getKey(),s); } Files.writeString(FILE, GSON.toJson(o)); } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save shops",e); } }

    public static boolean createShop(ServerPlayer p, String item, double buy, double sell, int stock) { String id = p.getName().getString().toLowerCase()+"_"+item.toLowerCase(); if (shops.containsKey(id)) return false; shops.put(id, new ShopData(id, p.getName().getString(), p.getUUID(), item, buy, sell, stock)); save(); return true; }
    public static List<ShopData> getAllShops() { return new ArrayList<>(shops.values()); }
}
