import path, { sep } from 'path'
import { paths } from '#config'

function getCallingIdentifier(path, t) {
  if (t.isIdentifier(path.node.callee)) {
    return path.node.callee.name
  }

  if (!t.isMemberExpression(path.node.callee)) {
    return "UnimplementedIdentifier"
  }

  return `${path.node.callee.object.name}.${path.node.callee.property.name}`
}

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

function getOwningFunctionName(path, t) {
  let currentPath = path;

  while (currentPath) {
    if (
      !currentPath.isFunctionDeclaration() &&
      !currentPath.isFunctionExpression() &&
      !currentPath.isArrowFunctionExpression() &&
      !currentPath.isClassMethod()
    ) {
      currentPath = currentPath.parentPath;
      continue;
    }

    const node = currentPath.node;

    // Case 1: Function has a direct name (FunctionDeclaration)
    if (node.id && t.isIdentifier(node.id)) {
      return node.id.name;
    }

    // Case 2: Function is a class method
    if (node.key?.name) {
      return node.key.name;
    }

    // Case 3: Maybe assigned to a variable (VariableDeclarator)
    const parent = currentPath.parentPath;
    if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
      return parent.node.id.name;
    }

    return 'anonymous function';

  }

  return 'TLS'; // No function found
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

function getMonitorPath(filePath) {
  const normalizedPath = path.normalize(filePath)
  const seperatedPath = normalizedPath.split(path.sep).filter(Boolean)
  const fileDepth = seperatedPath.length - 1

  let relativeMonitorPath = `..${path.sep}`.repeat(fileDepth)
  if (fileDepth == 0) {
    relativeMonitorPath += `.${path.sep}`
  }
  relativeMonitorPath += paths.relativeMonitorPath
  return relativeMonitorPath
}

export default function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path, state) {
        const functionToBeCalled = getCallingIdentifier(path, t)
        const functionThatIsCalling = getOwningFunctionName(path, t)

        if (functionToBeCalled == 'console.log' || functionToBeCalled == 'pqvizMonitor.newCall') {
          return
        }

        let calleeObject = t.identifier('pqvizMonitor')
        let calleeProperty = t.identifier('newCall')
        let memberExpression = t.memberExpression(calleeObject, calleeProperty)
        let args = []
        args.push(t.stringLiteral(functionThatIsCalling))
        args.push(t.stringLiteral(functionToBeCalled))
        let callExpression = t.callExpression(memberExpression, args)

        path.insertBefore(callExpression)
      },
      Program(path, state) {
        let relativeMonitorPath = getMonitorPath(state.opts.fileName)
        let importLiteral = t.stringLiteral(relativeMonitorPath)
        let importSpecifier = t.importDefaultSpecifier(t.identifier('pqvizMonitor'))
        let importDeclaration = t.importDeclaration([importSpecifier], importLiteral)
        path.unshiftContainer('body', importDeclaration)

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
      },
    }
  };
}