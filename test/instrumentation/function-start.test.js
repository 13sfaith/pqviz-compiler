import plugin from '../../instrumentation/function-start.js'
import { expect, test } from 'vitest'
import babel from "@babel/core";

function runInstrumentation(originalCode, fileName = "test.js") {
    var { code } = babel.transformSync(originalCode, {
        plugins: [[plugin, { fileName: fileName }]],
        configFile: false
    });
    return code;
}

test('Variable Declaration Remains unchanged', () => {
    let originalCode = 'let arg = 20;'
    let newCode = runInstrumentation(originalCode)
    expect(newCode).toBe(originalCode)
})