const fs = require("fs");
const path = require("path");

function serializeRoom(room) {
  return {
    ...room,
    usedCardIndices: Object.fromEntries(
      Object.entries(room.usedCardIndices || {}).map(([deckId, indices]) => [
        deckId,
        [...(indices || [])],
      ])
    ),
  };
}

function deserializeRoom(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  return {
    ...snapshot,
    usedCardIndices: Object.fromEntries(
      Object.entries(snapshot.usedCardIndices || {}).map(([deckId, indices]) => [
        deckId,
        new Set(Array.isArray(indices) ? indices : []),
      ])
    ),
  };
}

function createMemoryRoomStore() {
  return {
    deleteRoom() {},
    loadRooms() {
      return {};
    },
    saveRoom() {},
  };
}

function createSqliteRoomStore({ config, logger }) {
  let DatabaseSync;

  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch (_error) {
    throw new Error(
      "SQLite storage mode requires a Node.js runtime that supports node:sqlite"
    );
  }

  fs.mkdirSync(path.dirname(config.SQLITE_DB_PATH), { recursive: true });

  const database = new DatabaseSync(config.SQLITE_DB_PATH);
  database.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const selectRooms = database.prepare("SELECT code, payload FROM rooms");
  const saveRoomStatement = database.prepare(`
    INSERT INTO rooms (code, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE
      SET payload = excluded.payload,
          updated_at = excluded.updated_at
  `);
  const deleteRoomStatement = database.prepare("DELETE FROM rooms WHERE code = ?");

  logger.info("SQLite room storage enabled", {
    sqliteDbPath: config.SQLITE_DB_PATH,
  });

  return {
    deleteRoom(roomCode) {
      deleteRoomStatement.run(roomCode);
    },
    loadRooms() {
      const rooms = {};

      for (const row of selectRooms.iterate()) {
        const snapshot = JSON.parse(row.payload);
        const room = deserializeRoom(snapshot);

        if (room?.code) {
          rooms[room.code] = room;
        }
      }

      return rooms;
    },
    saveRoom(room) {
      saveRoomStatement.run(
        room.code,
        JSON.stringify(serializeRoom(room)),
        room.lastActivityAt || Date.now()
      );
    },
  };
}

function createRoomStore({ config, logger }) {
  if (config.ROOM_STORAGE_MODE === "sqlite") {
    return createSqliteRoomStore({ config, logger });
  }

  return createMemoryRoomStore();
}

module.exports = {
  createRoomStore,
};
