const { createRuntime } = require("./server/runtime");

const runtime = createRuntime();

runtime.server.listen(runtime.config.PORT, () => {
  runtime.logger.info("Server running", {
    port: runtime.config.PORT,
    environment: runtime.config.NODE_ENV,
    maxPlayersPerRoom: runtime.config.MAX_PLAYERS_PER_ROOM,
    maxRooms: runtime.config.MAX_ROOMS,
  });
});

module.exports = runtime;
