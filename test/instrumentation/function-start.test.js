import plugin from '../../instrumentation/function-start.js'
import { expect, test } from 'vitest'
import babel from "@babel/core"
import path from 'path'
import fs from 'fs'

function runInstrumentation(originalCode, fileName = "test.js") {
    var { code } = babel.transformSync(originalCode, {
        plugins: [[plugin, { fileName: fileName }]],
        configFile: false
    });
    return code;
}

// TODO: Bad name lets make it better
function runTestInput(codeExampleName) {
    const originalCode = fs.readFileSync(path.join(process.cwd(), `test/instrumentation/inputs/${codeExampleName}.js`), "utf8");
    const newCode = runInstrumentation(originalCode)
    return newCode
}

function extractLogsFromInstrumentedCode(instrumentedCode) {
    let lines = instrumentedCode.split('\n')
    let logs = lines.filter((a) => a.includes('console.log'))

    return logs
}

test('not sure yet', () => {
    const result = runTestInput('standard-function-definitions')

    console.log(result)
})