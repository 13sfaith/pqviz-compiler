import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename)

export const paths = {
    relativeMonitorPath: "pqviz/monitor.js",
    absoluteMonitorPath: resolve(__dirname, "monitor/monitor.js")
}