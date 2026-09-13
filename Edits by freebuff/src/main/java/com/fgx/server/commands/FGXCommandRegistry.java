package com.fgx.server.commands;

import com.fgx.server.FGXServerMod;
import com.fgx.server.bounties.BountyManager;
import com.fgx.server.claims.ClaimManager;
import com.fgx.server.collectibles.CollectibleManager;
import com.fgx.server.cosmetics.CosmeticManager;
import com.fgx.server.economy.EconomyManager;
import com.fgx.server.graves.GraveManager;
import com.fgx.server.jobs.JobManager;
import com.fgx.server.qol.InventorySorter;
import com.fgx.server.qol.PlaytimeManager;
import com.fgx.server.shops.ShopManager;
import com.fgx.server.warps.WarpManager;
import com.fgx.server.waypoints.WaypointManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.DoubleArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.Commands;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;

public class FGXCommandRegistry {
    public static void registerAll(CommandDispatcher<CommandSourceStack> d) {
        // WARP
        d.register(Commands.literal("warp").executes(ctx -> { listWarps(ctx.getSource().getPlayer()); return 1; }).then(Commands.argument("name", StringArgumentType.word()).executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer(); if (p == null) return 0;
            if (WarpManager.teleportToWarp(p, StringArgumentType.getString(ctx, "name"))) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aWarped!")); return 1; }
            p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cNot found!")); return 0;
        })));
        d.register(Commands.literal("setwarp").then(Commands.argument("name", StringArgumentType.word()).executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer(); if (p == null) return 0;
            if (WarpManager.createWarp(StringArgumentType.getString(ctx, "name"), p, true)) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aCreated!")); return 1; }
            p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cExists!")); return 0;
        })));
        d.register(Commands.literal("delwarp").then(Commands.argument("name", StringArgumentType.word()).executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer(); if (p == null) return 0;
            if (WarpManager.deleteWarp(StringArgumentType.getString(ctx, "name"))) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aDeleted!")); return 1; }
            p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cNot found!")); return 0;
        })));
        // ECONOMY
        d.register(Commands.literal("bal").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76Balance: \u00A7e"+EconomyManager.formatAmount(EconomyManager.getBalance(p.getUUID())))); return 1; }));
        d.register(Commands.literal("balance").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76Balance: \u00A7e"+EconomyManager.formatAmount(EconomyManager.getBalance(p.getUUID())))); return 1; }));
        d.register(Commands.literal("baltop").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) { int r=1; for (var e : EconomyManager.getTopPlayers(10)) { p.sendSystemMessage(Component.literal("#"+r+" \u00A7e"+EconomyManager.formatAmount(e.getValue())+" coins")); r++; } } return 1; }));
        d.register(Commands.literal("pay").then(Commands.argument("player", StringArgumentType.word()).then(Commands.argument("amount", DoubleArgumentType.doubleArg(1)).executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer(); if (p==null) return 0;
            var target = ctx.getSource().getServer().getPlayerList().getPlayerByName(StringArgumentType.getString(ctx,"player"));
            double amt = DoubleArgumentType.getDouble(ctx,"amount");
            if (target==null||target.equals(p)) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cInvalid!")); return 0; }
            if (EconomyManager.transfer(p.getUUID(),target.getUUID(),amt)) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aPaid \u00A7e"+EconomyManager.formatAmount(amt))); target.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aReceived \u00A7e"+EconomyManager.formatAmount(amt))); return 1; }
            p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cInsufficient funds!")); return 0;
        }))));
        // CLAIMS
        d.register(Commands.literal("claim").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null&&EconomyManager.withdraw(p.getUUID(),ClaimManager.getClaimCost())&&ClaimManager.claimChunk(p,p.chunkPosition())) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aClaimed!")); return 1; } if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cCannot claim!")); return 0; }));
        d.register(Commands.literal("unclaim").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null&&ClaimManager.unclaimChunk(p.chunkPosition())) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aUnclaimed!")); return 1; } if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cNothing to unclaim!")); return 0; }));
        d.register(Commands.literal("claims").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76Claims: \u00A7e"+ClaimManager.getClaimCount(p.getUUID())+"/"+ClaimManager.getMaxClaims())); return 1; }));
        // SHOPS
        d.register(Commands.literal("shop").then(Commands.literal("list").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76Shops: \u00A7e"+ShopManager.getAllShops().size())); return 1; })));
        // GRAVES
        d.register(Commands.literal("grave").then(Commands.literal("list").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76Graves: \u00A7e"+GraveManager.getPlayerGraves(p.getUUID()).size())); return 1; })));
        // JOBS - fixed chaining
        d.register(Commands.literal("job")
            .then(Commands.literal("list").executes(ctx -> {
                ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) { for (var j : JobManager.JobType.values()) p.sendSystemMessage(Component.literal(j.displayName)); } return 1;
            }))
            .then(Commands.literal("join").then(Commands.argument("job", StringArgumentType.word()).executes(ctx -> {
                ServerPlayer p = ctx.getSource().getPlayer(); if (p==null) return 0;
                try { if (JobManager.joinJob(p, JobManager.JobType.valueOf(StringArgumentType.getString(ctx,"job").toUpperCase()))) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aJoined!")); return 1; } } catch (Exception e) {}
                p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cInvalid!")); return 0;
            })))
            .then(Commands.literal("quit").executes(ctx -> {
                ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null&&JobManager.quitJob(p)) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aQuit!")); return 1;
            }))
            .then(Commands.literal("info").executes(ctx -> {
                ServerPlayer p = ctx.getSource().getPlayer(); if (p==null) return 1;
                var j = JobManager.getPlayerJob(p.getUUID());
                if (j!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76"+j.job.displayName+" \u00A77Lvl \u00A7e"+j.level));
                else p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cNo job!"));
                return 1;
            }))
        );
        // BOUNTIES
        d.register(Commands.literal("bounty")
            .then(Commands.literal("place").then(Commands.argument("player", StringArgumentType.word()).then(Commands.argument("amount", DoubleArgumentType.doubleArg(100)).executes(ctx -> {
                ServerPlayer p = ctx.getSource().getPlayer(); if (p==null) return 0;
                if (BountyManager.placeBounty(p,StringArgumentType.getString(ctx,"player"),DoubleArgumentType.getDouble(ctx,"amount"))) return 1;
                p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cFailed!")); return 0;
            }))))
            .then(Commands.literal("list").executes(ctx -> {
                ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) { for (var b : BountyManager.getAllBounties()) p.sendSystemMessage(Component.literal("\u00A7e"+b.targetName+" \u00A77- \u00A76"+EconomyManager.formatAmount(b.reward))); } return 1;
            }))
        );
        // WAYPOINTS
        d.register(Commands.literal("waypoint")
            .then(Commands.literal("create").then(Commands.argument("name", StringArgumentType.word()).executes(ctx -> {
                ServerPlayer p = ctx.getSource().getPlayer(); if (p==null) return 0;
                if (WaypointManager.createWaypoint(StringArgumentType.getString(ctx,"name"),p,3,true)) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aCreated!")); return 1; }
                p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cExists!")); return 0;
            })))
            .then(Commands.literal("list").executes(ctx -> {
                ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) for (var w : WaypointManager.getPublicWaypoints()) p.sendSystemMessage(Component.literal("\u00A76\u2726 \u00A7e"+w.name)); return 1;
            }))
        );
        // COSMETICS
        d.register(Commands.literal("trail").executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) CosmeticManager.setTrail(p.getUUID(), CosmeticManager.TrailType.NONE); return 1;
        }).then(Commands.argument("type", StringArgumentType.word()).executes(ctx -> {
            ServerPlayer p = ctx.getSource().getPlayer(); if (p==null) return 0;
            try { CosmeticManager.setTrail(p.getUUID(), CosmeticManager.TrailType.valueOf(StringArgumentType.getString(ctx,"type").toUpperCase())); p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7aSet!")); } catch (Exception e) { p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A7cInvalid!")); }
            return 1;
        })));
        // QOL
        d.register(Commands.literal("sort").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) InventorySorter.sortInventory(p); return 1; }));
        d.register(Commands.literal("count").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) InventorySorter.countItems(p); return 1; }));
        d.register(Commands.literal("playtime").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76Playtime: \u00A7e"+PlaytimeManager.formatPlaytime(p.getUUID()))); return 1; }));
        d.register(Commands.literal("collectibles").executes(ctx -> { ServerPlayer p = ctx.getSource().getPlayer(); if (p!=null) p.sendSystemMessage(Component.literal(FGXServerMod.PREFIX+"\u00A76Collectibles: \u00A7e"+CollectibleManager.getPlayerCollectibleCount(p.getUUID())+"/"+CollectibleManager.getTotalCollectibles())); return 1; }));
    }

    private static void listWarps(ServerPlayer p) {
        if (p==null) return;
        var warps = WarpManager.getPublicWarps();
        p.sendSystemMessage(Component.literal("\u00A76FGX WARPS"));
        if (warps.isEmpty()) p.sendSystemMessage(Component.literal("\u00A77None"));
        else for (var w : warps) p.sendSystemMessage(Component.literal("\u00A76\u2726 \u00A7e"+w.name));
    }
}
