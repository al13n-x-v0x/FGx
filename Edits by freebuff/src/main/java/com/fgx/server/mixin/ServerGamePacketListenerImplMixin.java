package com.fgx.server.mixin;

import org.spongepowered.asm.mixin.Mixin;
import net.minecraft.server.network.ServerGamePacketListenerImpl;

@Mixin(ServerGamePacketListenerImpl.class)
class ServerGamePacketListenerImplMixin {
    // Chat mixin disabled for 26.2 compatibility
}
