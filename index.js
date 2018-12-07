const express = require('express')
const exphbs = require("express-handlebars")
const path = require('path')
const websocket = require('./websocket.js')
const uuid = require('uuid/v1')
const parseXmlToJson = require('xml2js').parseString
let bodyparser = require('body-parser');

// create express app
const app = express()
app.use(express.static(path.join(__dirname, 'public')))
app.engine('handlebars', exphbs({defaultLayout: 'main'}))
app.set('view engine', 'handlebars')
app.use(bodyparser.text({
    type: '*/*'
}))

// read port, create http(s) server with express, create websocket
const port = process.env.PORT || 3000
let httpServer = require('http').createServer(app)
const wss = websocket.createInstance(httpServer)

// create websocket (need only only socket id)
const socketId = uuid()
wss.initializeStream(socketId)

app.post('/outbound_message', (req, res) => {
    // log to console
    console.log('Received payload:')
    console.log(req.body)
    console.log('-----')

    // confirm message
    res.set('content-type', 'application/soap+xml')
    res.status(200).send(`<?xml version="1.0" encoding="utf-8" ?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <notificationsResponse xmlns="http://soap.sforce.com/2005/09/outbound">
      <Ack>true</Ack>
    </notificationsResponse>
  </soapenv:Body>
</soapenv:Envelope>
`)

    // get socket
    let wsInstance = websocket.getInstance(socketId)
    if (!wsInstance || !wsInstance.stream) {
        console.log('No websocket to write message to')
        return
    }

    // parse to json
    let jsonVersion = parseXmlToJson(req.body, (err, result) => {
        let notifications = result['soapenv:Envelope']['soapenv:Body'][0].notifications[0]

        // parse json into easier structure
        let data = {}
        data.OrganizationId = notifications.OrganizationId[0]
        data.ActionId = notifications.ActionId[0]
        data.SessionId = typeof notifications.SessionId[0] === 'string' ? notifications.SessionId[0] : undefined
        data.Notifications = notifications.Notification.map(not => {
            let d = {
                'Id': not.Id[0],
                'FieldNames': [],
                'Fields': {
                    
                }
            }
            Object.keys(not.sObject[0]).forEach(key => {
                let elem = not.sObject[0][key]
                if (key === '$') {
                    d['ObjectName'] = elem['xsi:type'].substring(3)
                } else {
                    d.FieldNames.push(key.substring(3))
                    d.Fields[key.substring(3)] = elem[0]
                }
            })
            return d
        })

        // encode xml as base64
        let base64Version = Buffer.from(req.body).toString('base64')
        let payload = {
            'json': data,
            'base64xml': base64Version
        }
        let strpayload = JSON.stringify(payload)
        
        // send into socket
        wsInstance.stream.write(strpayload)
    })
    
    
})

app.get("/", (req, res) => {
    // render
    res.render('home', {'home_active': 'active'})
})

app.get("/messages", (req, res) => {
    // build context
    const ctx = {
        'msg_active': 'active',
        'socketId': socketId
    }

    // render
    res.render('messages', ctx)
})

app.get('/api/socket', (req, res) => {
    // send socketid back to user
    res.send({
        'success': true,
        'socketId': socketId
    }).end()
})

// listen
httpServer.listen(port);
console.log(`Server listening on port ${port} - press Ctrl-C to quit`);
