import { arrowFunctionExpression } from "@babel/types";

function popoutFunctionCall(path, node, t) {
    const uniqueName = path.scope.generateUidIdentifier("tmp");
    const variableFunction = t.variableDeclaration("const", [t.variableDeclarator(uniqueName, node)])

    const statementParent = path.getStatementParent();
    if (statementParent) {
        statementParent.insertBefore(variableFunction);
    } else {
        throw new Error("Couldn't find statement parent to insert before.");
    }
    return uniqueName
}

export default function ({ types: t}) {
    return {
        visitor: {
            ArrowFunctionExpression(path) {
                if (!t.isExpression(path.node.body)) {
                    return
                }

                path.node.body = t.blockStatement([
                    t.returnStatement(path.node.body)
                ]);
            },
            CallExpression(path, state) {
                for (let i = 0; i < path.node.arguments.length; i++) {
                    if (t.isCallExpression(path.node.arguments[i])) {
                        let newVariableIdentifier = popoutFunctionCall(path, path.node.arguments[i], t);
                        // path.node.arguments[i].replaceWith(newVariableIdentifier)
                        path.node.arguments[i] = newVariableIdentifier
                    }
                }
            }
        }
    }
}