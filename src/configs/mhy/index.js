import path from 'path'
import fs from 'fs'

import { loadConfig } from '@/utils'

const mhyConfig = loadConfig('mhy', {
    defaultIndexHtml: path.resolve(__dirname, '../..', 'resources', 'index.html'),
    get indexHtml() {
        const projectIndexHtml = path.resolve(process.cwd(), this.srcFolder, 'index.html')
        return fs.existsSync(projectIndexHtml) ? projectIndexHtml : this.defaultIndexHtml
    },
    srcFolder: 'src',
    distFolder: 'dist',
    buildFolder: 'build',
    defaultIgnoreList: [
        'logs',
        '*.log',
        'npm-debug.log*',
        'yarn-debug.log*',
        'yarn-error.log*',
        'pids',
        '*.pid',
        '*.seed',
        '*.pid.lock',
        'lib-cov',
        'coverage',
        '.nyc_output',
        '.grunt',
        'bower_components',
        '.lock-wscript',
        'build/Release',
        'jspm_packages',
        'typings',
        '.npm',
        '.eslintcache',
        '.node_repl_history',
        '*.tgz',
        '.yarn-integrity',
        '.env',
        '.next',
        '.idea',
        '.vscode',
        'node_modules',
        '.babelrc',
        'prettier.json',
        '.prettierrc',
        'jest.config.js',
        '.eslintrc',
        'tsconfig.json',
        'webpack.config.js',
        '.tsbuildinfo'
    ],
    get defaultAliases() {
        const pr = path.resolve
        const src = this.srcFolder
        const cwd = process.cwd()
        return {
            '@': pr(cwd, `${src}/`),
            '@/mhy': pr(__dirname, '../../') // dist
        }
    },
    ecosystem: ['webpack-dev-server', 'tsc', 'jest', 'storybook-start']
})

export default mhyConfig
