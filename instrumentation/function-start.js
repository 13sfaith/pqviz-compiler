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

        path.findParent(p => p.isStatement()).insertBefore(callExpression)
      },
      Program(path, state) {
        let relativeMonitorPath = getMonitorPath(state.opts.fileName)
        let importLiteral = t.stringLiteral(relativeMonitorPath)
        let importSpecifier = t.importDefaultSpecifier(t.identifier('pqvizMonitor'))
        let importDeclaration = t.importDeclaration([importSpecifier], importLiteral)
        path.unshiftContainer('body', importDeclaration)
      },
    }
  };
}