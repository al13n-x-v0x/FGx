package com.fgx.server.mapimage;

import com.fgx.server.FGXServerMod;
import java.nio.file.*;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class MapImageConfig {
    private static boolean enabled = false;
    private static final Set<String> ALLOWED = ConcurrentHashMap.newKeySet();
    static { ALLOWED.add("i.imgur.com"); ALLOWED.add("cdn.discordapp.com"); }

    public static void load() { FGXServerMod.LOGGER.info("MapImage config loaded (disabled for 26.2)"); }
    public static boolean isUrlAllowed(String url) { return false; }
    public static boolean isEnabled() { return enabled; }
    public static void setEnabled(boolean e) { enabled = e; }
    public static Set<String> getAllowedDomains() { return ALLOWED; }
    public static boolean requiresBlankMap() { return false; }
    public static int getXpCostPerMap() { return 0; }
}
