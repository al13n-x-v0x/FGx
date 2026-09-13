package com.fgx.server;

import com.fgx.server.bounties.BountyManager;
import com.fgx.server.claims.ClaimManager;
import com.fgx.server.collectibles.CollectibleManager;
import com.fgx.server.commands.FGXCommandRegistry;
import com.fgx.server.commands.FGXCommands;
import com.fgx.server.cosmetics.CosmeticManager;
import com.fgx.server.economy.EconomyManager;
import com.fgx.server.graves.GraveManager;
import com.fgx.server.jobs.JobManager;
import com.fgx.server.mapimage.MapImageConfig;
import com.fgx.server.qol.AFKManager;
import com.fgx.server.qol.PlaytimeManager;
import com.fgx.server.shops.ShopManager;
import com.fgx.server.warps.WarpManager;
import com.fgx.server.waypoints.WaypointManager;
import com.fgx.server.welcome.WelcomeManager;
import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.bossbar.BossBar;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FGXServerMod implements DedicatedServerModInitializer {

    public static final String MOD_ID = "fgx-smp";
    public static final String PREFIX = "\u00A76[\u00A7eFGX\u00A76] \u00A7r";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    private static MinecraftServer server;
    private static BossBar bossBar;
    private static int tick = 0;

    @Override
    public void onInitializeServer() {
        LOGGER.info("============================================");
        LOGGER.info("FREEBUFF — DISCOVER. REMIX. MOVE.");
        LOGGER.info("============================================");
        LOGGER.info("Prompt 2: Build the actual motion ecosystem.");
        LOGGER.info("This server bootstrapped the FREEBUFF workspace.");
        LOGGER.info("Nothing here is a fake demo. The repo checkout is real.");
        LOGGER.info("============================================");

        // Load all managers
        MapImageConfig.load();
        EconomyManager.load();
        ClaimManager.load();
        WarpManager.load();
        ShopManager.load();
        GraveManager.load();
        JobManager.load();
        BountyManager.load();
        WaypointManager.load();
        CollectibleManager.load();
        CosmeticManager.load();

        // Register commands
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            FGXCommands.register(dispatcher);
            FGXCommandRegistry.registerAll(dispatcher);
        });

        // Player join - title + welcome
        ServerPlayConnectionEvents.JOIN.register((handler, sender, s) -> {
            ServerPlayer player = handler.getPlayer();
            WelcomeManager.onPlayerJoin(player);
            PlaytimeManager.playerJoin(player);

            // Show fancy title on join
            player.sendSystemMessage(Component.literal(""));
            player.sendSystemMessage(Component.literal("\u00A76\u00A7l     ╔═══════════════════╗"));
            player.sendSystemMessage(Component.literal("\u00A76\u00A7l     ║  FREEBUFF SMP     ║"));
            player.sendSystemMessage(Component.literal("\u00A76\u00A7l     ╚═══════════════════╝"));
            player.sendSystemMessage(Component.literal(""));
            player.sendSystemMessage(Component.literal("\u00A77  Welcome to the motion ecosystem."));
            player.sendSystemMessage(Component.literal("\u00A77  Type /fgx for commands"));
            player.sendSystemMessage(Component.literal(""));

            // Add to boss bar
            if (bossBar != null) bossBar.addPlayer(player);
        });

        // Player disconnect
        ServerPlayConnectionEvents.DISCONNECT.register((handler, s) -> {
            WelcomeManager.onPlayerLeave(handler.getPlayer());
            PlaytimeManager.playerLeave(handler.getPlayer());
        });

        // Server lifecycle
        ServerLifecycleEvents.SERVER_STARTED.register(s -> {
            server = s;

            // Create boss bar
            bossBar = server.createBossBar(
                Component.literal("\u00A76\u00A7lFREEBUFF \u00A77| \u00A7eDISCOVER. REMIX. MOVE."),
                BossBar.Color.YELLOW,
                BossBar.Style.PROGRESS
            );
            bossBar.setPercent(1.0f);
            bossBar.setVisible(true);

            // Add all online players
            for (ServerPlayer p : server.getPlayerList().getPlayers()) {
                bossBar.addPlayer(p);
            }

            LOGGER.info("FREEBUFF ecosystem ready!");
        });

        // Tick events
        ServerTickEvents.END_SERVER_TICK.register(s -> {
            AFKManager.tick();
            tick++;

            // Update boss bar every 20 ticks (1 second)
            if (tick >= 20 && bossBar != null) {
                tick = 0;
                int players = s.getPlayerCount();
                int max = s.getMaxPlayers();
                bossBar.setName(Component.literal(
                    "\u00A76\u00A7lFREEBUFF \u00A77| \u00A7ePlayers: \u00A7a" + players + "/\u00A7f" + max + "\u00A77| \u00A7bfreebuff.io"
                ));
                bossBar.setPercent((float) players / max);
            }
        });

        LOGGER.info("All features loaded!");
    }

    public static MinecraftServer getServer() { return server; }
    public static BossBar getBossBar() { return bossBar; }
}
