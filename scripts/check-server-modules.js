const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const filesToCheck = [
  path.join(__dirname, "..", "server.js"),
  ...fs
    .readdirSync(path.join(__dirname, "..", "server"))
    .filter((fileName) => fileName.endsWith(".js"))
    .sort()
    .map((fileName) => path.join(__dirname, "..", "server", fileName)),
];

filesToCheck.forEach((filePath) => {
  execFileSync(process.execPath, ["--check", filePath], {
    stdio: "inherit",
  });
});

console.log("Server module syntax check passed.");
