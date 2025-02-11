/**
 * The maze brain.
 */
"use strict"

// To parse the route from the url
import * as url from 'url'
import * as fs from 'fs'
import * as http from 'http'
import * as p from 'path';
import { readFile } from 'fs/promises';
const __filename = url.fileURLToPath(import.meta.url);

const __dirname = p.dirname(__filename);

// const url = require("url")
// const fs = require("fs")
// const http = require("http")

// A better router to create a handler for all routes
// const Router = require("./router")
import Router from './router.js'

let router = new Router()

let maps = []
let games = []



/**
 * Wrapper function for sending a response
 *
 * @param  Object        resObj  The response
 * @param  Object/String content What should be written to the response
 * @param  Integer       code    HTTP status code
 * @param  String        type    Content-Type of the response
 */
function sendResponse(resObj, content, code = 200, type = "json") {
    let contentType

    switch (type) {
        case "plain":
            contentType = {
                "Content-Type": "text/plain"
            }
            break

        case "html":
            contentType = {
                "Content-Type": "text/html"
            }
            break

        case "zip":
            contentType = {
                "Content-Type": "application/octet-stream"
            }
            break

        case "csv":
            contentType = {
                "Content-Type": "text/csv"
            }

            let temp = []
            let values = []

            for (let t in content) {
                if (t === "directions") {
                    for (let dir in content[t]) {
                        temp.push(dir)
                        values.push(content[t][dir])
                    }
                } else {
                    temp.push(t)
                    values.push(content[t])
                }
            }

            content = ""
            temp.forEach((t) => {
                content += t += ","
            })

            content = content.replace(/,$/g, "\n")
            values.forEach((t) => {
                content += t += ","
            })

            content = content.replace(/,$/g, "\n")
            break

        case "json":
            /* falls through */
        default:
            contentType = {
                "Content-Type": "application/json"
            }
            content = JSON.stringify(content)
            break
    }

    resObj.writeHead(code, contentType)
    resObj.write(content)
    resObj.end()
}



/**
 * Check that map is selected
 * @type {[type]}
 */
function checkIfGameIsActive(res, type, gameid) {
    if (!(games[gameid] !== undefined &&
        games[gameid].currentMap !== undefined &&
        games[gameid].currentMap !== null)
    ) {
        sendResponse(res, {
            "text": "Gameid not initialized correctly.",
            "hint": "Try initialize a new game through /."
        }, 500, type)
        return
    }
}



/**
 * Initialize the maze
 *
 * @param Object req The request
 * @param Object res The response
 */
router.get("/", (req, res) => {
    let type = req.query.type
    let gameid = ((String)(Math.random() * 100)).replace('.', '').substr(0, 5)
    let content = {
        text: "New game initialized.",
        gameid: gameid
    }

    console.log("Created new game with id " + gameid)

    games[gameid] = {
        currentMap: null,
        lastRoom: null
    }

    sendResponse(res, content, 200, type)
})



/**
 * Returns list of all avaliable maps
 *
 * @param Object req The request
 * @param Object res The response
 */
router.get("/map", (req, res) => {
    maps = fs.readdirSync(__dirname + "/maps")
    let type = req.query.type

    // Filter away all non json-files
    maps = maps.filter((map) => map.includes(".json"))
    console.log(maps)

    sendResponse(res, maps, 200, type)
})



/**
 * Loads the map to the maze
 *
 * @param Object req The request
 * @param Object res The response
 */
router.get("/:gameid/map/:map", (req, res) => {
    let map = req.params.map
    let gameid = req.params.gameid
    let type = req.query.type

    if (!map.endsWith(".json")) {
        map += ".json"
    }

    if (maps.length === 0)  {
        sendResponse(res, {
            "text": "Maps are not initialized.",
            "hint": "Initialize the maps through checking what maps are available through /map."
        }, 404, type)
        return
    }

    if (maps.indexOf(map) === -1)  {
        sendResponse(res, {
            "text": "Map not found.",
            "hint": "Check what maps are available through /map."
        }, 404, type)
        return
    }

    if (!(games[gameid] !== undefined &&
        games[gameid].currentMap !== undefined &&
        games[gameid].currentMap === null)
    ) {
        sendResponse(res, {
            "text": "Gameid not initalized correctly.",
            "hint": "Try initialize a new game through /."
        }, 500, type)
        return
    }

    let path = __dirname + "/maps/" + map
    let file = fs.readFileSync(`${path}`).toString()
    games[gameid].currentMap = JSON.parse(file)

    //console.log(games[gameid])

    sendResponse(res, {
        "text": "New map selected."
    }, 200, type)
})



/**
 * Gets content of first room
 * @param Object req The request
 * @param Object res The response
 */
router.get("/:gameid/maze", (req, res) => {
    let gameid = req.params.gameid
    let type = req.query.type

    checkIfGameIsActive(res, type, gameid)

    games[gameid].lastRoom = games[gameid].currentMap[0]

    sendResponse(res, games[gameid].lastRoom, 200, type)
})



/**
 * Gets info about the room
 * @param Object req The request
 * @param Object res The response
 */
router.get("/:gameid/maze/:roomId", (req, res) => {
    let gameid = req.params.gameid
    let type = req.query.type
    let id = req.params.roomId

    checkIfGameIsActive(res, type, gameid)

    games[gameid].current = games[gameid].currentMap[id]

    if (games[gameid].current === undefined) {
        sendResponse(res, {
            "text": "Room not found.",
            "hint": "Check your room id."
        }, 500, type)
        return
    }

    sendResponse(res, games[gameid].current, 200, type)
})



/**
 * Walks into next room from given roomId and gives the next rooms info.
 * @param Object req The request
 * @param Object res The response
 */
router.get("/:gameid/maze/:roomId/:direction", (req, res) => {
    let gameid = req.params.gameid
    let id = req.params.roomId
    let dir = req.params.direction
    let type = req.query.type
    let current
    let temp
    let lastRoom

    checkIfGameIsActive(res, type, gameid)

    current = games[gameid].currentMap[id]

    if (current.directions[dir] === undefined) {
        current.text = "Direction not allowed"
        sendResponse(res, current, 404, type)
        return
    }

    temp = games[gameid].lastRoom
    lastRoom = games[gameid].currentMap[current.directions[dir]]

    if (lastRoom === undefined) {
        lastRoom = temp
        current.text = "Path dont exist"
        sendResponse(res, current, 404, type)
        return
    }

    games[gameid].lastRoom = lastRoom
    sendResponse(res, lastRoom, 200, type)
})



/**
 * Create the server.
 */
let server = http.createServer((req, res) => {
    let ipAddress,
        route

    // Log incoming requests
    ipAddress = req.connection.remoteAddress

    // Check what route is requested
    route = url.parse(req.url).pathname
    console.log("Incoming route " + route + " from ip " + ipAddress)

    // Let the router take care of all requests
    router.route(req, res)
})


export default server
// module.exports = server
