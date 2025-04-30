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

    return 'anonymousFunction';

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
  let callExpression = t.callExpression(memberExpression, [argObject])

  return callExpression
}

export default function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path, state) {
        const functionToBeCalled = getCallingIdentifier(path, t)
        const functionThatIsCalling = getOwningFunctionName(path, t)

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
        let monitorCall = createMonitorCall(obj, t)

        path.findParent(p => p.isStatement()).insertBefore(monitorCall)
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
    }
  };
}