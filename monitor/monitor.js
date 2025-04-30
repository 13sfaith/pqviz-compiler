import fs from 'fs'

// const calls = []

function addEvent(props) {
    let events = []
    try {
        let exisitingTraceJson = fs.readFileSync('trace.json')
        events = JSON.parse(exisitingTraceJson)
    } catch (err) {

    }
    events.push(props)
    let newTraceJson = JSON.stringify(events, null, 2)
    fs.writeFileSync('trace.json', newTraceJson)
}

export default { addEvent }