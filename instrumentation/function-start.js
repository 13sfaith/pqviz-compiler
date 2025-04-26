function buildConsoleLogStatement(path, state, t, specialType) {
  let consoleLogMember = t.memberExpression(t.identifier("console"), t.identifier("log"))
  let consoleStr = ''
  if (specialType) {
    consoleStr = '[ast] ' + state.opts.fileName + ":" + path.node.loc.start.line + '-' + specialType
  } else {
    consoleStr = '[ast] ' + state.opts.fileName + ":" + path.node.loc.start.line + '-' + path.node.id.name
  }
  let consoleLogArguments = [t.stringLiteral(consoleStr)]
  let consoleLogCall = t.callExpression(consoleLogMember, consoleLogArguments)
  return consoleLogCall
}

function findFunctionName(path, t) {
  let current = path;

  if (current.node?.id?.name != null) {
    return current.node.id.name
  }

  while (current) {
    const parent = current.parentPath;
    if (!parent) break;

    const node = parent.node;

    if (
      t.isVariableDeclarator(node) &&
      t.isIdentifier(node.id)
    ) {
      return node.id.name;
    }

    if (
      t.isObjectProperty(node) &&
      t.isIdentifier(node.key)
    ) {
      return node.key.name;
    }

    if (
      t.isAssignmentExpression(node) &&
      t.isIdentifier(node.left)
    ) {
      return node.left.name;
    }

    current = parent;
  }

  return 'anonymous function';
}

export default function ({ types: t }) {
  return {
    visitor: {
      Program(path, state) {
        const topLevelNonDeclarations = path.node.body.filter(
          (node) =>
            !t.isClassDeclaration(node) &&
            !t.isFunctionDeclaration(node) &&
            !t.isVariableDeclaration(node) &&
            !t.isImportDeclaration(node) &&
            !t.isExportDeclaration(node) &&
            !t.isExportNamedDeclaration(node) &&
            !t.isExportDefaultDeclaration(node)
        );

        if (topLevelNonDeclarations.length == 0) {
          return
        }
        const consoleLogCall = buildConsoleLogStatement(path, state, t, '[TLS]')
        path.unshiftContainer('body', t.expressionStatement(consoleLogCall))
      },
      ClassMethod(path, state) {
        const functionName = path.node.key.name || "Unnamed Class Method"
        const consoleLogCall = buildConsoleLogStatement(path, state, t, functionName)
        path.get('body').unshiftContainer('body', t.expressionStatement(consoleLogCall))
      },
      FunctionDeclaration(path, state) {
        let functionName = findFunctionName(path, t)
        const consoleLogCall = buildConsoleLogStatement(path, state, t, functionName)
        path.get('body').unshiftContainer('body', t.expressionStatement(consoleLogCall))
      },
      ArrowFunctionExpression(path, state) {
        const body = path.get('body');
        let functionName = findFunctionName(path, t)
        const consoleLogCall = buildConsoleLogStatement(path, state, t, functionName)

        if (!t.isBlockStatement(body.node)) {
          const originalExpr = body.node;
          body.replaceWith(
            t.blockStatement([
              t.expressionStatement(consoleLogCall),
              t.returnStatement(originalExpr)
            ])
          );
        } else {
          body.unshiftContainer('body', t.expressionStatement(consoleLogCall));
        }
      }
    }
  };
}