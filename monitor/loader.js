import monitor from './monitor.js'

export async function resolve(specifier, context, nextResolve) {
  let next = await nextResolve(specifier, context)
  let obj = {
    type: 'import',
    sourcePath: context.parentURL,
    importPath: next.url,
  }
  monitor.addEvent(obj)
  return next
}

export async function load(url, context, nextLoad) {
  let next = await nextLoad(url, context)
  return next
}

