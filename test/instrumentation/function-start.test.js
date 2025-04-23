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

function compareResults(codeExampleName) {
    const originalCode = fs.readFileSync(path.join(process.cwd(), `test/instrumentation/inputs/${codeExampleName}.js`), "utf8");
    const newCode = runInstrumentation(originalCode)
    const expectedCode = fs.readFileSync(path.join(process.cwd(), `test/instrumentation/outputs/function-start/${codeExampleName}.js`), "utf8");
    console.log(newCode)
    expect(newCode).toBe(expectedCode)
}

test('Variable Declaration Remains unchanged', () => {
    compareResults('top-level-declarations')
})