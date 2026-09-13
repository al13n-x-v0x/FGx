package com.fgx.server.mixin;

import com.fgx.server.FGXServerMod;
import com.fgx.server.graves.GraveManager;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.damagesource.DamageSource;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ServerPlayer.class)
class ServerPlayerMixin {

    @Inject(method = "die", at = @At("HEAD"))
    private void onDeath(DamageSource damageSource, CallbackInfo ci) {
        ServerPlayer player = (ServerPlayer) (Object) this;
        String name = player.getName().getString();
        String srcId = damageSource.getMsgId();

        // Custom death message
        String deathMsg = switch (srcId) {
            case "fall" -> "\u00A7c" + name + " \u00A77fell from a high place!";
            case "drown" -> "\u00A7c" + name + " \u00A77went for a swim... too deep!";
            case "lava" -> "\u00A7c" + name + " \u00A77took a dip in lava!";
            case "void" -> "\u00A7c" + name + " \u00A77fell into the void!";
            case "creeper" -> "\u00A7c" + name + " \u00A77was blown up!";
            case "starve" -> "\u00A7c" + name + " \u00A77forgot to eat!";
            case "hotFloor" -> "\u00A7c" + name + " \u00A77stepped on a magma block!";
            default -> "\u00A7c" + name + " \u00A77died!";
        };

        Component msg = Component.literal(FGXServerMod.PREFIX + "\u00A7c\u2620 " + deathMsg);
        if (player.getServer() != null) {
            for (ServerPlayer p : player.getServer().getPlayerList().getPlayers()) {
                p.sendSystemMessage(msg);
            }
        }

        // Create grave
        GraveManager.createGrave(player);
    }
}
