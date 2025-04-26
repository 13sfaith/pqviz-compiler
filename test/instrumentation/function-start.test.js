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

test('Variable Declaration Remains unchanged', () => {
    const result = runTestInput('top-level-declarations')

    expect(result).not.toContain('console')
})

test('Classic Functions should have log statements', () => {
    const result = runTestInput('standard-function-definitions')
    
    const logs = extractLogsFromInstrumentedCode(result)

    expect(logs).toHaveLength(4)
})

test('Arrow Functions should have log statements', () => {
    const result = runTestInput('arrow-function-definitions')

    const logs = extractLogsFromInstrumentedCode(result)

    expect(logs).toHaveLength(4)
})

test('Logs record the pre-instrumented function declaration line numbers', () => {
    const result = runTestInput('standard-function-definitions')
    
    const logs = extractLogsFromInstrumentedCode(result)

    expect(logs[0]).toContain("1")
    expect(logs[3]).toContain("14")
})

test('unnamed default function should be logged', () => {
    const result = runTestInput('default-function')

    const logs = extractLogsFromInstrumentedCode(result)

    expect(logs).toHaveLength(1)
})