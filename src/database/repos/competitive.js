'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const db = require('../index');

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const scrimsRepo = {
  create({ guildId, opponent, scheduledAt, format, mode, createdBy }) {
    const result = db.run(
      `INSERT INTO scrims (guild_id, opponent, scheduled_at, format, mode, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      guildId,
      opponent,
      scheduledAt ?? null,
      format,
      mode,
      createdBy,
    );
    return this.get(Number(result.lastInsertRowid));
  },
  get(id) {
    return db.get('SELECT * FROM scrims WHERE id = ?', id);
  },
  list(guildId, status = null) {
    if (status) {
      return db.all(
        'SELECT * FROM scrims WHERE guild_id = ? AND status = ? ORDER BY created_at DESC, id DESC',
        guildId,
        status,
      );
    }
    return db.all(
      'SELECT * FROM scrims WHERE guild_id = ? ORDER BY created_at DESC, id DESC',
      guildId,
    );
  },
  update(id, patch) {
    const sets = [];
    const params = [];
    for (const key of ['opponent', 'scheduled_at', 'format', 'mode', 'status', 'players', 'result', 'channel_id', 'message_id']) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(patch[key]);
      }
    }
    if (sets.length === 0) return this.get(id);
    params.push(id);
    db.run(`UPDATE scrims SET ${sets.join(', ')} WHERE id = ?`, ...params);
    return this.get(id);
  },
  players(id) {
    const row = this.get(id);
    return row ? parseJson(row.players, []) : [];
  },
};

const matchesRepo = {
  create({ guildId, opponent, ourScore, oppScore, winner, playedAt, notes, players, recordedBy }) {
    const result = db.run(
      `INSERT INTO matches (guild_id, opponent, our_score, opp_score, winner, played_at, notes, players, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      guildId,
      opponent,
      ourScore,
      oppScore,
      winner,
      playedAt ?? new Date().toISOString(),
      notes ?? null,
      JSON.stringify(players ?? []),
      recordedBy,
    );
    return this.get(Number(result.lastInsertRowid));
  },
  get(id) {
    return db.get('SELECT * FROM matches WHERE id = ?', id);
  },
  list(guildId, limit = 50) {
    return db.all(
      'SELECT * FROM matches WHERE guild_id = ? ORDER BY played_at DESC, id DESC LIMIT ?',
      guildId,
      limit,
    );
  },
  recent(guildId, limit = 20) {
    return this.list(guildId, limit);
  },
  count(guildId) {
    const row = db.get('SELECT COUNT(*) AS c FROM matches WHERE guild_id = ?', guildId);
    return row.c;
  },
  /** Aggregate team record. */
  record(guildId) {
    return db.get(
      `SELECT
         COUNT(*) AS matches,
         SUM(CASE WHEN winner = 'fgx' THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN winner = 'opponent' THEN 1 ELSE 0 END) AS losses,
         SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) AS draws,
         SUM(our_score) AS total_ours,
         SUM(opp_score) AS total_opps
       FROM matches WHERE guild_id = ?`,
      guildId,
    );
  },
  /** Per-player aggregates from recorded match lineups. */
  playerAggregates(guildId, userId) {
    const rows = db.all(
      `SELECT players, winner, our_score, opp_score FROM matches WHERE guild_id = ? ORDER BY played_at ASC, id ASC`,
      guildId,
    );
    const stats = { matches: 0, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0 };
    for (const row of rows) {
      const lineup = parseJson(row.players, []);
      const entry = lineup.find((p) => String(p.user_id) === String(userId));
      if (!entry) continue;
      stats.matches += 1;
      if (row.winner === 'fgx') stats.wins += 1;
      else if (row.winner === 'opponent') stats.losses += 1;
      else stats.draws += 1;
      stats.kills += Number(entry.kills ?? 0);
      stats.deaths += Number(entry.deaths ?? 0);
    }
    return stats;
  },
};

const clanWarsRepo = {
  create({ guildId, opponent, format, warDate, createdBy }) {
    const result = db.run(
      `INSERT INTO clan_wars (guild_id, opponent, format, war_date, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      guildId,
      opponent,
      format,
      warDate ?? null,
      createdBy,
    );
    return this.get(Number(result.lastInsertRowid));
  },
  get(id) {
    return db.get('SELECT * FROM clan_wars WHERE id = ?', id);
  },
  list(guildId, limit = 50) {
    return db.all(
      'SELECT * FROM clan_wars WHERE guild_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      guildId,
      limit,
    );
  },
  update(id, patch) {
    const sets = [];
    const params = [];
    for (const key of ['opponent', 'format', 'status', 'our_score', 'opp_score', 'winner', 'war_date']) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(patch[key]);
      }
    }
    if (sets.length === 0) return this.get(id);
    params.push(id);
    db.run(`UPDATE clan_wars SET ${sets.join(', ')} WHERE id = ?`, ...params);
    return this.get(id);
  },
  record(guildId) {
    return db.get(
      `SELECT COUNT(*) AS wars,
         SUM(CASE WHEN winner = 'fgx' THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN winner = 'opponent' THEN 1 ELSE 0 END) AS losses,
         SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) AS draws
       FROM clan_wars WHERE guild_id = ? AND status = 'completed'`,
      guildId,
    );
  },
};

const eventsRepo = {
  create({ guildId, type, title, description, startsAt, capacity, createdBy }) {
    const result = db.run(
      `INSERT INTO events (guild_id, type, title, description, starts_at, capacity, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      guildId,
      type,
      title,
      description ?? null,
      startsAt ?? null,
      capacity ?? null,
      createdBy,
    );
    return this.get(Number(result.lastInsertRowid));
  },
  get(id) {
    return db.get('SELECT * FROM events WHERE id = ?', id);
  },
  list(guildId, status = null) {
    if (status) {
      return db.all(
        'SELECT * FROM events WHERE guild_id = ? AND status = ? ORDER BY created_at DESC, id DESC',
        guildId,
        status,
      );
    }
    return db.all(
      'SELECT * FROM events WHERE guild_id = ? ORDER BY created_at DESC, id DESC',
      guildId,
    );
  },
  update(id, patch) {
    const sets = [];
    const params = [];
    for (const key of ['type', 'title', 'description', 'starts_at', 'capacity', 'status', 'participants', 'channel_id', 'message_id']) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(patch[key]);
      }
    }
    if (sets.length === 0) return this.get(id);
    params.push(id);
    db.run(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, ...params);
    return this.get(id);
  },
  participants(id) {
    const row = this.get(id);
    return row ? parseJson(row.participants, []) : [];
  },
};

const trainingRepo = {
  create({ guildId, category, title, scheduledAt, trainerId }) {
    const result = db.run(
      `INSERT INTO training (guild_id, category, title, scheduled_at, trainer_id)
       VALUES (?, ?, ?, ?, ?)`,
      guildId,
      category,
      title,
      scheduledAt ?? null,
      trainerId,
    );
    return this.get(Number(result.lastInsertRowid));
  },
  get(id) {
    return db.get('SELECT * FROM training WHERE id = ?', id);
  },
  list(guildId, status = null) {
    if (status) {
      return db.all(
        'SELECT * FROM training WHERE guild_id = ? AND status = ? ORDER BY created_at DESC, id DESC',
        guildId,
        status,
      );
    }
    return db.all(
      'SELECT * FROM training WHERE guild_id = ? ORDER BY created_at DESC, id DESC',
      guildId,
    );
  },
  update(id, patch) {
    const sets = [];
    const params = [];
    for (const key of ['category', 'title', 'scheduled_at', 'trainer_id', 'status', 'participants', 'message_id']) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(patch[key]);
      }
    }
    if (sets.length === 0) return this.get(id);
    params.push(id);
    db.run(`UPDATE training SET ${sets.join(', ')} WHERE id = ?`, ...params);
    return this.get(id);
  },
  participants(id) {
    const row = this.get(id);
    return row ? parseJson(row.participants, []) : [];
  },
};

module.exports = {
  scrimsRepo,
  matchesRepo,
  clanWarsRepo,
  eventsRepo,
  trainingRepo,
};
