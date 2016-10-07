var server = require('http').createServer(),
    url = require('url'),
    WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({
        server: server
    }),
    express = require('express'),
    app = express(),
    router = express.Router(),
    port = 3000,
    path = require('path'),
    os = require('os'),
    CSV = require('comma-separated-values'),
    fs = require('fs');

//const fs = require('fs')
const low = require('lowdb');
const fileAsync = require('lowdb/lib/file-async');

// Start database using file-async storage
const db = low();

db.defaults({
        lectures: []
    })
    .value();

// setup express middleware //
app.use(router);
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Router //
router.use(function(req, res, next) {
    // .. some logic here .. like any other middleware
    next();
});

router.get('/', function(req, res) {
    res.render('index');
});

router.get('/view', function(req, res) {
    res.render('view');
});

router.get('/sendFile', function(req, res) {
    //processData();
    console.log('send file');
    res.download(__dirname + '/data.csv', 'data.csv');
});

function processData() {
    const rawData = low('data.json', {
        storage: fileAsync,
        writeOnChange: false
    });
    rawData.defaults({
            lectures: []
        })
        .value();
    rawData.set('lectures', [])
        .value();
    db.get('lectures')
        .forEach(function(value) {
            var parsed = JSON.parse(value.lectures);
            for (i = 0; i < 5; i++) {
                rawData.get('lectures')
                    .push({
                        cont: parsed.lectures[(8 * i) + 7],
                        accX: parsed.lectures[(8 * i) + 0],
                        accY: parsed.lectures[(8 * i) + 1],
                        accZ: parsed.lectures[(8 * i) + 2],
                        gyroX: parsed.lectures[(8 * i) + 3],
                        gyroY: parsed.lectures[(8 * i) + 4],
                        gyroZ: parsed.lectures[(8 * i) + 5],
                        millis: parsed.lectures[(8 * i) + 6],
                        id: parsed.ID
                    })
                    .value();
            }
        })
        .value();
    rawData.write();
    jsonData = rawData.getState();
    var csvData = new CSV(jsonData.lectures, {
        header: true
    }).encode();
    console.log(csvData);
    fs.writeFile('data.csv', csvData, function(err) {
        if (err) {
            return console.log(err);
        }
        console.log("the file was saved");
    });
}

//------ web sockets ------//
//list of clients and sensors
var clients = [];
var sensors = [];
var saving = false;

wss.on('connection', function connection(ws) {
    var location = url.parse(ws.upgradeReq.url, true);
    console.log(ws.protocol);
    if (ws.protocol == "client") {
        console.log("agregar navegador");
        clients.push(ws);
    } else {
        console.log("agregar esp8266");
        sensors.push(ws);
    }
    // you might use location.query.access_token to authenticate or share sessions
    // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

    ws.on('message', function incoming(message) {
        //console.log('received: %s', message);
        if (message == "startPreview") {
            sensors.forEach(function(sensor) {
                sensor.send(message, function ack(error) {
                    // if error is not defined, the send has been completed,
                    // otherwise the error object will indicate what failed.
                });
            });
        } else if (message == "stopPreview") {
            sensors.forEach(function(sensor) {
                sensor.send(message, function ack(error) {
                    // if error is not defined, the send has been completed,
                    // otherwise the error object will indicate what failed.
                });
            });
        } else if (message == "calibrate") {
            sensors.forEach(function(sensor) {
                sensor.send(message, function ack(error) {
                    // if error is not defined, the send has been completed,
                    // otherwise the error object will indicate what failed.
                });
            });
        } else if (message == "startSaving") {
            saving = true;
            db.set('lectures', [])
                .value();
        } else if (message == "stopSaving") {
            saving = false;
            processData();
        } else {
            clients.forEach(function(client) {
                client.send(message, function ack(error) {
                    // if error is not defined, the send has been completed,
                    // otherwise the error object will indicate what failed.
                });
            });
            if (saving) {
                db.get('lectures')
                    .push({
                        lectures: message
                    })
                    .value();
            }
        }
    });
});

//------ server declaration ------//
server.on('request', app);
server.listen(port, rdy);

function rdy() {
    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    console.log('Listening on ' + addresses[0] + ':' + server.address().port);
}