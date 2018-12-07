// make max height
document.querySelectorAll('.some-max-height').forEach(elem => {
    // calculate height of network based on browser window
    let viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    let networkBounds = elem.getBoundingClientRect().y
    let networkHeight = viewportHeight - networkBounds - 20
    elem.style.height = `${networkHeight}px`
})

// show data
let buildResult = []
let appendStatus = (txt, separator) => {
    if (separator) buildResult.unshift('-----')
    buildResult.unshift(txt)
    document.querySelector('#socketOutput').innerText = buildResult.join('\n')
}

appendStatus('... Opening Connection ...')
fetch(`/api/socket`, {
    'credentials': 'same-origin',
    'headers': {
        'Content-Type': 'application/json'
    }
}).then(resp => {
    return resp.json()
}).then(obj => {
    // see if success
    if (obj.hasOwnProperty("success") && !obj.success) {
        // not success
        appendStatus(`... Unable to initiate socket: ${obj.message}`)
        appendStatus('... Done ...')
        return
    }

    // get socket id and initiate websocket
    let socketId =  obj.socketId
    console.log(`Received socketId (${socketId}) from server - opening websocket`)
    let url = `${document.location.hostname === 'localhost' ? 'ws' : 'wss'}://${document.location.hostname}:${document.location.port}/${socketId}`
    let ws = new WebSocket(url)
    ws.addEventListener('open', (event) => {
        // send the received buildId
        console.log(`Opened websocket - sending (${socketId}) into websocket`)
        ws.send(JSON.stringify({'socketId': socketId}))
    })
    ws.addEventListener('message', (event) => {
        let data = event.data
        let obj = JSON.parse(JSON.parse(data))
        let jsondata = obj.json
        let xml = atob(obj.base64xml)
        console.log(jsondata)
        
        jsondata.Notifications.forEach(not => {
            let msg = `Object Type: ${not.ObjectName}`
            not.FieldNames.forEach(name => {
                msg += `, ${name}=${not.Fields[name]}`
            })

            // append message
            appendStatus(msg, true)
        })
        
        
    })
})

const clearData = (resetArray) => {
    if (resetArray) buildResult = []
    appendStatus('... Listening for data ...')
}

// allow clear
document.querySelector('#clear').addEventListener('click', () => {
    clearData(true)
})
clearData()