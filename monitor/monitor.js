import fs from 'fs'

const calls = []

function newCall(from, to) {
    calls.push({'from': from, 'to': to})
}

process.on('exit', () => {
    const jsonStr = JSON.stringify(calls, null, 2)
    fs.writeFileSync('trace.json', jsonStr)
})

export default { newCall }