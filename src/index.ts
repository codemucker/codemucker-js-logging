/**
 * A browser/node/deno compatible logging library that logs to the console. Justification for yet another logging lib? All the others threw errors in either the browser, node or deno so one always
 * had to choose a different logging lib depending on the target. Maybe there is a better alternative to this at which point this becomes obsolete
 */

const consolDebug = console.debug
const consoleInfo = console.info
const consoleWarn = console.warn
const consoleError = console.error
const captureConsole = false

export enum LogLevel {
  TRACE = 1,
  DEBUG = 2,
  INFO = 3,
  WARN = 4,
  ERROR = 5,
  FATAL = 6,
  OFF = 7,
}

const cfg = {
  quiet: false,
  defaultLevel: LogLevel.INFO,
}

function logInternal(msg: string, ...args: any) {
  if (!cfg.quiet) {
    console.log(`[logger.internal] ${msg}`, args)
  }
}

export type Level = LogLevel | string

const nameToLevel: { [name: string]: LogLevel } = {
  trace: LogLevel.TRACE,
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  fatal: LogLevel.FATAL,
  off: LogLevel.OFF,
}

const levelToName = {
  [LogLevel.TRACE]: 'TRACE',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.WARN]: ' WARN',
  [LogLevel.INFO]: ' INFO',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
  [LogLevel.OFF]: '  OFF',
}

function convertLevelToName(level: Level): string {
  if (typeof level === 'string') {
    return level
  }
  return levelToName[level]
}

function parseLevel(
  levelName: string,
  defaultLevel: LogLevel = cfg.defaultLevel
): LogLevel {
  return nameToLevel[(levelName || '').toLowerCase()] || defaultLevel
}

const processLogLevel =
  process.env.VUE_APP_LOG_LEVEL || process.env.APP_LOG_LEVEL

if (processLogLevel) {
  cfg.defaultLevel = parseLevel(processLogLevel)
}

export function setLogOptions(opts: { level?: string; quiet?: boolean }) {
  if (opts.quiet != undefined) {
    cfg.quiet = opts.quiet
  }
  if (opts.level != undefined) {
    cfg.defaultLevel = parseLevel(opts.level)
  }
}

class LogContext {
  public data: any[] = []
  logString = ''

  push(info: any) {
    this.data.push(info)
    this.updateLogString()
  }

  pop(info: any) {
    this.data = this.data.filter((obj) => obj !== info)
    this.updateLogString()
  }

  private updateLogString() {
    this.logString = this.data.map((obj) => `${obj}`).join()
  }

  hasItems() {
    return this.data.length > 0
  }

  toLogString() {
    return this.logString
  }
}

let logCtxt = new LogContext()

export function logContext(ctxt: any, func: Function) {
  try {
    pushContext(ctxt)
    func()
  } finally {
    popContext(ctxt)
  }
}

export function pushContext(ctxt: any) {
  logCtxt.push(ctxt)
}

export function popContext(ctxt: any) {
  logCtxt.pop(ctxt)
}

export interface Logger {
  level: Level
  isOff(): boolean
  isEnabled(): boolean
  isTraceEnabled(): boolean
  isDebugEnabled(): boolean
  isInfoEnabled(): boolean
  isWarnEnabled(): boolean
  isErrorEnabled(): boolean
  isFatalEnabled(): boolean
  isLevelEnabled(level: LogLevel): boolean

  trace(msg: any, ...args: any[]): void
  debug(msg: any, ...args: any[]): void
  info(msg: any, ...args: any[]): void
  warn(msg: any, ...args: any[]): void
  error(msg: any, ...args: any[]): void
  fatal(msg: any, ...args: any[]): void

  log(level: LogLevel, msg: string, ...args: any[]): void
  getLogger(childName: string): Logger
}

export interface LogFormatter {
  format(event: LogEvent, logCtxt: LogContext): string
}

export interface LogAppender {
  append(event: LogEvent, logCtxt: LogContext): void
}

class SimpleLogFormatter implements LogFormatter {
  format(event: LogEvent, logContext: LogContext): string {
    const levelName = levelToName[event.level]
    const parts: string[] = [`[${levelName}]`]

    if (logContext.hasItems()) {
      parts.push(` [${logContext.logString}]`)
    }
    if (event.tags) {
      parts.push(` [${event.tags.join(' ')}]`)
    }
    parts.push(` ${event.logName} - ${event.msg}`)
    return parts.join('')
  }
}

class ConsoleLogAppender implements LogAppender {
  private formatter: LogFormatter

  constructor(formatter: LogFormatter) {
    this.formatter = formatter
  }

  append(event: LogEvent, logCtxt: LogContext): void {
    const line = this.formatter.format(event, logCtxt)

    let log = console.log
    if (event.level <= LogLevel.DEBUG) {
      log = captureConsole ? consolDebug : console.log
    } else if (event.level == LogLevel.INFO) {
      log = captureConsole ? consoleInfo : console.info
    } else if (event.level == LogLevel.WARN) {
      log = captureConsole ? consoleWarn : console.warn
    } else {
      //TODO:generate a stacktrace without the logger code stack
      log = captureConsole ? consoleError : console.error
    }

    log(line, ...event.args)
  }
}

export interface LogEvent {
  logName: string
  level: LogLevel
  msg: string
  args: any[]
  tags?: string[]
}

class LoggerImpl implements Logger {
  private name: string
  _level: LogLevel | null
  private parent: LoggerImpl | null
  private appender: LogAppender | null
  private tags: string[] | undefined

  constructor(
    name: string,
    level: LogLevel | null,
    appender: LogAppender | null,
    parent: LoggerImpl | null
  ) {
    this.name = name
    this._level = level
    this.parent = parent
    this.appender = appender
  }

  set level(level: Level) {
    if (typeof level === 'string') {
      level = parseLevel(level)
    }
    this._level = level
  }

  get level(): Level {
    return this._level
      ? this._level
      : this.parent
      ? this.parent.level
      : LogLevel.OFF
  }
  isTraceEnabled(): boolean {
    return this.isLevelEnabled(LogLevel.TRACE)
  }
  isDebugEnabled(): boolean {
    return this.isLevelEnabled(LogLevel.DEBUG)
  }
  isInfoEnabled(): boolean {
    return this.isLevelEnabled(LogLevel.INFO)
  }
  isWarnEnabled(): boolean {
    return this.isLevelEnabled(LogLevel.WARN)
  }
  isErrorEnabled(): boolean {
    return this.isLevelEnabled(LogLevel.ERROR)
  }
  isFatalEnabled(): boolean {
    return this.isLevelEnabled(LogLevel.FATAL)
  }
  isOff(): boolean {
    return this.isLevelEnabled(LogLevel.OFF)
  }
  isEnabled(): boolean {
    return !this.isOff
  }
  isLevelEnabled(level: LogLevel): boolean {
    return this.level <= level
  }
  trace(msg: any, ...args: any[]) {
    this.log(LogLevel.TRACE, msg, args)
  }
  debug(msg: any, ...args: any[]) {
    this.log(LogLevel.DEBUG, msg, args)
  }
  info(msg: any, ...args: any[]) {
    this.log(LogLevel.INFO, msg, args)
  }
  warn(msg: any, ...args: any[]) {
    this.log(LogLevel.WARN, msg, args)
  }
  error(msg: any, ...args: any[]) {
    this.log(LogLevel.ERROR, msg, args)
  }
  fatal(msg: any, ...args: any[]) {
    this.log(LogLevel.FATAL, msg, args)
  }

  log(level: LogLevel, msg: string, ...args: any[]): void {
    if (this.isLevelEnabled(level)) {
      this.logEvent({
        logName: this.name,
        msg: msg,
        args: args,
        level: level,
        tags: this.tags,
      })
    }
  }

  private logChildEvent(childLogEvent: LogEvent): void {
    let logEvent = childLogEvent
    if (this.tags) {
      logEvent = {
        ...logEvent,
        tags: logEvent.tags ? [...this.tags, ...logEvent.tags] : this.tags,
      }
    }
    this.logEvent(logEvent)
  }

  private logEvent(logEvent: LogEvent): void {
    if (this.appender) {
      try {
        this.appender.append(logEvent, logCtxt)
      } catch (err) {
        logInternal('Error invoking appender', { cause: err })
      }
    } else if (this.parent) {
      this.parent.logChildEvent(logEvent)
    }
  }

  getLogger(childName: string): Logger {
    return new LoggerImpl(
      `${this.name}.${childName}`,
      /*level*/ null,
      /*appender*/ null,
      this
    )
  }
}

export class LoggerFactory {
  private DEFAULT_FORMATTER = new SimpleLogFormatter()
  private DEFAULT_APPENDER = new ConsoleLogAppender(this.DEFAULT_FORMATTER)
  private DEFAULT_LEVEL = cfg.defaultLevel
  private DEFAULT_NAME = 'app'

  private _level: LogLevel = this.DEFAULT_LEVEL
  private _appender!: LogAppender | null
  private _rootName!: string | null

  private rootLogger = new LoggerImpl(
    this._rootName || this.DEFAULT_NAME,
    this._level || this.DEFAULT_LEVEL,
    this._appender || this.DEFAULT_APPENDER,
    null
  )

  set level(level: Level | undefined) {
    const existing = this.rootLogger.level
    this.rootLogger.level = level || this.DEFAULT_LEVEL
    if (existing != this.rootLogger.level) {
      // need to read it after as an invalid level might result in defaults
      logInternal(
        `Default log level changed from ${convertLevelToName(
          existing
        )} to ${convertLevelToName(this.rootLogger.level)}`
      )
    }
  }

  set rootName(name: string) {
    this._rootName = name
  }

  getLogger(name: string): Logger {
    return this.rootLogger.getLogger(name)
  }
}

let loggerFactory: LoggerFactory | undefined = undefined

function getOrCreateLogFactory() {
  if (!loggerFactory) {
    loggerFactory = new LoggerFactory()
    logInternal(`default log level is ${levelToName[cfg.defaultLevel]}`)
  }
  return loggerFactory
}

export function getLogger(name: string): Logger {
  return getOrCreateLogFactory().getLogger(name)
}

export function setLogLevel(level?: string): void {
  getOrCreateLogFactory().level = level
  levelSet = true
}

let levelSet = false
export function setLogLevelIfUnset(level?: string): void {
  if (levelSet) {
    return
  }
  setLogLevel(level)
}

export default getLogger
