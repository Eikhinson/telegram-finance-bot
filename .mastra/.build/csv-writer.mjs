import fs from 'fs';

var dist = {};

var csvStringifierFactory$1 = {};

var array = {};

var abstract = {};

Object.defineProperty(abstract, "__esModule", { value: true });
var DEFAULT_RECORD_DELIMITER = '\n';
var VALID_RECORD_DELIMITERS = [DEFAULT_RECORD_DELIMITER, '\r\n'];
var CsvStringifier = /** @class */ (function () {
    function CsvStringifier(fieldStringifier, recordDelimiter) {
        if (recordDelimiter === void 0) { recordDelimiter = DEFAULT_RECORD_DELIMITER; }
        this.fieldStringifier = fieldStringifier;
        this.recordDelimiter = recordDelimiter;
        _validateRecordDelimiter(recordDelimiter);
    }
    CsvStringifier.prototype.getHeaderString = function () {
        var headerRecord = this.getHeaderRecord();
        return headerRecord ? this.joinRecords([this.getCsvLine(headerRecord)]) : null;
    };
    CsvStringifier.prototype.stringifyRecords = function (records) {
        var _this = this;
        var csvLines = Array.from(records, function (record) { return _this.getCsvLine(_this.getRecordAsArray(record)); });
        return this.joinRecords(csvLines);
    };
    CsvStringifier.prototype.getCsvLine = function (record) {
        var _this = this;
        return record
            .map(function (fieldValue) { return _this.fieldStringifier.stringify(fieldValue); })
            .join(this.fieldStringifier.fieldDelimiter);
    };
    CsvStringifier.prototype.joinRecords = function (records) {
        return records.join(this.recordDelimiter) + this.recordDelimiter;
    };
    return CsvStringifier;
}());
abstract.CsvStringifier = CsvStringifier;
function _validateRecordDelimiter(delimiter) {
    if (VALID_RECORD_DELIMITERS.indexOf(delimiter) === -1) {
        throw new Error("Invalid record delimiter `" + delimiter + "` is specified");
    }
}

var __extends$2 = (array && array.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(array, "__esModule", { value: true });
var abstract_1$1 = abstract;
var ArrayCsvStringifier = /** @class */ (function (_super) {
    __extends$2(ArrayCsvStringifier, _super);
    function ArrayCsvStringifier(fieldStringifier, recordDelimiter, header) {
        var _this = _super.call(this, fieldStringifier, recordDelimiter) || this;
        _this.header = header;
        return _this;
    }
    ArrayCsvStringifier.prototype.getHeaderRecord = function () {
        return this.header;
    };
    ArrayCsvStringifier.prototype.getRecordAsArray = function (record) {
        return record;
    };
    return ArrayCsvStringifier;
}(abstract_1$1.CsvStringifier));
array.ArrayCsvStringifier = ArrayCsvStringifier;

var fieldStringifier = {};

var __extends$1 = (fieldStringifier && fieldStringifier.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(fieldStringifier, "__esModule", { value: true });
var DEFAULT_FIELD_DELIMITER = ',';
var VALID_FIELD_DELIMITERS = [DEFAULT_FIELD_DELIMITER, ';'];
var FieldStringifier = /** @class */ (function () {
    function FieldStringifier(fieldDelimiter) {
        this.fieldDelimiter = fieldDelimiter;
    }
    FieldStringifier.prototype.isEmpty = function (value) {
        return typeof value === 'undefined' || value === null || value === '';
    };
    FieldStringifier.prototype.quoteField = function (field) {
        return "\"" + field.replace(/"/g, '""') + "\"";
    };
    return FieldStringifier;
}());
fieldStringifier.FieldStringifier = FieldStringifier;
var DefaultFieldStringifier = /** @class */ (function (_super) {
    __extends$1(DefaultFieldStringifier, _super);
    function DefaultFieldStringifier() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DefaultFieldStringifier.prototype.stringify = function (value) {
        if (this.isEmpty(value))
            return '';
        var str = String(value);
        return this.needsQuote(str) ? this.quoteField(str) : str;
    };
    DefaultFieldStringifier.prototype.needsQuote = function (str) {
        return str.includes(this.fieldDelimiter) || str.includes('\n') || str.includes('"');
    };
    return DefaultFieldStringifier;
}(FieldStringifier));
var ForceQuoteFieldStringifier = /** @class */ (function (_super) {
    __extends$1(ForceQuoteFieldStringifier, _super);
    function ForceQuoteFieldStringifier() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ForceQuoteFieldStringifier.prototype.stringify = function (value) {
        return this.isEmpty(value) ? '' : this.quoteField(String(value));
    };
    return ForceQuoteFieldStringifier;
}(FieldStringifier));
function createFieldStringifier(fieldDelimiter, alwaysQuote) {
    if (fieldDelimiter === void 0) { fieldDelimiter = DEFAULT_FIELD_DELIMITER; }
    if (alwaysQuote === void 0) { alwaysQuote = false; }
    _validateFieldDelimiter(fieldDelimiter);
    return alwaysQuote ? new ForceQuoteFieldStringifier(fieldDelimiter) : new DefaultFieldStringifier(fieldDelimiter);
}
fieldStringifier.createFieldStringifier = createFieldStringifier;
function _validateFieldDelimiter(delimiter) {
    if (VALID_FIELD_DELIMITERS.indexOf(delimiter) === -1) {
        throw new Error("Invalid field delimiter `" + delimiter + "` is specified");
    }
}

var object$1 = {};

var object = {};

Object.defineProperty(object, "__esModule", { value: true });
object.isObject = function (value) {
    return Object.prototype.toString.call(value) === '[object Object]';
};

var __extends = (object$1 && object$1.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(object$1, "__esModule", { value: true });
var abstract_1 = abstract;
var object_1$1 = object;
var ObjectCsvStringifier = /** @class */ (function (_super) {
    __extends(ObjectCsvStringifier, _super);
    function ObjectCsvStringifier(fieldStringifier, header, recordDelimiter, headerIdDelimiter) {
        var _this = _super.call(this, fieldStringifier, recordDelimiter) || this;
        _this.header = header;
        _this.headerIdDelimiter = headerIdDelimiter;
        return _this;
    }
    ObjectCsvStringifier.prototype.getHeaderRecord = function () {
        if (!this.isObjectHeader)
            return null;
        return this.header.map(function (field) { return field.title; });
    };
    ObjectCsvStringifier.prototype.getRecordAsArray = function (record) {
        var _this = this;
        return this.fieldIds.map(function (fieldId) { return _this.getNestedValue(record, fieldId); });
    };
    ObjectCsvStringifier.prototype.getNestedValue = function (obj, key) {
        if (!this.headerIdDelimiter)
            return obj[key];
        return key.split(this.headerIdDelimiter).reduce(function (subObj, keyPart) { return (subObj || {})[keyPart]; }, obj);
    };
    Object.defineProperty(ObjectCsvStringifier.prototype, "fieldIds", {
        get: function () {
            return this.isObjectHeader ? this.header.map(function (column) { return column.id; }) : this.header;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ObjectCsvStringifier.prototype, "isObjectHeader", {
        get: function () {
            return object_1$1.isObject(this.header && this.header[0]);
        },
        enumerable: true,
        configurable: true
    });
    return ObjectCsvStringifier;
}(abstract_1.CsvStringifier));
object$1.ObjectCsvStringifier = ObjectCsvStringifier;

Object.defineProperty(csvStringifierFactory$1, "__esModule", { value: true });
var array_1 = array;
var field_stringifier_1 = fieldStringifier;
var object_1 = object$1;
var CsvStringifierFactory = /** @class */ (function () {
    function CsvStringifierFactory() {
    }
    CsvStringifierFactory.prototype.createArrayCsvStringifier = function (params) {
        var fieldStringifier = field_stringifier_1.createFieldStringifier(params.fieldDelimiter, params.alwaysQuote);
        return new array_1.ArrayCsvStringifier(fieldStringifier, params.recordDelimiter, params.header);
    };
    CsvStringifierFactory.prototype.createObjectCsvStringifier = function (params) {
        var fieldStringifier = field_stringifier_1.createFieldStringifier(params.fieldDelimiter, params.alwaysQuote);
        return new object_1.ObjectCsvStringifier(fieldStringifier, params.header, params.recordDelimiter, params.headerIdDelimiter);
    };
    return CsvStringifierFactory;
}());
csvStringifierFactory$1.CsvStringifierFactory = CsvStringifierFactory;

var csvWriterFactory$1 = {};

var csvWriter = {};

var fileWriter = {};

var promise = {};

var __spreadArrays = (promise && promise.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(promise, "__esModule", { value: true });
function promisify(fn) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return new Promise(function (resolve, reject) {
            var nodeCallback = function (err, result) {
                if (err)
                    reject(err);
                else
                    resolve(result);
            };
            fn.apply(null, __spreadArrays(args, [nodeCallback]));
        });
    };
}
promise.promisify = promisify;

var __awaiter$1 = (fileWriter && fileWriter.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator$1 = (fileWriter && fileWriter.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(fileWriter, "__esModule", { value: true });
var promise_1 = promise;
var fs_1 = fs;
var writeFilePromise = promise_1.promisify(fs_1.writeFile);
var DEFAULT_ENCODING = 'utf8';
var FileWriter = /** @class */ (function () {
    function FileWriter(path, append, encoding) {
        if (encoding === void 0) { encoding = DEFAULT_ENCODING; }
        this.path = path;
        this.append = append;
        this.encoding = encoding;
    }
    FileWriter.prototype.write = function (string) {
        return __awaiter$1(this, void 0, void 0, function () {
            return __generator$1(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, writeFilePromise(this.path, string, this.getWriteOption())];
                    case 1:
                        _a.sent();
                        this.append = true;
                        return [2 /*return*/];
                }
            });
        });
    };
    FileWriter.prototype.getWriteOption = function () {
        return {
            encoding: this.encoding,
            flag: this.append ? 'a' : 'w'
        };
    };
    return FileWriter;
}());
fileWriter.FileWriter = FileWriter;

var __awaiter = (csvWriter && csvWriter.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (csvWriter && csvWriter.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(csvWriter, "__esModule", { value: true });
var file_writer_1 = fileWriter;
var DEFAULT_INITIAL_APPEND_FLAG = false;
var CsvWriter = /** @class */ (function () {
    function CsvWriter(csvStringifier, path, encoding, append) {
        if (append === void 0) { append = DEFAULT_INITIAL_APPEND_FLAG; }
        this.csvStringifier = csvStringifier;
        this.append = append;
        this.fileWriter = new file_writer_1.FileWriter(path, this.append, encoding);
    }
    CsvWriter.prototype.writeRecords = function (records) {
        return __awaiter(this, void 0, void 0, function () {
            var recordsString, writeString;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        recordsString = this.csvStringifier.stringifyRecords(records);
                        writeString = this.headerString + recordsString;
                        return [4 /*yield*/, this.fileWriter.write(writeString)];
                    case 1:
                        _a.sent();
                        this.append = true;
                        return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(CsvWriter.prototype, "headerString", {
        get: function () {
            var headerString = !this.append && this.csvStringifier.getHeaderString();
            return headerString || '';
        },
        enumerable: true,
        configurable: true
    });
    return CsvWriter;
}());
csvWriter.CsvWriter = CsvWriter;

Object.defineProperty(csvWriterFactory$1, "__esModule", { value: true });
var csv_writer_1 = csvWriter;
var CsvWriterFactory = /** @class */ (function () {
    function CsvWriterFactory(csvStringifierFactory) {
        this.csvStringifierFactory = csvStringifierFactory;
    }
    CsvWriterFactory.prototype.createArrayCsvWriter = function (params) {
        var csvStringifier = this.csvStringifierFactory.createArrayCsvStringifier({
            header: params.header,
            fieldDelimiter: params.fieldDelimiter,
            recordDelimiter: params.recordDelimiter,
            alwaysQuote: params.alwaysQuote
        });
        return new csv_writer_1.CsvWriter(csvStringifier, params.path, params.encoding, params.append);
    };
    CsvWriterFactory.prototype.createObjectCsvWriter = function (params) {
        var csvStringifier = this.csvStringifierFactory.createObjectCsvStringifier({
            header: params.header,
            fieldDelimiter: params.fieldDelimiter,
            recordDelimiter: params.recordDelimiter,
            headerIdDelimiter: params.headerIdDelimiter,
            alwaysQuote: params.alwaysQuote
        });
        return new csv_writer_1.CsvWriter(csvStringifier, params.path, params.encoding, params.append);
    };
    return CsvWriterFactory;
}());
csvWriterFactory$1.CsvWriterFactory = CsvWriterFactory;

Object.defineProperty(dist, "__esModule", { value: true });
var csv_stringifier_factory_1 = csvStringifierFactory$1;
var csv_writer_factory_1 = csvWriterFactory$1;
var csvStringifierFactory = new csv_stringifier_factory_1.CsvStringifierFactory();
var csvWriterFactory = new csv_writer_factory_1.CsvWriterFactory(csvStringifierFactory);
dist.createArrayCsvStringifier = function (params) {
    return csvStringifierFactory.createArrayCsvStringifier(params);
};
dist.createObjectCsvStringifier = function (params) {
    return csvStringifierFactory.createObjectCsvStringifier(params);
};
dist.createArrayCsvWriter = function (params) {
    return csvWriterFactory.createArrayCsvWriter(params);
};
var createObjectCsvWriter = dist.createObjectCsvWriter = function (params) {
    return csvWriterFactory.createObjectCsvWriter(params);
};

export { createObjectCsvWriter };
//# sourceMappingURL=csv-writer.mjs.map
