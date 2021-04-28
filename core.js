'use strict';

const
    leoProfanity = require('leo-profanity'),
    frenchBadwordsList = require('french-badwords-list'),
    carabistouilleLib = require('carabistouille-lib'),
    low = require('lowdb'),
    FileSync = require('lowdb/adapters/FileSync'),
    adapter = new FileSync('db.json'),
    db = low(adapter),
    child_process = require('child_process'),
    http = require('http')

const SPOT_COUNT = 4;
const VALHEIM_USERS = [
    '3415134521837990', // Kevin F
    '3766476136753936', // David
    '3821050254660840' // Zi
];
const NDP_USERS = [
    '3415134521837990', // Kevin F
    '3940601602653947', // Kevin C
    '3393304817435890' // Guigui
];

leoProfanity.add(frenchBadwordsList.array);

module.exports = {
    handleMessage: function (sender_psid, received_message) {
        let response;
        let received_text = received_message.text;
        if (received_text) {
            if (leoProfanity.check(received_text)) {
                response = repondToInsult();
            } else if (received_text.toLowerCase().includes('id')) {
                response = {"text": `Votre sender ID est ${sender_psid}`}
            } else if (isValheimUser(sender_psid)) {
                response = respondToTextValheim(received_text);
            } else {
                response = respondToText(received_text);
            }
        } else if (isNdpUser(sender_psid)) {
            response = repondToEmoji();
        }

        return response;
    },

    handlePostback: function (sender_psid, received_postback) {

        let response;
        // Get the payload for the postback
        let payload = received_postback.payload;

        // Set the response based on the postback payload
        if (payload === 'park') {
            let success = takeSpot(sender_psid);
            if (success) {
                let availableSpotCount = getAvailableSpotCount(sender_psid);
                response = {
                    "text": `Bienvenue, il reste ${availableSpotCount} places.`
                }
            } else {
                response = {
                    "text": `C'est impossible, il n'y a plus de places de disponibles.`
                }
            }
        } else if (payload === 'leave') {
            let success = leaveSpot(sender_psid);
            if (success) {
                let availableSpotCount = getAvailableSpotCount(sender_psid);
                response = {
                    "text": `Merci! Il reste maintenant ${availableSpotCount} places.`
                }
            } else {
                response = {
                    "text": `C'est impossible, toutes les places sont disponibles.`
                }
            }

        } else if (payload === 'info') {
            let availableSpotCount = getAvailableSpotCount(sender_psid);
            response = {
                "text": `Il reste ${availableSpotCount} places.`
            }
        } else if (payload === 'start') {
            response = startServer();
        } else if (payload === 'stop') {
            response = stopServer();
        }

        return response;
    },
}

function repondToInsult() {
    return {
        "text": carabistouilleLib.generateInsult()
    };
}

function respondToText(received_message) {
    return {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [{
                    "title": "Que souhaitez vous faire ?",
                    "buttons": [{
                        "type": "postback",
                        "title": "Me garer",
                        "payload": "park",
                    },
                        {
                            "type": "postback",
                            "title": "Partir",
                            "payload": "leave",
                        },
                        {
                            "type": "postback",
                            "title": "Obtenir des informations",
                            "payload": "info",
                        }
                    ],
                }]
            }
        }
    }
}

function respondToTextValheim(received_message) {
    let response;
    if (received_message.toLowerCase().includes('start')) {
        response = startServer()
    } else if (received_message.toLowerCase().includes('stop')) {
        response = stopServer()
    } else {
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Je ne comprends pas. Que souhaitez vous faire ?",
                        "buttons": [{
                            "type": "postback",
                            "title": "Démarrer le serveur",
                            "payload": "start",
                        },
                            {
                                "type": "postback",
                                "title": "Arrêter le serveur",
                                "payload": "stop",
                            }
                        ],
                    }]
                }
            }
        }
    }
    return response;
}

function repondToEmoji() {
    const options = {
        hostname: 'open.beerstorm.info',
        port: 80,
        path: '/open',
        method: 'POST'
    };
    const req = http.request(options, res => {
        res.on('data', d => {
            console.log("Opening the door");
        });
    });
    req.end();
    return {
        "text": "Sésame ouvre toi..."
    };
}

function getAvailableSpotCount() {
    return db.get('count').value();
}

function takeSpot(sender_psid) {
    var availableSpotCount = getAvailableSpotCount();
    if (availableSpotCount > 0) {
        db.update('count', n => n - 1)
            .write();
        return true;
    }
    return false;
}

function leaveSpot(sender_psid) {
    var availableSpotCount = getAvailableSpotCount();
    if (availableSpotCount < SPOT_COUNT) {
        db.update('count', n => n + 1)
            .write();
        return true
    }
    return false;
}

function isValheimUser(sender_psid) {
    return VALHEIM_USERS.includes(sender_psid);
}

function isNdpUser(sender_psid) {
    return NDP_USERS.includes(sender_psid);
}

function startServer() {
    child_process.exec("gcloud compute instances start valheim-server", (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
    return {"text": `Démarrage du serveur ...`};
}

function stopServer() {
    child_process.exec("gcloud compute instances stop valheim-server", (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
    return {"text": `Arrêt du server ...`};
}

