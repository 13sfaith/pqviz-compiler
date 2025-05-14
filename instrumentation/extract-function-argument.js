export default function ({ types: t}) {
    return {
        visitor: {
            CallExpression(path, state) {
                return
            }
        }
    }
}