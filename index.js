import babel from "@babel/core";
import plugin from "./instrumentation/function-start.js";
import fastGlob from "fast-glob";
import { useTmpDir } from "use-tmpdir";
import fs from "fs";
import fsPromises from "fs/promises";
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { paths } from '#config';

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
    let fullTargetPath = target
    if (target[0] !== '/') {
      fullTargetPath = path.join(process.cwd(), target)
    }
    await fsPromises.symlink(fullTargetPath, linkPath, platformType)
    console.log(`Symlink created: ${linkPath} → ${fullTargetPath}`);
  } catch (err) {
    console.error('Failed to create symlink:', err);
  }
}

let calls = []

await useTmpDir(async (dir) => {
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

  // bring in the monitor! 🦎
  // makeDirectory(dir, paths.monitorDirectory)
  await createSymlink(paths.monitorDirectory, path.join(dir, "pqviz"))

  // build args
  let userArgs = process.argv.splice(2)
  let userCommand = userArgs.join(' ')

  try {
    const nodeOptions = "--import \"data:text/javascript,import { register } from \\\"node:module\\\"; import { pathToFileURL } from \\\"node:url\\\"; register(\\\"./pqviz/loader.js\\\", pathToFileURL(\\\"./\\\"));\""
    let { stdout, stderr } = await execAsync(userCommand, { cwd: path.join(dir), env: { ...process.env, 'NODE_OPTIONS': nodeOptions }})

    console.log(stdout)
    console.error(stderr)


    const traceJson = fs.readFileSync(path.join(dir, 'trace.json'), "utf8");
    calls = JSON.parse(traceJson)

  } catch (err) {
    console.error(err)
  }
   
})

fs.writeFileSync('trace.json', JSON.stringify(calls))