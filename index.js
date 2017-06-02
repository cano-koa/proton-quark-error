const Quark = require('proton-quark')
const fs = require('fs')
const path = require('path')
module.exports = class QuarkError extends Quark {

  constructor(proton) {
    super(proton)
  }

  configure() {
    const QuarkError = function() {}
    global['QuarkError'] = QuarkError
  }

  validate() {
    // Nothing to do ....
  }

  initialize() {
    this._initializeExceptions()
  }

  _initializeExceptions() {
    const files = this._files
    for (let fileName in files) {
      const typesErrors = files[fileName]
      const { opts } = typesErrors
      const { className } = opts
      delete typesErrors.opts
      const ClassError = this._buildConstructor(typesErrors, opts)
      this._buildProcessMethod(ClassError)
      ClassError.prototype = new QuarkError()
      ClassError.prototype.constructor = ClassError
      global[className || fileName] = ClassError
    }
  }

  _buildConstructor(typesErrors, opts) {
    const quarkCtx = this
    return function (codeError, err='Message not specified.') {
      this._error = typeof err === 'string' ? new Error(err) : err
      const classCtx = this
      if (codeError !== 'unknownError') {
        for (let code in typesErrors) {
          if (codeError === code) {
            const { description, status } = typesErrors[code]
            quarkCtx._setDataError(classCtx, { description, status, code }, opts)
            break
          }
        }
      }
      if (!this.code) {
        quarkCtx._setAtUnknownError(this, opts)
      }
      quarkCtx._buildSetterAndGetter(this)
    }
  }

  _buildProcessMethod(ClassError) {
    ClassError.process = function(ctx, err) {
      if (!(err instanceof QuarkError))
        err = new ClassError('unknownError', err)
      ctx.status = err.status
      ctx.body = err.standarError
    }
  }

  _setAtUnknownError(ctx, opts={}) {
    this._setDataError(ctx, {}, opts)
  }

  _buildSetterAndGetter(ctx) {
    Object.defineProperty(ctx, 'standarError', { get: function() {
      return { description: ctx.description, code: ctx.code }
    }});
    Object.defineProperty(ctx, 'fullError', { get: function() {
      const { message } = ctx._error
      return Object.assign(ctx.standarError, { message })
    }});
  }

  _getDefaultOpts() {
    return {
      unknownError: {
        code: "unknownError",
        description: "Please contact the API provider for more information.",
        status: 400
      }
    }
  }

  _setDataError(ctx, data, userOpts={}) {
    Object.assign(ctx, this._getDefaultOpts().unknownError)
    if (userOpts.unknownError) {
      Object.assign(ctx, this._getAvailableFields(userOpts.unknownError))
    }
    Object.assign(ctx, this._getAvailableFields(data))
  }

  _getAvailableFields(data) {
    const { code, description, status } = data
    const result = {}
    if (code) Object.assign(result, { code })
    if (description) Object.assign(result, { description })
    if (status) Object.assign(result, { status })
    return result
  }

  get _files() {
    const files = path.join(this.proton.app.path, '/errors')
    return fs.existsSync(files) ? require('require-all')(files) : {}
  }
}
