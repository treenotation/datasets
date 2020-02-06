#! /usr/local/bin/node

const express = require("express")
const bodyParser = require("body-parser")
const exec = require("child_process").exec
const fs = require("fs")

class ServerApp {
  constructor(port = 7654, cwd = process.cwd(), hostname = "localhost", protocol = "http") {
    this._cwd = cwd.replace(/\/$/, "") + "/"
    this._port = port
    this._hostname = hostname
    this._protocol = protocol
    this._directories = ["misc", "owid"]
    this._commands = new Set("headers frequency count stats".split(" "))
    this._scanForFiles()
  }

  _scanForFiles() {
    const allFiles = new Set()

    this._directories.forEach(dir => {
      const files = fs.readdirSync(dir).filter(file => file !== ".DS_Store")
      files.forEach(filename => {
        allFiles.add(dir + "/" + filename)
      })
    })
    this._files = allFiles
  }

  getCwd() {
    return this._cwd
  }

  get app() {
    if (!this._app) this._initApp()
    return this._app
  }

  _pipeCommand(command, res) {
    console.log(command)
    exec(command).stdout.pipe(res)
  }

  _checkAndGetFileName(req, res) {
    const userFile = req.query.file
    if (!this._files.has(userFile)) {
      const msg = `${userFile} not found.`
      res.status(400).send(msg)
      throw new Error(msg)
    }
    return userFile
  }

  _getSiteMap() {
    const files = Array.from(this._files)
    const commands = Array.from(this._commands)

    return files
      .map(file => {
        return commands
          .map(command => {
            const link = `${command}?file=${file}`
            return `<a href="${link}">${link}</a>`
          })
          .join("<br>")
      })
      .join("<br>")
  }

  _initApp() {
    const app = express()
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*")
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
      next()
    })

    this._app = app
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())
    app.cwd = this.getCwd()

    app.get("/sample", (req, res) => {
      const fileName = this._checkAndGetFileName(req, res)
      const amount = req.query.howMany
      if (amount.match(/[^\d]/)) {
        return res.send("bad amount")
      }
      this._pipeCommand(`xsv sample ${amount} ${fileName}`, res)
    })

    app.get("/search", (req, res) => {
      const fileName = this._checkAndGetFileName(req, res)
      const query = req.query.query
      if (query.match(/[^\d\w]/)) {
        return res.send("bad query")
      }
      this._pipeCommand(`xsv search ${query} ${fileName}`, res)
    })

    this._directories.forEach(dir => {
      app.use(
        `/${dir}`,
        express.static(__dirname + "/" + dir, {
          maxAge: 31557600000
        })
      )
    })

    Array.from(this._commands).forEach(command => {
      app.get(`/${command}`, (req, res) => {
        const fileName = this._checkAndGetFileName(req, res)
        this._pipeCommand(`xsv ${command} ${fileName}`, res)
      })
    })

    app.get("/", (req, res) => res.send(this._getSiteMap()))

    return app
  }

  _getUrlBase() {
    return `${this._protocol}://${this._hostname}:${this._port}/`
  }

  start() {
    this.app.listen(this._port, () => {
      console.log(`Running ${this.constructor.name} in folder '${this.getCwd()}'. cmd+dblclick: ${this._getUrlBase()}`)
    })
  }
}

if (!module.parent) {
  const port = process.argv[2]
  const app = new ServerApp(port)
  app.start()
}

module.exports = { ServerApp }
