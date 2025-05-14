import runInstrumentation from '../../instrumentation/run-instrumentation.js'
import { expect, test } from 'vitest'
import babel from "@babel/core"
import path from 'path'
import fs from 'fs'

function getTestInput(codeExampleName) {
    const fileName = `test/instrumentation/inputs/${codeExampleName}.js`
    const originalCode = fs.readFileSync(path.join(process.cwd(), fileName), "utf8");
    return originalCode
}

function instrumentTestInput(codeExampleName) {
    const originalCode = getTestInput(codeExampleName)
    const newCode = runInstrumentation(originalCode, codeExampleName)
    return newCode
}

test('Standard Functions Get Instrumented', () => {
    const instrumentedCode = instrumentTestInput('standard-function-definitions')
    expect(instrumentedCode).toMatchSnapshot()
})