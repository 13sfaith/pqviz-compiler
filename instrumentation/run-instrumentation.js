import extractFunctionArgPlugin from "./extract-function-argument.js";
import functionStartPlugin from "./function-start.js";
import babel from '@babel/core';

export default function runInstrumentation(originalCode, fileName) {
    var { code } = babel.transformSync(originalCode, {
        plugins: [
            [extractFunctionArgPlugin, { fileName: fileName }],
            [functionStartPlugin, { fileName: fileName }]
        ],
        configFile: false
    });

    return code;
}