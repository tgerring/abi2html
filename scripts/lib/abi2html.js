"use strict";

var OperatorEnum = {
    Eq: '=',
    Neq: '<>',
    GT: '>',
    GTEq: '>=',
    LT: '<',
    LTEq: '<=',
    Contain: 'contains'
}

var AbiHtml = function(obj) {
    var abi

    if (typeof obj === 'string') {
        if (obj.trim().substring(0, 1) == '[') {
            // looks like ABI string
            abi = JSON.parse(obj)
        } else {
            // otherwise regex
            abi = this.FromRegex(obj)
            this.source = obj
        }
    } else if (typeof abiString === 'object') {
        // assume is completed ABI object
        abi = obj
    }

    if (abi) this.constructor(abi)
}

AbiHtml.prototype.constructor = function(abi) {
    // sanity check
    if (abi == null || !abi instanceof Array) return null

    // set properties
    this.abi = abi
    this.contract = web3.eth.contract(abi)
    this.functions = []
    this.events = []

    // loop through abi and create according functions and events
    for (var i = 0; i < abi.length; i++) {
        var abiItem = abi[i]

        if (typeof abiItem !== "object") continue
        if (!("type" in abiItem)) continue

        // it's not currently possible to store a subset of the contract so we store the whole thing
        var item
        switch (abiItem.type) {
            case 'function':
                item = new EvmFunction(abiItem)
                item.contract = this.contract
                this.functions[abiItem.name] = item
                break
            case 'event':
                item = new EvmEvent(abiItem)
                item.contract = this.contract
                this.events[abiItem.name] = item
                break
            case 'constructor':
                item = new EvmConstructor(abiItem)
                item.contract = this.contract
                this.init = item
                break
            default:
                console.log('Unknown field type', abiItem.name, abiItem.type)
        }

    }
}

AbiHtml.prototype.inArray = function(array, id) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] === id) return true
    }
    return false
}

AbiHtml.prototype.FromRegex = function(str) {
    var re = /(?:(function|event)\s*)(\w+)\s*\((|(?:(?:,|\s*)?\w+(?:\[\])? \w+\s*)+)\)((?:\s+(?!returns\s*?)(?:\w+(?:\(.+\))?))*)(?:\s+returns\s*?\((|(?:(?:,|\s*)?(?:\w+(?:\[\])? )?\w+\s*)+)\))?/g

    var abi = []
    var match
    while (match = re.exec(str)) {
        var abiItem = {
            type: match[1],
            name: match[2]
        }

        var modifiers = match[4].split(' ')
        if (abiItem.type === 'event') abiItem.anonymous = this.inArray(modifiers, 'anonymous')
        if (abiItem.type === 'function') abiItem.constant = this.inArray(modifiers, 'constant')

        abiItem.inputs = this.makeInputs(match[3])
        abiItem.outputs = this.makeOutputs(match[5])

        abi.push(abiItem)
    }

    this.constructor(abi)
    return abi
}

AbiHtml.prototype.RenderTree = function() {
    var cdiv = document.createElement('div')
    cdiv.innerHTML = 'Constructor: '
    var cons = this.init

    var ci = document.createElement('ul')
    ci.classList.add('abi', 'constructor', 'input')
    if (cons && 'inputs' in cons) {

        cons.inputs.forEach(function(field) {
            var cil = document.createElement('li')
            cil.classList.add('abi', 'constructor', 'input', field.type)
            cil.innerHTML = field.type + ' ' + field.name
            ci.appendChild(cil)
        })
        cdiv.appendChild(ci)
    }

    var fdiv = document.createElement('div')
    fdiv.innerHTML = 'Functions: '
    var ful = document.createElement('ul')
    for (name in this.functions) {
        var func = this.functions[name]
        var f = document.createElement('li')
        var fspan = document.createElement('span')
        fspan.classList.add('abi', 'function')
        fspan.innerHTML = func.name
        if (func.constant) {
            var icon = document.createElement('span')
            icon.innerHTML = ' <dfn title="Constant">&#8594;</dfn>'
            icon.className = 'indexed'
            fspan.appendChild(icon)
        }
        f.appendChild(fspan)


        var fi = document.createElement('ul')
        fi.classList.add('abi', 'function', 'input')
        func.inputs.forEach(function(field) {
            var fil = document.createElement('li')
            fil.classList.add('abi', 'function', 'input', field.type)
            fil.innerHTML = field.type + ' ' + field.name
            fi.appendChild(fil)
        })
        f.appendChild(fi)

        var fo = document.createElement('ul')
        fo.classList.add('abi', 'function', 'output')
        func.outputs.forEach(function(field) {
            var fol = document.createElement('li')
            fol.classList.add('abi', 'function', 'output')
            fol.innerHTML = field.type + ' ' + field.name
            fo.appendChild(fol)
        })
        f.appendChild(fo)

        ful.appendChild(f)
    }
    fdiv.appendChild(ful)

    var ediv = document.createElement('div')
    ediv.innerHTML = 'Events: '
    var eul = document.createElement('ul')
    for (name in this.events) {
        var ev = this.events[name]
        var e = document.createElement('li')
        var espan = document.createElement('span')
        espan.classList.add('abi', 'event')
        espan.innerHTML = ev.name
        e.appendChild(espan)

        var ei = document.createElement('ul')
        ei.classList.add('abi', 'event', 'input')
        ev.inputs.forEach(function(field) {
            var eil = document.createElement('li')
            eil.classList.add('abi', 'event', 'input', field.type)
            eil.innerHTML = field.type + ' ' + field.name
            if (field.indexed) {
                var icon = document.createElement('span')
                icon.innerHTML = ' <dfn title="Indexed">&#8623;</dfn>'
                icon.className = 'indexed'
                eil.appendChild(icon)
            }
            ei.appendChild(eil)
        })
        e.appendChild(ei)

        eul.appendChild(e)
    }

    ediv.appendChild(eul)

    var div = document.createElement('div')
    div.appendChild(cdiv)
    div.appendChild(fdiv)
    div.appendChild(ediv)
    return div
}

AbiHtml.prototype.makeInputs = function(inputSig) {
    if (!inputSig || typeof inputSig !== 'string' || inputSig.trim().length === 0) return []

    var result = []
    var inputs = inputSig.split(',')
    inputs.forEach(function(v) {
        var words = v.trim().split(' ')
        var field = {
            type: null,
            name: null
        }
        switch (words.length) {
            case 1:
                field.type = words[0]
                field.name = ''
                break
            case 2:
                field.type = words[0]
                field.name = words[1]
                break
            case 3:
                field.type = words[0]
                field.name = words[2]
                if (words[1] === 'indexed') field.indexed = true
                else field.indexed = false
        }
        result.push(field)
    })
    return result
}

AbiHtml.prototype.makeOutputs = function(outputSig) {
    if (!outputSig || typeof outputSig !== 'string' || outputSig.trim().length === 0) return []

    var result = []
    var outputs = outputSig.split(',')
    outputs.forEach(function(v) {
        var words = v.trim().split(' ')
        var field = {
            type: null,
            name: null
        }
        switch (words.length) {
            case 1:
                field.type = words[0]
                field.name = ''
                break
            case 2:
                field.type = words[0]
                field.name = words[1]
        }
        result.push(field)
    })
    return result
}

AbiHtml.prototype.GetAllEvents = function(options, filterFields, cb) {
    var that = this
    this.contract.at(options.address).allEvents({
        fromBlock: 'earliest',
        toBlock: 'latest'
    }, function(err, results) {
        var evmEvent = that.events[results.event]
        evmEvent.err = err
        evmEvent.results = results
        for (var i = 0; i < evmEvent.inputs.length; i++) {
            var field = evmEvent.inputs[i]

            // if we have a value for a given field, store it
            if (results && "args" in results && field.getName() in results.args)
                field.setValue(results.args[field.getName()])
        }
        if (typeof cb == "function") cb(evmEvent)
    })
}

AbiHtml.prototype.GetEventLogs = function(options, shouldWatch, callback) {
    for (var name in this.events) {
        var ev = this.events[name]

        if (shouldWatch)
            ev.Watch({
                address: options.to
            }, {}, callback)
        else
            ev.Get({
                address: options.to
            }, {}, callback)

    }

}

AbiHtml.prototype.GetConstructor = function() {
    return this.init
}

AbiHtml.prototype.GetEventLogsByName = function(name, options, filterFields, cb) {
    this.events[name].Get(options, filterFields, cb)
}

AbiHtml.prototype.WatchAllEvents = function(options, filterFields, cb) {
    for (var name in this.events) {
        var item = this.events[name]

        item.StopWatching()
        item.Watch(options, filterFields, cb)
    }
}

AbiHtml.prototype.GetEventByName = function(name) {
    if (name in this.events)
        return this.events[name]
}

// AbiHtml.prototype.GetFunctionsRendered = function(options, cb) {
//     for (var name in this.functions) {
//         this.functions[name].DefaultRenderer(options, cb)
//     }
// }

AbiHtml.prototype.GetFunction = function(name) {
    if (name in this.functions)
        return this.functions[name]
}

AbiHtml.prototype.GetFunctionsSorted = function() {
    // put functions into a sorted collection
    var funcs = []
    for (var name in this.functions) {
        funcs.push(this.functions[name])
    }
    // sort alphanumerically
    funcs.sort(function(a, b) {
        if (a.name < b.name) return -1
        if (a.name > b.name) return 1
        return 0
    })

    return funcs
}

AbiHtml.prototype.GetEventsSorted = function() {
    // put functions into a sorted collection
    var evs = []
    for (var name in this.events) {
        evs.push(this.events[name])
    }
    // sort alphanumerically
    evs.sort(function(a, b) {
        if (a.name < b.name) return -1
        if (a.name > b.name) return 1
        return 0
    })

    return evs
}

AbiHtml.prototype.GetInitFunction = function() {
    return this.init
}

AbiHtml.prototype.checkReceipt = function(txhash, callback) {
    var receipt = web3.eth.getTransactionReceipt(txhash)
    if (!receipt) {
        var that = this
        setTimeout(function(txhash, callback) {
            that.checkReceipt(txhash, callback)
        }, 3000, txhash, callback)
    } else {
        callback(null, receipt)
    }

}
AbiHtml.prototype.checkTransaction = function(txhash, callback) {
    var tx = web3.eth.getTransaction(txhash)
    if (!tx.blockHash) {
        var that = this
        setTimeout(function(txhash, callback) {
            that.checkTransaction(txhash, callback)
        }, 3000, txhash, callback)
    } else {
        callback(null, tx)
    }

}

AbiHtml.prototype.sendTransaction = function(options, callback) {
    web3.eth.sendTransaction(options, function(error, txhash) {
        if (!error) checkReceipt(txhash, callback)
        else callback(error, null)
    })
}

"use strict";

var EvmConstructor = function(abiItem) {
    if (typeof abiItem !== "object") return null
    if (!("type" in abiItem) || abiItem.type != "constructor") return null

    this.abi = abiItem
    this.name = 'Constructor'
    this.type = abiItem.type
    this.inputs = []
    this.outputs = []
    this.error = undefined

    for (var i = 0; i < abiItem.inputs.length; i++) {
        var field = new SolField(abiItem.inputs[i])
        this.inputs[i] = field
    }

}



EvmConstructor.prototype.makeFieldForm = function(callCallback, transactCallback) {
    var div = document.createElement('div')
    div.className = ['constructor'].join(' ')
    div.id = 'constructor' + this.name

    // generate inputs with html id
    if (this.inputs.length > 0) {
        var fsi = document.createElement('fieldset')
        fsi.className = 'inputs'

        var leg = document.createElement('legend')
        leg.innerHTML = 'Inputs'
        fsi.appendChild(leg)

        this.inputs.forEach(function(field) {
            field.setHtmlId(['constructor', field.name, 'input'].join('-'))
            fsi.appendChild(field.DefaultRenderer(true))
        })

    }

    // // generate outputs with htmlid
    // if (this.outputs.length > 0) {
    //     var fso = document.createElement('fieldset')
    //     fso.className = 'outputs'

    //     var leg = document.createElement('legend')
    //     leg.innerHTML = 'Outputs'
    //     fso.appendChild(leg)

    //     this.outputs.forEach(function(field) {
    //         field.setHtmlId(['function', this.name, 'output'].join('-'))
    //         fso.appendChild(field.DefaultRenderer(false))
    //     })

    // }

    // // display call button when we the function has output fields
    // if (this.outputs.length > 0) {
    //     var btn = document.createElement('button')
    //     btn.type = 'button'
    //     btn.innerHTML = 'Call'
    //     var that = this
    //     btn.addEventListener('click', function() {
    //         callCallback(that)
    //     })
    //     div.appendChild(btn)
    // }

    // if (!this.constant) {
    //     var tbtn = document.createElement('button')
    //     tbtn.type = 'button'
    //     tbtn.innerHTML = 'Transact'
    //     var that = this
    //     tbtn.addEventListener('click', function() {
    //         transactCallback(that)
    //     })
    //     div.appendChild(tbtn)
    // }

    if (this.inputs.length > 0)
        div.appendChild(fsi)
    if (this.outputs.length > 0)
        div.appendChild(fso)

    return div
}

"use strict";

var EvmEvent = function(abiItem) {
    // sanity checks
    if (typeof abiItem !== "object") return null
    if (!("name" in abiItem)) return null
    if (!("type" in abiItem) || abiItem.type != "event") return null

    // set properties
    this.abi = abiItem
    this.name = abiItem.name
    this.type = abiItem.type
    this.anonymous = (abiItem.anonymous ? abiItem.anonymous : false)
    this.inputs = []
    this.error = undefined

    // Event values exist as inputs
    // Assemble inputs as SolFields
    for (var i = 0; i < abiItem.inputs.length; i++) {
        this.inputs[i] = new SolField(abiItem.inputs[i])
    }

    this.loadedLogs = []

}

EvmEvent.prototype.GetInputByName = function(name) {
    for (var i = 0; i < this.inputs.length; i++) {
        var field = this.inputs[i]
        if (field.name === name) return this.inputs[i]
    }
}


EvmEvent.prototype.StopWatching = function() {
    if (this.filter) {
        this.filter.stopWatching()
    }
}


EvmEvent.prototype.Watch = function(userOptions, filterFields, cb) {
    var params = []

    // set transaction options with defaults
    var filterOptions = {
        address: (userOptions.address ? userOptions.address : ''),
        fromBlock: (userOptions.fromBlock ? userOptions.fromBlock : 'latest'),
        toBlock: (userOptions.toBlock ? userOptions.toBlock : 'latest')
    }
    params.push(filterOptions);

    // add empty filterfields if none provided
    if (!filterFields)
        params.push({})
    else
        params.push(filterFields)


    // get instance of contract
    var contract = this.contract.at(filterOptions.address)
    var func = contract[this.ev.name]
    this.filter = func.apply(func, params)

    // if filter was created successfully
    if (this.filter) {
        var abi = this.abi
        this.filter.watch(function(err, result) {
            var ev = new EvmEvent(abi)

            if (err) {
                ev.error = err
            } else {
                ev.result = result

                // if we have results
                if (result && "args" in result && result.args.length > 0)

                // event fields are represented as inputs
                // loop through event inputs
                    for (var i = 0; i < ev.inputs.length; i++) {
                    var field = ev.inputs[i]

                    // if the field appears in the results, set its value
                    // assumes that results is keyed on the name of the field
                    if (field.name in result.args)
                        field.setValue(result.args[field.name])
                }
            }

            // if a callback was given, send the resulting EvmEvent to it
            if (typeof cb === "function") cb(ev)
        })
    } else {
        throw "Could not create filter"
    }
}

EvmEvent.prototype.FetchLogs = function(userOptions, filterFields, cb) {
    var params = []

    // set filter fields first
    // TODO need to only push those that are indexes as topics?
    if (!filterFields)
        params.push({})
    else
        params.push(filterFields)

    // set transaction options with defaults
    var filterOptions = {
        address: (userOptions.address ? userOptions.address : ''),
        fromBlock: (userOptions.fromBlock ? userOptions.fromBlock : 'earliest'),
        toBlock: (userOptions.toBlock ? userOptions.toBlock : 'latest')
    }
    params.push(filterOptions);

    // get instance of contract
    var contract = this.contract.at(filterOptions.address)
    var func = contract[this.name]
    this.filter = func.apply(func, params)

    if (this.filter) {
        this.loadedLogs.length = 0

        // instead of modifying & returning a copy of this for each event
        // manufacture & callback new evmevent. return loaded logs
        var that = this
        this.filter.get(function(err, results) {
            for (var r = 0; r < results.length; r++) {
                var result = results[r]
                var ev = new EvmEvent(that.abi)
                if (err) ev.error = err

                // if we have results
                if (result && "args" in result) {
                    ev.result = result

                    // event fields are represented as inputs
                    // loop through event inputs
                    for (var i = 0; i < ev.inputs.length; i++) {
                        var field = ev.inputs[i]

                        // if the field appears in the results, set its value
                        // assumes that results is keyed on the name of the field
                        if (field.name in result.args)
                            field.setValue(result.args[field.name])
                    }
                }
                // add to loaded logs for this event
                that.loadedLogs.push(ev)
            }
            // if a callback was given, send the resulting EvmEvent to it
            if (typeof cb === "function") cb(that.loadedLogs)
        })
    }
}

EvmEvent.prototype.GetLogsFiltered = function(filterFields, callback) {
    // for returning all results syncronyously
    var matches = []
    for (var k in this.loadedLogs) {
        // get EvmEvent from loaded logs
        var ev = this.loadedLogs[k]

        // innocent until proven guilty
        var valid = true
            // check each input
        for (var i = 0; i < ev.inputs.length; i++) {
            // get the field
            var field = ev.inputs[i]

            // if the field exists in the filter fields
            if (field.name in filterFields) {
                // get the filter
                var filter = filterFields[field.name]

                // compare the field to the filter value with given operator
                if (!field.compareValueOperation(filter.value, filter.operator)) {
                    // if doesn't match, flag as invalid and stop looping
                    valid = false
                    break
                }
            }
        }

        if (valid) {

            // if a callback was given, send it the matching log
            if (typeof callback === "function") callback(ev)

            // add to results for return
            matches.push(ev)
        }
    }

    // syncronyous return
    return matches
}


EvmEvent.prototype.getFieldFilterValues = function() {
    var filterFields = {}
    this.inputs.forEach(function(field) {
        var valueField = document.getElementById(field.htmlId)
        var opField = document.getElementById(field.htmlId + '-operator')
        if (valueField && valueField.value) {
            var obj = {
                name: field.name,
                value: valueField.value,
                operator: opField.value
            }
            filterFields[field.name] = obj
        }
    })
    return filterFields
}

EvmEvent.prototype.getIndexedFilterValues = function() {
    var filterFields = {}
    this.inputs.forEach(function(field) {
        if (!field.indexed) return

        var valueField = document.getElementById(field.htmlId)
        if (valueField && valueField.value) {
            filterFields[field.name] = valueField.value
        }
    })
    return filterFields
}


EvmEvent.prototype.makeFieldFilter = function(userId) {
    if (!userId) userId = 'sorter'

    // containing div element
    var div = document.createElement('div')
    div.className = ['event'].join(' ')
    div.id = 'eventTopicFilter' + this.name

    var h3 = document.createElement('h3')
    h3.innerHTML = this.name

    if (this.inputs.length > 0) {
        var fs = document.createElement('fieldset')
        fs.className = 'inputs'

        var leg = document.createElement('legend')
        leg.innerHTML = 'Event topics'
        fs.appendChild(leg)


        // append the DOM for each field to the fieldset
        for (var i = 0; i < this.inputs.length; i++) {
            var field = this.inputs[i]
            field.setHtmlId(['event', userId, this.name].join('-'))

            var wrap = document.createElement('div')
            wrap.className = 'solfield'
            wrap.appendChild(field.RenderLabel())


            // make comparison select
            var select = document.createElement('select')
            select.className = 'comparison'
            select.id = field.htmlId + '-operator'


            var group = document.createElement('optgroup')
            group.label = '(' + field.type + ')'


            var first = document.createElement('option')
            first.innerHTML = '(all)'
            first.value = '*'
            select.options.add(first)

            var ops = field.operators
            for (var k in ops) {
                var option = document.createElement('option')
                option.innerHTML = ops[k]
                option.value = ops[k]
                group.appendChild(option)
            }
            select.appendChild(group)


            // select.selectedIndex = 0
            wrap.appendChild(select)

            wrap.appendChild(field.RenderField(true))

            if (field.indexed) {
                var icon = document.createElement('span')
                icon.innerHTML = '<dfn title="Indexed topic">&#8623;</dfn>'
                icon.className = 'indexed'
                wrap.appendChild(icon)
            }

            fs.appendChild(wrap)
        }

        div.appendChild(h3)
        div.appendChild(fs)

    }

    return div


}

"use strict";

var EvmFunction = function(abiItem) {
    if (typeof abiItem !== "object") return null
    if (!("name" in abiItem)) return null
    if (!("type" in abiItem) || abiItem.type != "function") return null

    this.abi = abiItem
    this.name = abiItem.name
    this.type = abiItem.type
    this.constant = (abiItem.constant ? abiItem.constant : false)
    this.inputs = []
    this.outputs = []
    this.error = undefined

    // assemble function parameters
    for (var i = 0; i < abiItem.inputs.length; i++) {
        var field = new SolField(abiItem.inputs[i])
        this.inputs[i] = field
    }

    // assemble return values
    for (var i = 0; i < abiItem.outputs.length; i++) {
        var field = new SolField(abiItem.outputs[i])
        this.outputs[i] = field
    }
}


EvmFunction.prototype.Call = function(userOptions, callback) {
    var kv = []
    for (var i = 0; i < this.inputs.length; i++) {
        var field = this.inputs[i]
        var val = document.getElementById(field.htmlId).value
            // if (val.length > 0) {
        field.setValue(val)
        kv.push(field.value)
            // }
    }

    // set transaction options
    var options = {
        from: userOptions.from,
        to: userOptions.to,
        // gas: userOptions.gas,
        // gasPrice: userOptions.gasPrice,
        data: userOptions.data,
        // value: userOptions.value
    }
    kv.push(options)


    // we want to modify the original object since it may have
    // htmlId set on it
    var func = this
        // set callback
    var cb = function(err, results) {
        // only supports "results" as single argument
        // not sure how multiple return values look yet        
        if (err) func.error = err
        else delete func['error']

        if (!err)
            for (var i = 0; i < func.outputs.length; i++) {
                var field = func.outputs[i]
                field.setValue(results) // single needs to become multiple
            }

        // return updated object to caller
        if (typeof callback === 'function') callback(func)
    }
    kv.push(cb)

    // get instance of contract
    var contract = this.contract.at(options.to)
    var contractFunction = contract[this.name]
    contractFunction.call.apply(contractFunction, kv)
}


EvmFunction.prototype.Transact = function(userOptions, callback) {
    var kv = []
    for (var i = 0; i < this.inputs.length; i++) {
        var field = this.inputs[i]
        var val = document.getElementById(field.htmlId).value
        kv.push(val)
    }

    // set transaction options
    var options = {
        from: userOptions.from,
        to: userOptions.to,
        gas: userOptions.gas,
        gasPrice: userOptions.gasPrice,
        data: userOptions.data,
        value: userOptions.value
    }
    kv.push(options);


    // set callback
    var func = this.func
    var cb = function(err, txhash) {
        if (err) func.error = err
        if (!err)
            func.transactionHash = txhash

        if (typeof callback === "function") callback(func)
    }
    kv.push(cb)

    // get instance of contract
    var contract = this.contract.at(options.to)
    var contractFunction = contract[this.name]
    contractFunction.sendTransaction.apply(contractFunction, kv)
}

EvmFunction.prototype.makeFieldForm = function(callCallback, transactCallback) {
    var item = this
    var div = document.createElement('div')
    div.className = ['function'].join(' ')
    div.id = 'function' + item.name

    var h3 = document.createElement('h3')
    h3.innerHTML = item.name
    div.appendChild(h3)


    // generate inputs with html id
    if (item.inputs.length > 0) {
        var fsi = document.createElement('fieldset')
        fsi.className = 'inputs'

        var leg = document.createElement('legend')
        leg.innerHTML = 'Inputs'
        fsi.appendChild(leg)

        item.inputs.forEach(function(field) {
            field.setHtmlId(['function', item.name, 'input'].join('-'))
            fsi.appendChild(field.DefaultRenderer(true))
        })

    }

    // generate outputs with htmlid
    if (item.outputs.length > 0) {
        var fso = document.createElement('fieldset')
        fso.className = 'outputs'

        var leg = document.createElement('legend')
        leg.innerHTML = 'Outputs'
        fso.appendChild(leg)

        item.outputs.forEach(function(field) {
            field.setHtmlId(['function', item.name, 'output'].join('-'))
            fso.appendChild(field.DefaultRenderer(false))
        })

    }

    // display call button when we the function has output fields
    if (item.outputs.length > 0) {
        var btn = document.createElement('button')
        btn.type = 'button'
        btn.innerHTML = 'Call'
        var that = this
        btn.addEventListener('click', function() {
            callCallback(that)
        })
        div.appendChild(btn)
    }

    if (!item.constant) {
        var tbtn = document.createElement('button')
        tbtn.type = 'button'
        tbtn.innerHTML = 'Transact'
        var that = this
        tbtn.addEventListener('click', function() {
            transactCallback(that)
        })
        div.appendChild(tbtn)
    }

    if (item.inputs.length > 0)
        div.appendChild(fsi)
    if (item.outputs.length > 0)
        div.appendChild(fso)

    return div
}



var SolAddress = function() {
    this.base = "address"
    this.operators = [OperatorEnum.Eq, OperatorEnum.Neq, OperatorEnum.Contain]
}

SolAddress.prototype.setValue = function(value) {
    if (typeof value === 'undefined') return
        // ensure address is prefixed "0x"
    if (value.substring(0, 2) !== "0x")
        value = "0x" + value

    // address is 20 bytes = 40 characters + 2 prefix
    if (value.length != 42)
        return new Error('Address not 40 characters. Got ' + (value.length - 2).toString())

    this.value = value
    return null
}

SolAddress.prototype.compareValueOperation = function(compareVal, operator) {
    switch (operator) {
        case OperatorEnum.Neq:
            if (compareVal !== this.value) return true
            break
        case OperatorEnum.Eq:
            if (compareVal === this.value) return true
            break
        case OperatorEnum.Contain:
            if (this.value.indexOf(value) > -1) return true
            break
        default:
            console.log('Unknown comparison', operator)
    }
    return false
}


SolAddress.prototype.DefaultRenderer = function(isEditable, htmlId) {
    var input = document.createElement('input')
    if (htmlId) input.id = htmlId
    input.type = 'text'
    input.className = ['logField', this.base].join(' ')
    input.placeholder = this.base

    // if not editable
    if (!!!isEditable) {
        input.className = [input.className, 'readonly'].join(' ')
        input.readOnly = true
    }

    // if there is a value, apply it
    if (this.value) input.value = this.value

    return input
}


var SolBool = function() {
    this.base = "bool"
    this.operators = [OperatorEnum.Eq, OperatorEnum.Neq]
}

SolBool.prototype.setValue = function(value) {
    if (typeof value === 'undefined') return
    this.value = !!value
    return null
}

SolBool.prototype.compareValueOperation = function(compareVal, operator) {
    switch (operator) {
        case OperatorEnum.Neq:
            if (compareVal !== this.value) return true
            break
        case OperatorEnum.Eq:
            if (compareVal === this.value) return true
            break
        default:
            console.log('Unknown comparison', operator)
    }
    return false
}

SolBool.prototype.DefaultRenderer = function(isEditable, htmlId) {
    var input = document.createElement('input')
    if (htmlId) input.id = htmlId
    input.className = this.base
    input.placeholder = this.base

    // if the field should be editable
    if (!!isEditable) {
        input.type = 'checkbox'
    } else {
        input.type = 'text'
        input.className = [input.className, 'readonly'].join(' ')
        input.readOnly = true
    }

    // if there is a value, apply it
    if (this.value) input.value = this.value

    return input
}


var SolBytes = function(size) {
    this.size = size
    this.base = "bytes"
    this.operators = [OperatorEnum.Eq, OperatorEnum.Neq, OperatorEnum.Contain]
}

SolBytes.prototype.setValue = function(value) {
    if (typeof value === 'undefined') return
    if (typeof value !== "string")
        return new Error('Value must be string')

    if (value.substring(0, 2) !== "0x")
        value = "0x" + this.value

    if (value.length % 2 != 0)
        return new Error('Not even number of bytes')

    this.value = value
    return null
}

SolBytes.prototype.compareValueOperation = function(compareVal, operator) {
    switch (operator) {
        case OperatorEnum.Neq:
            if (compareVal !== this.value) return true
            break
        case OperatorEnum.Eq:
            if (compareVal === this.value) return true
            break
        case OperatorEnum.Contain:
            if (this.value.indexOf(value) > -1) return true
            break
        default:
            console.log('Unknown comparison', operator)
    }
    return false
}


SolBytes.prototype.DefaultRenderer = function(isEditable, htmlId) {
    var input = document.createElement('textarea')
    if (htmlId) input.id = htmlId
    input.rows = 4
    input.cols = 40
    input.className = [this.base, this.base + this.size].join(' ')
    input.placeholder = this.base + this.size

    // if not editable
    if (!!!isEditable) {
        input.className = [input.className, 'readonly'].join(' ')
        input.readOnly = true
    }

    // if there is a value, apply it
    if (this.value) input.innerHTML = this.value

    return input
}

"use strict";

var SolField = function(abiField, value) {
    if (typeof abiField !== "object") return
    var field = this._constructor(abiField)
    if (field) {
        this.name = abiField.name
        this.type = abiField.type
        this.indexed = ('indexed' in abiField ? abiField.indexed : false)
        this.anonymous = ('anonymous' in abiField ? abiField.anonymous : false)
        this.operators = field.operators
        if (value) field.setValue(value)
        if (field.value) this.value = field.value
        this._field = field
    }
}

SolField.prototype._constructor = function(abiField) {
    var solType = this.splitType(abiField.type)
    this.typeBase = solType.base
    this.typeSize = solType.size

    switch (solType.base) {
        case 'bool':
        case 'bool[]':
            return new SolBool()
        case 'address':
        case 'address[]':
            return new SolAddress()
        case 'string':
        case 'string[]':
            return new SolString(solType.size)
        case 'bytes':
        case 'bytes[]':
            return new SolBytes(solType.size)
        case 'int':
        case 'int[]':
            return new SolInt(solType.size)
        case 'uint':
        case 'uint[]':
            return new SolUint(solType.size)
        case 'real': // not yet implemented
        case 'real[]': // not yet implemented
        case 'ureal': // not yet implemented
        case 'ureal[]': // not yet implemented
        default:
            console.log('Unknown field type:', abiField.name, solType.base, solType.size)
    }

}

SolField.prototype.splitType = function(solidityType) {
    // Function to split something like "uint256" into discrete pieces
    var firstDigit = solidityType.match(/\d/);
    if (firstDigit === null) {
        return {
            base: solidityType,
            size: null
        }
    }
    var index = solidityType.indexOf(firstDigit);
    return {
        base: solidityType.substring(0, index),
        size: solidityType.substring(index, solidityType.length)
    }
}

SolField.prototype.setValue = function(value) {
    if (typeof value === 'undefined') return
    var err = this._field.setValue(value)
    if (err)
        throw err
    this.value = this._field.value
}

SolField.prototype.setHtmlId = function(htmlIdPrefix) {
    if (!htmlIdPrefix) return
    this.htmlId = [htmlIdPrefix.toString(), this.name].join('-')
}

SolField.prototype.DefaultRenderer = function(isEditable) {
    // initialize empty DOM element
    var div = document.createElement('div')
    div.className = 'solfield'

    div.appendChild(this.RenderLabel())
    div.appendChild(this.RenderField(isEditable))

    return div
}

SolField.prototype.RenderLabel = function() {
    var label = document.createElement('label')
    label.htmlFor = this.htmlId
    label.className = 'name'
    var name = this.name
    if (!name)
        name = '(returns)'
    label.innerHTML = name
    return label
}

SolField.prototype.RenderField = function(isEditable) {
    this._field.setValue(this.value)
    var input = this._field.DefaultRenderer(isEditable, this.htmlId)
    input.className += ' value'
    return input
}

SolField.prototype.compareValueOperation = function(compareVal, operator) {
    if (operator === '*') return true
    var result = this._field.compareValueOperation(compareVal, operator)
        // console.log(this, this.getValue().valueOf(), compareVal, operator, result)
    return result
}



var SolInt = function(size) {
    this.size = (size ? size : "256")
    this.base = "int"
    this.operators = [
        OperatorEnum.Eq,
        OperatorEnum.Neq,
        OperatorEnum.LT,
        OperatorEnum.LTEq,
        OperatorEnum.GT,
        OperatorEnum.GTEq
    ]
}

SolInt.prototype.setValue = function(value) {
    if (typeof value === 'undefined') return
    try {
        var val = web3.toBigNumber(value)
    } catch (err) {
        return err
    }

    this.value = val
    return null
}

SolInt.prototype.compareValueOperation = function(compareVal, operator) {
    // web3 gives us a BigNumber
    var result = this.value.comparedTo(compareVal)
    switch (operator) {
        case OperatorEnum.Neq:
            if (result !== 0) return true
            break
        case OperatorEnum.Eq:
            if (result === 0) return true
            break
        case OperatorEnum.LT:
            if (result === -1) return true
            break
        case OperatorEnum.LTEq:
            if (result === -1 || result === 0) return true
            break
        case OperatorEnum.GT:
            if (result === 1) return true
            break
        case OperatorEnum.GTEq:
            if (result === 1 || result === 0) return true
            break
        default:
            console.log('Unknown comparison', operator)
    }
    return false
}


SolInt.prototype.DefaultRenderer = function(isEditable, htmlId) {
    var input = document.createElement('input')
    if (htmlId) input.id = htmlId
    input.type = 'input'
    input.className = this.base
    input.placeholder = this.base
    if (this.size) {
        input.className = [input.className, this.base + this.size].join(' ')
        input.placeholder += this.size
    }

    // if not editable
    if (!!!isEditable) {
        input.className = [input.className, 'readonly'].join(' ')
        input.readOnly = true
    }

    // if there is a value, apply it
    if (this.value) input.value = this.value

    return input
}



var SolString = function(size) {
    this.size = size
    this.base = "string"
    this.operators = [OperatorEnum.Eq, OperatorEnum.Neq, OperatorEnum.Contain]
}

SolString.prototype.setValue = function(value) {
    if (typeof value === 'undefined') return
    if (typeof value !== "string")
        return new Error('Must be string')

    this.value = value
    return null
}


SolString.prototype.compareValueOperation = function(compareVal, operator) {
    switch (operator) {
        case OperatorEnum.Neq:
            if (compareVal !== this.value) return true
            break
        case OperatorEnum.Eq:
            if (compareVal === this.value) return true
            break
        case OperatorEnum.Contain:
            if (this.value.indexOf(value) > -1) return true
            break
        default:
            console.log('Unknown comparison', operator)
    }
    return false
}


SolString.prototype.DefaultRenderer = function(isEditable, htmlId) {
    var input = document.createElement('textarea')
    if (htmlId) input.id = htmlId
    input.rows = 4
    input.cols = 40
    input.className = [this.base, this.base + this.size].join(' ')
    input.placeholder = this.base + this.size

    // if not editable
    if (!!!isEditable) {
        input.className = [input.className, 'readonly'].join(' ')
        input.readOnly = true
    }

    // if there is a value, apply it
    if (this.value) input.innerHTML = this.value

    return input
}



var SolUint = function(size) {
    this.size = (size ? size : "256")
    this.base = "uint"
    this.operators = [
        OperatorEnum.Eq,
        OperatorEnum.Neq,
        OperatorEnum.LT,
        OperatorEnum.LTEq,
        OperatorEnum.GT,
        OperatorEnum.GTEq
    ]
}

SolUint.prototype.setValue = function(value) {
    if (typeof value === 'undefined') return
    try {
        var val = web3.toBigNumber(value)
    } catch (err) {
        return err
    }

    this.value = val
    return null
}

SolUint.prototype.DefaultRenderer = function(isEditable, htmlId) {
    var input = document.createElement('input')
    if (htmlId) input.id = htmlId
    input.type = 'input'
    input.className = this.base
    input.placeholder = this.base
    if (this.size) {
        input.className = [input.className, this.base + this.size].join(' ')
        input.placeholder += this.size
    }
    // if not editable
    if (!!!isEditable) {
        input.className = [input.className, 'readonly'].join(' ')
        input.readOnly = true
    }

    // if there is a value, apply it
    if (this.value) input.value = this.value

    return input
}

SolUint.prototype.compareValueOperation = function(compareVal, operator) {
    // web3 gives us a BigNumber
    var result = this.value.comparedTo(compareVal)
    switch (operator) {
        case OperatorEnum.Neq:
            if (result !== 0) return true
            break
        case OperatorEnum.Eq:
            if (result === 0) return true
            break
        case OperatorEnum.LT:
            if (result === -1) return true
            break
        case OperatorEnum.LTEq:
            if (result === -1 || result === 0) return true
            break
        case OperatorEnum.GT:
            if (result === 1) return true
            break
        case OperatorEnum.GTEq:
            if (result === 1 || result === 0) return true
            break
        default:
            console.log('Unknown comparison', operator)
    }
    return false
}
