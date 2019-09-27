import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { spawn } from 'child_process'
import tk from 'tree-kill'
import '@/utils/globals'

import { applyEntries } from '@/utils'

const _onData = Symbol()
const _onError = Symbol()
const instances = new Set()

export const loadEcosystem = (env = '') => {
    const processes = {}
    applyEntries(processes, path.join(__dirname, 'ecosystem', env), '**/*.js')
    return processes
}

export const loadProcess = module => {
    const envs = ['root', ...process.env.MHY_ENVS.split(',')].reverse()
    let proc

    for (const env of envs) {
        const processMhyPath = path.join(__dirname, 'ecosystem', env, `${module}.js`)
        const processLocalPath = path.join(
            process.cwd(),
            process.env.MHY_LOCAL_DIR,
            'processes',
            'ecosystem',
            env,
            `${module}.js`
        )
        const processMhyExists = fs.existsSync(processMhyPath)
        const processLocalExists = fs.existsSync(processLocalPath)

        if (processLocalExists) {
            proc = require(processLocalPath)
            break
        } else if (processMhyExists) {
            proc = require(processMhyPath)
            break
        }
    }

    if (proc) {
        return proc
    }

    console.error(`Unknown process '${module}' for the environment of '${process.env.MHY_ENVS.replace(/,/g, ':')}'!`)
}

export const loadCommands = () => {
    applyEntries({}, path.join(__dirname, 'command'), '**/*.js')
    applyEntries({}, path.join(process.cwd(), process.env.MHY_LOCAL_DIR, 'processes', 'command'), '**/*.js')
}

const mhyArgvList = ['$0', '_', 'mhy-verbose', 'mhy-debug', 'mhy-prod', 'mhy-env']

export const buildMhyArgv = (argv, noFlags = []) => {
    argv = { ...argv }
    const mhyArgv = {}
    const argvKeys = Object.keys(argv)
    mhyArgvList.forEach(a => {
        let alreadySet = false
        if (argvKeys.includes(a)) {
            mhyArgv[a] = argv[a]
            delete argv[a]
            alreadySet = true
        }
        // Delete CC version also
        const cc = toCamelCase(a)
        if (argvKeys.includes(cc)) {
            if (!alreadySet) {
                mhyArgv[cc] = argv[cc]
            }
            delete argv[cc]
        }
    })
    const returnObj = {
        mhyArgv,
        argv,
        flags: argvToFlags(argv, mhyArgv, noFlags)
    }
    return returnObj
}

const argvToFlags = (argv, mhyArgv, noFlags = []) => {
    const [, ...names] = mhyArgv._
    return [
        ...Object.keys(argv).reduce((acc, k) => {
            if (noFlags.includes(k)) return acc
            acc.push(`--${k}`)
            if (argv[k] !== true) {
                acc.push(argv[k])
            }
            return acc
        }, []),
        ...names
    ]
}

const toCamelCase = str => str.replace(/\b-([a-z])/g, (_, char) => char.toUpperCase())

export default class Process extends EventEmitter {
    processes = new Map()

    constructor() {
        super()
        instances.add(this)
    }

    spawn(id, [bin, ...cmd], stdio, exitOnExit) {
        stdio = stdio || (process.env.MHY_ENV === 'ui' ? 'pipe' : 'inherit')

        if (process.env.MHY_VERBOSE) {
            console.log(`mhy verbose :: Command about to be run:`)
            console.log(`mhy verbose :: ${bin} ${cmd.join(' ')}`)
        }

        const p = spawn(bin, cmd, {
            shell: true,
            stdio
        })
        this.processes.set(id, p)
        p.stdout && p.stdout.on('data', this[_onData])
        p.stdout && p.stdout.on('error', this[_onError])
        p.stderr && p.stderr.on('data', this[_onData])
        p.stderr && p.stderr.on('error', this[_onError])
        p.on && p.on('data', this[_onData])
        p.on && p.on('error', this[_onError])

        if (process.env.MHY_ENV === 'cli') {
            p.on && signUpForExit(p, exitOnExit)
        }

        if (process.env.MHY_ENV === 'cli' && stdio === 'pipe') {
            this.on('data', d => console.log(d))
            this.on('err', d => console.error(d))
        }

        return p
    }

    [_onData] = line => {
        return this.log(line.toString('utf8').trim())
    }

    log(d, type = 'data') {
        this.emit(type, this.processLine(d))
    }

    [_onError] = line => {
        return this.log(line.toString('utf8').trim(), 'err')
    }

    processLine(d) {
        if (d.startsWith('mhy:ui:clear')) {
            this.emit(process.env.MHY_UI_ACTION, process.env.MHY_UI_ACTION_CLEAR)
            return ''
        }
        return d
    }

    run(name, props = {}) {
        const action = this.actions.find(({ name: n }) => n === name)
        this.emit(process.env.MHY_UI_ACTION, process.env.MHY_UI_ACTION_CLEAR)
        this.log(`{blue-fg}Running action ${name}{/blue-fg}`)
        action.onRun(action, props)
    }

    async kill(name) {
        const { pid } = this.processes.get(name)
        this.log(`{red-fg}Killing process ${name}{/red-fg}`)
        await new Promise(resolve => tk(pid, resolve))
        this.log(`{green-fg}Action ${name} killed successfully{/green-fg}`)
    }

    async clean() {
        for (const [, { pid }] of this.processes) {
            await new Promise(resolve => tk(pid, resolve))
        }
    }
}

// Cleanup handling (in case UI is used, it'll be caught there)
const exit = async (err, isErr = false) => {
    err && isNaN(err) && console.log(err)
    process.stdin.resume()

    for (const proc of instances) {
        await proc.clean()
    }

    // If it's `ui` but it is not initalized yet then we need to catch
    // initialization errors as CLI errors.
    if (process.env.MHY_ENV === 'cli' || !process.env.MHY_UI_SUCCESS) {
        if (!isNaN(err)) {
            process.exit(err)
        } else {
            if (isErr) {
                process.exit(1)
            }
            process.exit(0)
        }
    }
}

const signUpForExit = (p, exitOnExit = true) => {
    //do something when app is closing
    exitOnExit && p.on('exit', exit)

    //catches ctrl+c event
    p.on('SIGINT', exit)
    p.on('SIGTERM', exit)

    // catches "kill pid" (for example: nodemon restart)
    p.on('SIGUSR1', exit)
    p.on('SIGUSR2', exit)

    //catches uncaught exceptions
    p.on('uncaughtException', e => exit(e, true))
}

signUpForExit(process)
