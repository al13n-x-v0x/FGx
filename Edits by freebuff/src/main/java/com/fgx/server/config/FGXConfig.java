package com.fgx.server.config;

import com.fgx.server.FGXServerMod;
import com.google.gson.*;
import java.io.*;
import java.nio.file.*;

public class FGXConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path CONFIG_PATH = Path.of("config", "fgx-smp.json");

    public String serverName = "FGX SMP";
    public String prefix = "[FGX]";
    public boolean enableScoreboard = true;
    public boolean enableCustomChat = true;
    public boolean enableWelcomeMessages = true;
    public boolean enableDeathMessages = true;
    public String motd = "\u00A76\u00A7lFGX \u00A7e\u00A7lSMP \u00A77- \u00A7fThe Ultimate Survival Experience!";

    private static FGXConfig instance;

    public static FGXConfig load() {
        if (instance != null) return instance;
        instance = new FGXConfig();
        try {
            if (Files.exists(CONFIG_PATH)) {
                instance = GSON.fromJson(Files.readString(CONFIG_PATH), FGXConfig.class);
                FGXServerMod.LOGGER.info("Loaded FGX SMP config");
            } else { save(); }
        } catch (Exception e) { FGXServerMod.LOGGER.error("Failed to load config", e); }
        return instance;
    }

    public static void save() {
        try { Files.createDirectories(CONFIG_PATH.getParent()); Files.writeString(CONFIG_PATH, GSON.toJson(instance != null ? instance : new FGXConfig())); }
        catch (Exception e) { FGXServerMod.LOGGER.error("Failed to save config", e); }
    }
}
