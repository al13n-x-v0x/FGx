// map.js - STRIKE//ZERO static map definition.
// "FOUNDRY" - an original, CS2-inspired competitive layout (NOT a port of any
// copyrighted map): two team plazas, three lanes (north / mid / south), a
// raised mid platform with ramps, two elevated tower posts, modular crates.
//
// Everything here is anchored and static: no physics, no moving parts, no
// transparency except invisible spawn markers. ~55 parts total = very low
// draw calls for low-end GPUs.
//
// n = name, s = size [x,y,z], p = position, c = color [r,g,b],
// m = material, r = rotation in degrees (single axis only: [deg,0,0] etc.)
// t = transparency (0..1), k = collide (default true), f = class override

const MATERIALS = {
	Concrete: 816,
	Metal: 1088,
	SmoothPlastic: 272,
};

// Palette: clean concrete, dark tactical walls, team accents
const PAL = {
	ground: [205, 202, 196],
	wall: [64, 66, 72],
	wall2: [74, 76, 84],
	platform: [178, 175, 168],
	crate: [96, 98, 104],
	tower: [104, 106, 112],
	mark: [230, 200, 90],
	frost: [64, 130, 210],
	blaze: [235, 130, 50],
};

module.exports = {
	name: "StrikeMap",
	materials: MATERIALS,
	parts: [
		// Ground shell -------------------------------------------------------
		{ n: "Floor", s: [190, 4, 130], p: [0, -2, 0], c: PAL.ground, m: "Concrete" },
		{ n: "Wall_N", s: [190, 30, 4], p: [0, 15, -65], c: PAL.wall, m: "Concrete" },
		{ n: "Wall_S", s: [190, 30, 4], p: [0, 15, 65], c: PAL.wall, m: "Concrete" },
		{ n: "Wall_W", s: [4, 30, 134], p: [-95, 15, 0], c: PAL.wall, m: "Concrete" },
		{ n: "Wall_E", s: [4, 30, 134], p: [95, 15, 0], c: PAL.wall, m: "Concrete" },

		// Team spawn plazas (gap z -8..8 into the arena) ---------------------
		{ n: "SpawnFloor_FROST", s: [24, 0.4, 44], p: [-82, 0.2, 0], c: PAL.frost, m: "SmoothPlastic" },
		{ n: "SpawnFloor_BLAZE", s: [24, 0.4, 44], p: [82, 0.2, 0], c: PAL.blaze, m: "SmoothPlastic" },
		{ n: "DivW_N", s: [4, 30, 57], p: [-70, 15, -36.5], c: PAL.wall, m: "Concrete" },
		{ n: "DivW_S", s: [4, 30, 57], p: [-70, 15, 36.5], c: PAL.wall, m: "Concrete" },
		{ n: "DivE_N", s: [4, 30, 57], p: [70, 15, -36.5], c: PAL.wall, m: "Concrete" },
		{ n: "DivE_S", s: [4, 30, 57], p: [70, 15, 36.5], c: PAL.wall, m: "Concrete" },

		// Lane dividers (gates at x -14..14 connect mid to the lanes) --------
		{ n: "LaneN_W", s: [42, 14, 3], p: [-35, 7, -22], c: PAL.wall2, m: "Concrete" },
		{ n: "LaneN_E", s: [42, 14, 3], p: [35, 7, -22], c: PAL.wall2, m: "Concrete" },
		{ n: "LaneS_W", s: [42, 14, 3], p: [-35, 7, 22], c: PAL.wall2, m: "Concrete" },
		{ n: "LaneS_E", s: [42, 14, 3], p: [35, 7, 22], c: PAL.wall2, m: "Concrete" },
		// tactical corner walls in the lane transitions
		{ n: "LaneP_N", s: [3, 14, 18], p: [-14, 7, -35], c: PAL.wall2, m: "Concrete" },
		{ n: "LaneP_S", s: [3, 14, 18], p: [14, 7, 35], c: PAL.wall2, m: "Concrete" },

		// Mid courtyard: raised platform + ramps -----------------------------
		{ n: "MidPlatform", s: [36, 4, 24], p: [0, 2, 0], c: PAL.platform, m: "Concrete" },
		{ n: "Ramp_N", s: [12, 1, 10.6], p: [0, 2.46, -17], r: [-22, 0, 0], c: PAL.platform, m: "Concrete" },
		{ n: "Ramp_S", s: [12, 1, 10.6], p: [0, 2.46, 17], r: [22, 0, 0], c: PAL.platform, m: "Concrete" },
		{ n: "MidStripe", s: [40, 0.2, 2], p: [0, 4.1, 0], c: PAL.mark, m: "SmoothPlastic" },
		{ n: "Platform_Crate1", s: [6, 6, 6], p: [0, 7, 0], c: PAL.crate, m: "Metal" },
		{ n: "Platform_Crate2", s: [6, 6, 6], p: [-9, 7, -6], c: PAL.crate, m: "Metal" },
		{ n: "Platform_Crate3", s: [6, 6, 6], p: [9, 7, 6], c: PAL.crate, m: "Metal" },

		// Elevated tower posts with truss access -----------------------------
		{ n: "Tower_W", s: [14, 2, 20], p: [-48, 6, 0], c: PAL.tower, m: "Metal" },
		{ n: "Truss_W", f: "TrussPart", s: [2, 8, 2], p: [-56.5, 4, 6], c: PAL.tower, m: "Metal" },
		{ n: "Tower_E", s: [14, 2, 20], p: [48, 6, 0], c: PAL.tower, m: "Metal" },
		{ n: "Truss_E", f: "TrussPart", s: [2, 8, 2], p: [56.5, 4, 6], c: PAL.tower, m: "Metal" },

		// North lane cover ----------------------------------------------------
		{ n: "Crate_N1", s: [6, 6, 6], p: [-40, 3, -40], c: PAL.crate, m: "Metal" },
		{ n: "Crate_N2", s: [6, 6, 6], p: [-20, 3, -52], c: PAL.crate, m: "Metal" },
		{ n: "Crate_N3", s: [6, 6, 6], p: [5, 3, -34], c: PAL.crate, m: "Metal" },
		{ n: "Crate_N4", s: [6, 3, 6], p: [30, 1.5, -46], c: PAL.crate, m: "Metal" },
		{ n: "Crate_N5", s: [6, 6, 6], p: [45, 3, -33], c: PAL.crate, m: "Metal" },
		{ n: "Barrier_N", s: [16, 4, 2], p: [3, 2, -58], c: PAL.wall2, m: "Concrete" },

		// South lane cover ----------------------------------------------------
		{ n: "Crate_S1", s: [6, 6, 6], p: [40, 3, 40], c: PAL.crate, m: "Metal" },
		{ n: "Crate_S2", s: [6, 6, 6], p: [20, 3, 52], c: PAL.crate, m: "Metal" },
		{ n: "Crate_S3", s: [6, 6, 6], p: [-5, 3, 34], c: PAL.crate, m: "Metal" },
		{ n: "Crate_S4", s: [6, 3, 6], p: [-30, 1.5, 46], c: PAL.crate, m: "Metal" },
		{ n: "Crate_S5", s: [6, 6, 6], p: [-45, 3, 33], c: PAL.crate, m: "Metal" },
		{ n: "Barrier_S", s: [16, 4, 2], p: [-3, 2, 58], c: PAL.wall2, m: "Concrete" },

		// Mid-arena scatter ---------------------------------------------------
		{ n: "Crate_M1", s: [6, 6, 6], p: [-30, 3, -10], c: PAL.crate, m: "Metal" },
		{ n: "Crate_M2", s: [6, 6, 6], p: [30, 3, 10], c: PAL.crate, m: "Metal" },
		{ n: "Crate_M3", s: [6, 3, 6], p: [-24, 1.5, 8], c: PAL.crate, m: "Metal" },
		{ n: "Crate_M4", s: [6, 3, 6], p: [24, 1.5, -8], c: PAL.crate, m: "Metal" },

		// Lane ground stripes (visual lane identity, cheap) -------------------
		{ n: "LaneStripe_N", s: [2, 0.2, 40], p: [0, 0.1, -42], c: PAL.mark, m: "SmoothPlastic" },
		{ n: "LaneStripe_S", s: [2, 0.2, 40], p: [0, 0.1, 42], c: PAL.mark, m: "SmoothPlastic" },

		// Spawn markers (invisible, used by PlayerService) --------------------
		{ n: "Spawn_FROST_1", s: [4, 0.4, 4], p: [-86, 1, -12], c: [255, 255, 255], t: 1, k: false },
		{ n: "Spawn_FROST_2", s: [4, 0.4, 4], p: [-86, 1, 12], c: [255, 255, 255], t: 1, k: false },
		{ n: "Spawn_FROST_3", s: [4, 0.4, 4], p: [-78, 1, -6], c: [255, 255, 255], t: 1, k: false },
		{ n: "Spawn_FROST_4", s: [4, 0.4, 4], p: [-78, 1, 6], c: [255, 255, 255], t: 1, k: false },
		{ n: "Spawn_BLAZE_1", s: [4, 0.4, 4], p: [86, 1, -12], c: [255, 255, 255], t: 1, k: false },
		{ n: "Spawn_BLAZE_2", s: [4, 0.4, 4], p: [86, 1, 12], c: [255, 255, 255], t: 1, k: false },
		{ n: "Spawn_BLAZE_3", s: [4, 0.4, 4], p: [78, 1, -6], c: [255, 255, 255], t: 1, k: false },
		{ n: "Spawn_BLAZE_4", s: [4, 0.4, 4], p: [78, 1, 6], c: [255, 255, 255], t: 1, k: false },

		// Engine spawn locations (fallback before server scripts run) --------
		{ n: "SpawnLocation_FROST", f: "SpawnLocation", s: [6, 0.4, 6], p: [-82, 0.2, -20], c: [200, 200, 205], m: "SmoothPlastic" },
		{ n: "SpawnLocation_BLAZE", f: "SpawnLocation", s: [6, 0.4, 6], p: [82, 0.2, 20], c: [200, 200, 205], m: "SmoothPlastic" },
	],
};
