import babel from "@babel/core";
import plugin from "./instrumentation/function-start.js";
import fastGlob from "fast-glob";
import { useTmpDir } from "use-tmpdir";
import fs from "fs";
import fsPromises from "fs/promises";
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function makeDirectory(tmpDir, fullPath) {
  let dirPath = path.dirname(fullPath)
  fs.mkdirSync(path.join(tmpDir, dirPath), { recursive: true });
}

/**
 * Creates a symlink in a cross-platform way.
 * @param {string} target - The target path the symlink should point to.
 * @param {string} linkPath - The path where the symlink should be created.
 */
async function createSymlink(target, linkPath, type = 'file') {
  const platformType = process.platform === 'win32' ? 'junction' : type;

  try {
    let fullTargetPath = path.join(process.cwd(), target)
    await fsPromises.symlink(fullTargetPath, linkPath, platformType)
    console.log(`Symlink created: ${linkPath} → ${target}`);
  } catch (err) {
    console.error('Failed to create symlink:', err);
  }
}

useTmpDir(async (dir) => {
  let fileNames = await fastGlob.glob(["**/**.js"], { ignore: ["node_modules/**"]})

  for (let i = 0; i < fileNames.length; i++) {
    let fileName = fileNames[i]
    makeDirectory(dir, fileName)

    // perform transform
    const originalCode = fs.readFileSync(fileName, "utf8");
    var { code } = babel.transformSync(originalCode, {
      plugins: [[plugin, { fileName: fileName }]],
      configFile: false
    });
    fs.writeFileSync(path.join(dir, fileName), code)
  }

  // symlink node_modules
  await createSymlink("node_modules", path.join(dir, "node_modules"))

  // symlink package.json
  await createSymlink("package.json", path.join(dir, "package.json"), "file")
  await createSymlink("package-lock.json", path.join(dir, "package-lock.json"), "file")

  // build args
  let userArgs = process.argv.splice(2)
  let userCommand = userArgs.join(' ')

  try {
    let { stdout, stderr } = await execAsync(userCommand, { cwd: path.join(dir)})

    console.log(stdout)
    console.error(stderr)

    console.log(stderr.split('\n').filter((a) => a.includes('[ast]')))
    

  } catch (err) {
    console.error(err)
  }
   
})

/*
const originalCode = fs.readFileSync("./input.js", "utf8");
console.log("============= BEFORE =============")
console.log(originalCode)

var { code } = babel.transformSync(originalCode, {
  plugins: [plugin],
  configFile: false
});

console.log("\n\n============= AFTER =============")
console.log(code)
*/