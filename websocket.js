const {Writable} = require('stream')
const WebSocket = require('ws')
const uuid = require('uuid/v1')

const WebSocketController = function(http, options) {
    // holder for websockets
    this.options = options
    this.channelWrappers = {}
    
    // create server
    this.wss = new WebSocket.Server({
        'server': http
    })
    this.wss.on('connection', (ws, req) => {
        // get socket id from url and terminate if not found
        let socketId = req.url.substring(1)
        console.log(`Connection to websocket established - socketId: ${socketId}`)
        let wrapper = this.channelWrappers[socketId]
        if (!wrapper) {
            // no wrapper found
            console.warn(`Unable to find wrapper for supplied socketId (${socketId}) so closing websocket`)
            return ws.terminate()
        }

        // tell callback
        this.options.onconnection(socketId)

        // set up keep alive
        ws.isAlive = true
        ws.isClosed = false
        ws.on('pong', () => {
            ws.isAlive = true
            this.options.onpong(socketId)
        })

        ws.on('message', (message) => {
            // received message - see if it contains socketId
            try {
                console.log(`Received websocket message ${message}`)
                const obj = JSON.parse(message)
                const socketId = obj.socketId
                if (!socketId) {
                    // tell callback
                    try {
                        this.options.onerror(Error('Receieved message without a socketId'), 'message')
                    } catch (err) {
                        console.log(`Unable to tell callback about error (${err.message})`, err)
                    }
                    return
                }

                // tell callback
                this.options.onmessage(socketId, obj)

            } catch (e) {
                console.log(e)
                try {
                    this.options.onerror(e, 'message')
                } catch (err) {
                    console.log(`Unable to send error to onerror callback due to error (${err.message})`)
                }
            }
        })
        ws.on('close', () => {
            ws.isClosed = true
            try {
                this.options.onclose()
            } catch (err) {
                this.options.onerror(err, 'close')
            }
        })

        // create a writable stream and pipe build messages into stream
        let output = new Writable({
            'objectMode': true, 
            'write': (msg, encoding, done) => {
                if (ws.isClosed || !ws.isAlive) return done()
                if (!msg) {
                    // no message - we are done - close websocket
                    done(undefined, undefined)
                    ws.close()
                } else {
                    // send message to websocket
                    ws.send(JSON.stringify(msg))
                    done()
                }
            }
        })
        wrapper.stream = output
    })

    // check whether connections are alive for cleanup
    global.setInterval(() => {
        this.wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                console.log('Terminating websocket')
                return ws.terminate()
            }
            ws.isAlive = false
            ws.ping(null, false, true)
        });
    }, 10000);
}
WebSocketController.prototype.initializeStream = function(socketId) {
    // prepare a message stream
    let wrapper = {
        'socketId': socketId,
        'datetime': new Date()
    }
    this.channelWrappers[socketId] = wrapper
}

// shared instance
let instance

/**
 * Create a websocket instance for the application in general. This 
 * method takes a HttpServer instance from node that we can attach 
 * the websocket to. Returns the instance.
 * 
 * @param {*} http 
 */
module.exports.createInstance = (http, options) => {
    const opts = Object.assign({}, options)
    Array.from(['onconnection', 'onmessage', 'onpong', 'onclose']).forEach(key => {
        if (!opts[key] || typeof opts[key] !== 'function') opts[key] = () => {}
    })
    
    instance = new WebSocketController(http, opts)
    return instance
}

/**
 * Returns instance based on socket id
 */
module.exports.getInstance = (socketId) => {
    return instance.channelWrappers[socketId]
}