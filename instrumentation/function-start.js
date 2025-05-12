import path, { sep } from 'path'
import { paths } from '#config'

const monitorClass = "pqvizMonitor"
const monitorFunction = "addEvent"

function getCallingIdentifier(path, t) {
  if (t.isIdentifier(path.node.callee)) {
    return path.node.callee.name
  }

  if (!t.isMemberExpression(path.node.callee)) {
    return "UnimplementedIdentifier"
  }

  return `${path.node.callee.object.name}.${path.node.callee.property.name}`
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

function getOwningFunctionName(path, t) {
  let currentPath = path;

  while (currentPath) {
    if (
      !currentPath.isFunctionDeclaration() &&
      !currentPath.isFunctionExpression() &&
      !currentPath.isArrowFunctionExpression() &&
      !currentPath.isClassMethod() && 
      !currentPath.isObjectMethod()
    ) {
      currentPath = currentPath.parentPath;
      continue;
    }

    const node = currentPath.node;

    // Case 1: Function has a direct name (FunctionDeclaration)
    if (node.id && t.isIdentifier(node.id)) {
      return node.id.name;
    }

    // Case 2: Function is a class method or object method
    if (node.key?.name) {
      return node.key.name;
    }

    // Case 3: Maybe assigned to a variable (VariableDeclarator)
    const parent = currentPath.parentPath;
    if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
      return parent.node.id.name;
    }

    // return 'anonymousFunction';
    currentPath = currentPath.parentPath;

  }

  return 'TLS'; // No function found
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

function buildLiteralType(literal, t) {
  if (Array.isArray(literal)) {
    let elements = []
    for (let i = 0; i < literal.length; i++) {
      elements.push(buildLiteralType(literal[i], t))
    }
    return t.arrayExpression(elements)
  }
  if (t.isLiteral(literal)) {
    return literal
  }
  if (typeof(literal) === "string") {
    return t.stringLiteral(literal)
  }
  if (typeof(literal) === "number") {
    return t.numericLiteral(literal)
  }
  return t.stringLiteral(`Unimplemented Literal Type: ${typeof(literal)}`)
}

function convertObjectIntoBabelArgument(obj, t) {
  let objProps = []
  let objKeys = Object.keys(obj)
  for (let i = 0; i < objKeys.length; i++) {
    let keyLiteral = t.stringLiteral(objKeys[i])
    let valueLiteral = buildLiteralType(obj[objKeys[i]], t)
    objProps.push(t.objectProperty(keyLiteral, valueLiteral))
  }
  let babelObj = t.objectExpression(objProps)
  return babelObj
}

function createMonitorCall(obj, t) {
  let calleeObject = t.identifier(monitorClass)
  let calleeProperty = t.identifier(monitorFunction)
  let memberExpression = t.memberExpression(calleeObject, calleeProperty)
        
  let argObject = convertObjectIntoBabelArgument(obj, t)
  let monitorCall = t.callExpression(memberExpression, [argObject])

  return monitorCall
}

function createArrowFunctionCallFromFunctionCall(currentCall, functionStartCall, t) {
  const callClone = t.cloneNode(currentCall.node, true)
  const returnCall = t.returnStatement(callClone)

  const arrowFunctionBody = t.blockStatement([t.expressionStatement(functionStartCall), returnCall])
  const arrowFunction = t.arrowFunctionExpression([], arrowFunctionBody)  
  const arrowFunctionCall = t.callExpression(arrowFunction, [])

  return arrowFunctionCall
}

function getNthParentPath(path, n) {
  let current = path;
  for (let i = 0; i < n; i++) {
    if (!current.parentPath) return null;
    current = current.parentPath;
  }
  return current;
}

function isMonitorCall(path, t, isArrowFunctionVisitor = false) {
  const callExpression = path.node
  let arrowFunctionExpression = null;
  if (t.isArrowFunctionExpression(callExpression.callee)) {
    arrowFunctionExpression = callExpression.callee
  } else if (t.isArrowFunctionExpression(callExpression) && isArrowFunctionVisitor) {
    arrowFunctionExpression = callExpression
  } else {
    return false
  }

  if (arrowFunctionExpression.body.body == undefined) {
    return false
  }
  if (arrowFunctionExpression.body.body.length < 2) {
    return false
  }
  if (!t.isExpressionStatement(arrowFunctionExpression.body.body[0])) {
    return false
  }
  if (!t.isCallExpression(arrowFunctionExpression.body.body[0].expression)) {
    return false
  }

  const firstCall = arrowFunctionExpression.body.body[0].expression
  if (firstCall.callee.object.name != monitorClass && firstCall.callee.property.name != monitorFunction) {
    return false
  }

  return true
}

const generateFunctionStartMonitorCall = (functionName, fileName, lineNumber, t) => {
  let obj = {
    "type": "functionStart",
    "name": functionName,
    "file": fileName,
    "line": lineNumber
  }
  const monitorCall = createMonitorCall(obj, t)
  return monitorCall
}

export default function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path, state) {
        const functionToBeCalled = getCallingIdentifier(path, t)
        const functionThatIsCalling = getOwningFunctionName(path, t)

        if (isMonitorCall(path, t)) {
          return
        }
        let fourthParent = getNthParentPath(path, 4)
        if (fourthParent && isMonitorCall(fourthParent, t)) {
          return
        }

        if (functionToBeCalled == 'console.log' || functionToBeCalled == `${monitorClass}.${monitorFunction}`) {
          return
        }

        let obj = {
          "type": "functionCall",
          "from": functionThatIsCalling,
          "to": functionToBeCalled,
          "callingFile": state.opts.fileName,
          "callingLine": path.node.loc.start.line,
          "args": path.node.arguments
        }
        let monitorFunctionCall = createMonitorCall(obj, t)

        let arrowFunctionCall = createArrowFunctionCallFromFunctionCall(path, monitorFunctionCall, t)

        path.replaceWith(arrowFunctionCall)
        // path.findParent(p => p.isStatement()).insertBefore(monitorCall)
      },
      Program(path, state) {
        let obj = {
          "type": "moduleStart",
          "file": state.opts.fileName
        }
        let monitorCall = createMonitorCall(obj, t)
        path.unshiftContainer('body', monitorCall)

        let relativeMonitorPath = getMonitorPath(state.opts.fileName)
        let importLiteral = t.stringLiteral(relativeMonitorPath)
        let importSpecifier = t.importDefaultSpecifier(t.identifier('pqvizMonitor'))
        let importDeclaration = t.importDeclaration([importSpecifier], importLiteral)
        path.unshiftContainer('body', importDeclaration)
      },
      ClassMethod(path, state) {
        const functionName = path.node.key.name || "Unnamed Class Method"
        let obj = {
          "type": "functionStart",
          "name": functionName,
          "file": state.opts.fileName,
          "line": path.node.loc.start.line,
        }
        const monitorCall = createMonitorCall(obj, t)
        path.get('body').unshiftContainer('body', t.expressionStatement(monitorCall))
      },
      ObjectMethod(path, state) {
        const functionName = path.node.key.name || "Unnamed Class Method"
        let obj = {
          "type": "functionStart",
          "name": functionName,
          "file": state.opts.fileName,
          "line": path.node.loc.start.line,
        }
        const monitorCall = createMonitorCall(obj, t)
        path.get('body').unshiftContainer('body', t.expressionStatement(monitorCall))
      },
      FunctionDeclaration(path, state) {
        let functionName = findFunctionName(path, t)
        let obj = {
          "type": "functionStart",
          "name": functionName,
          "file": state.opts.fileName,
          "line": path.node.loc.start.line
        }
        const monitorCall = createMonitorCall(obj, t)
        path.get('body').unshiftContainer('body', t.expressionStatement(monitorCall))
      },
      ArrowFunctionExpression(path, state) {
        if (isMonitorCall(path, t, true)) {
          return
        }

        const body = path.get('body');
        let functionName = findFunctionName(path, t)
        const monitorCall = generateFunctionStartMonitorCall(functionName, state.opts.fileName, path.node.loc.start.line, t)

        if (!t.isBlockStatement(body.node)) {
          const originalExpr = body.node;
          body.replaceWith(
            t.blockStatement([
              t.expressionStatement(monitorCall),
              t.returnStatement(originalExpr)
            ])
          );
        } else {
          body.unshiftContainer('body', t.expressionStatement(monitorCall));
        }
      },
    }
  };
}