const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const moduleDir = path.join(__dirname, "..", "public", "js");
const moduleFiles = fs
  .readdirSync(moduleDir)
  .filter((fileName) => fileName.endsWith(".js"))
  .sort();

moduleFiles.forEach((fileName) => {
  const filePath = path.join(moduleDir, fileName);
  execFileSync(process.execPath, ["--input-type=module", "--check"], {
    input: fs.readFileSync(filePath),
    stdio: ["pipe", "inherit", "inherit"],
  });
});

console.log("Client module syntax check passed.");
