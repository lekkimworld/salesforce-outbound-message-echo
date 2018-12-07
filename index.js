const express = require('express')
let bodyparser = require('body-parser');
require('body-parser-xml-json')(bodyparser);

const app = express()
app.use(bodyParser.xml())
app.post('/outbound_message', (req, res) => {
    // log to console
    console.log(JSON.stringify(req.body))
    res.status(200).send({
        'status': 'OK'
    })
})

// listen
app.listen(process.env.PORT || 3000)