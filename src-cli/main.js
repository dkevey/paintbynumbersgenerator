"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
Object.defineProperty(exports, "__esModule", { value: true });
var canvas = require("canvas");
var fs = require("fs");
var minimist = require("minimist");
var path = require("path");
var process = require("process");
var colorreductionmanagement_1 = require("../src/colorreductionmanagement");
var facetBorderSegmenter_1 = require("../src/facetBorderSegmenter");
var facetBorderTracer_1 = require("../src/facetBorderTracer");
var facetCreator_1 = require("../src/facetCreator");
var facetLabelPlacer_1 = require("../src/facetLabelPlacer");
var facetmanagement_1 = require("../src/facetmanagement");
var facetReducer_1 = require("../src/facetReducer");
var settings_1 = require("../src/settings");
var point_1 = require("../src/structs/point");
var svg2img = require("svg2img");
var CLISettingsOutputProfile = /** @class */ (function () {
    function CLISettingsOutputProfile() {
        this.name = "";
        this.svgShowLabels = true;
        this.svgFillFacets = true;
        this.svgShowBorders = true;
        this.svgSizeMultiplier = 3;
        this.svgFontSize = 60;
        this.svgFontColor = "black";
        this.filetype = "svg";
        this.filetypeQuality = 95;
    }
    return CLISettingsOutputProfile;
}());
var CLISettings = /** @class */ (function (_super) {
    __extends(CLISettings, _super);
    function CLISettings() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.outputProfiles = [];
        return _this;
    }
    return CLISettings;
}(settings_1.Settings));
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, imagePath, svgPath, productNameArg, productName, wfs, configPath, settings, parsed, img, c, ctx, imgData, width, height, newWidth, newHeight, newHeight, newWidth, tempCanvas, cKmeans, ctxKmeans, kmeansImgData, colormapResult, facetResult, run, variants, _loop_1, _i, variants_1, v, _loop_2, _a, _b, profile, palettePath, colorFrequency, _c, _d, color, _e, _f, facet, colorAliasesByColor, _g, _h, alias, totalFrequency, paletteInfo;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    args = minimist(process.argv.slice(2));
                    imagePath = args.i;
                    svgPath = args.o;
                    productNameArg = args.n || args.productName;
                    productName = productNameArg;
                    if (!productName && typeof svgPath !== "undefined") {
                        productName = path.basename(svgPath, path.extname(svgPath));
                    }
                    if (!productName) {
                        productName = "Untitled";
                    }
                    // sanitize productName for filenames
                    productName = productName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
                    wfs = !!(args.w || args.wfs);
                    if (typeof imagePath === "undefined" || typeof svgPath === "undefined") {
                        console.log("Usage: exe -i <input_image> -o <output_svg> [-c <settings_json>] [-n <productName>] [--wfs]");
                        process.exit(1);
                    }
                    configPath = args.c;
                    if (typeof configPath === "undefined") {
                        configPath = path.join(__dirname, "settings.json");
                    }
                    else {
                        if (!path.isAbsolute(configPath)) {
                            configPath = path.join(__dirname, configPath);
                        }
                    }
                    settings = require(configPath);
                    // CLI override for number of colours per run (do not persist to settings.json)
                    if (typeof args.colours !== "undefined") {
                        parsed = parseInt(args.colours + "", 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            settings.kMeansNrOfClusters = parsed;
                            console.log("Overriding number of colours to ".concat(parsed, " for this run"));
                        }
                    }
                    return [4 /*yield*/, canvas.loadImage(imagePath)];
                case 1:
                    img = _j.sent();
                    c = canvas.createCanvas(img.width, img.height);
                    ctx = c.getContext("2d");
                    ctx.drawImage(img, 0, 0, c.width, c.height);
                    imgData = ctx.getImageData(0, 0, c.width, c.height);
                    // resize if required
                    if (settings.resizeImageIfTooLarge && (c.width > settings.resizeImageWidth || c.height > settings.resizeImageHeight)) {
                        width = c.width;
                        height = c.height;
                        if (width > settings.resizeImageWidth) {
                            newWidth = settings.resizeImageWidth;
                            newHeight = c.height / c.width * settings.resizeImageWidth;
                            width = newWidth;
                            height = newHeight;
                        }
                        if (height > settings.resizeImageHeight) {
                            newHeight = settings.resizeImageHeight;
                            newWidth = width / height * newHeight;
                            width = newWidth;
                            height = newHeight;
                        }
                        tempCanvas = canvas.createCanvas(width, height);
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        tempCanvas.getContext("2d").drawImage(c, 0, 0, width, height);
                        c.width = width;
                        c.height = height;
                        ctx.drawImage(tempCanvas, 0, 0, width, height);
                        imgData = ctx.getImageData(0, 0, c.width, c.height);
                        console.log("Resized image to ".concat(width, "x").concat(height));
                    }
                    console.log("Running k-means clustering");
                    cKmeans = canvas.createCanvas(imgData.width, imgData.height);
                    ctxKmeans = cKmeans.getContext("2d");
                    ctxKmeans.fillStyle = "white";
                    ctxKmeans.fillRect(0, 0, cKmeans.width, cKmeans.height);
                    kmeansImgData = ctxKmeans.getImageData(0, 0, cKmeans.width, cKmeans.height);
                    return [4 /*yield*/, colorreductionmanagement_1.ColorReducer.applyKMeansClustering(imgData, kmeansImgData, ctx, settings, function (kmeans) {
                            var progress = (100 - (kmeans.currentDeltaDistanceDifference > 100 ? 100 : kmeans.currentDeltaDistanceDifference)) / 100;
                            ctxKmeans.putImageData(kmeansImgData, 0, 0);
                        })];
                case 2:
                    _j.sent();
                    colormapResult = colorreductionmanagement_1.ColorReducer.createColorMap(kmeansImgData);
                    facetResult = new facetmanagement_1.FacetResult();
                    if (!(typeof settings.narrowPixelStripCleanupRuns === "undefined" || settings.narrowPixelStripCleanupRuns === 0)) return [3 /*break*/, 5];
                    console.log("Creating facets");
                    return [4 /*yield*/, facetCreator_1.FacetCreator.getFacets(imgData.width, imgData.height, colormapResult.imgColorIndices, function (progress) {
                            // progress
                        })];
                case 3:
                    facetResult = _j.sent();
                    console.log("Reducing facets");
                    return [4 /*yield*/, facetReducer_1.FacetReducer.reduceFacets(settings.removeFacetsSmallerThanNrOfPoints, settings.removeFacetsFromLargeToSmall, settings.maximumNumberOfFacets, colormapResult.colorsByIndex, facetResult, colormapResult.imgColorIndices, function (progress) {
                            // progress
                        })];
                case 4:
                    _j.sent();
                    return [3 /*break*/, 11];
                case 5:
                    run = 0;
                    _j.label = 6;
                case 6:
                    if (!(run < settings.narrowPixelStripCleanupRuns)) return [3 /*break*/, 11];
                    console.log("Removing narrow pixels run #" + (run + 1));
                    // clean up narrow pixel strips
                    return [4 /*yield*/, colorreductionmanagement_1.ColorReducer.processNarrowPixelStripCleanup(colormapResult)];
                case 7:
                    // clean up narrow pixel strips
                    _j.sent();
                    console.log("Creating facets");
                    return [4 /*yield*/, facetCreator_1.FacetCreator.getFacets(imgData.width, imgData.height, colormapResult.imgColorIndices, function (progress) {
                            // progress
                        })];
                case 8:
                    facetResult = _j.sent();
                    console.log("Reducing facets");
                    return [4 /*yield*/, facetReducer_1.FacetReducer.reduceFacets(settings.removeFacetsSmallerThanNrOfPoints, settings.removeFacetsFromLargeToSmall, settings.maximumNumberOfFacets, colormapResult.colorsByIndex, facetResult, colormapResult.imgColorIndices, function (progress) {
                            // progress
                        })];
                case 9:
                    _j.sent();
                    _j.label = 10;
                case 10:
                    run++;
                    return [3 /*break*/, 6];
                case 11:
                    console.log("Build border paths");
                    return [4 /*yield*/, facetBorderTracer_1.FacetBorderTracer.buildFacetBorderPaths(facetResult, function (progress) {
                            // progress
                        })];
                case 12:
                    _j.sent();
                    console.log("Build border path segments");
                    return [4 /*yield*/, facetBorderSegmenter_1.FacetBorderSegmenter.buildFacetBorderSegments(facetResult, settings.nrOfTimesToHalveBorderSegments, function (progress) {
                            // progress
                        })];
                case 13:
                    _j.sent();
                    console.log("Determine label placement");
                    return [4 /*yield*/, facetLabelPlacer_1.FacetLabelPlacer.buildFacetLabelBounds(facetResult, function (progress) {
                            // progress
                        })];
                case 14:
                    _j.sent();
                    if (!wfs) return [3 /*break*/, 19];
                    variants = [
                        { suffix: "BW_Numbers", svgShowLabels: true, svgFillFacets: false, svgShowBorders: true },
                        { suffix: "Colour_Reference", svgShowLabels: false, svgFillFacets: true, svgShowBorders: false },
                        { suffix: "Colour_Numbers", svgShowLabels: true, svgFillFacets: true, svgShowBorders: false },
                        { suffix: "Colour_Numbers_Outline", svgShowLabels: true, svgFillFacets: true, svgShowBorders: true },
                        { suffix: "BW_Outline", svgShowLabels: false, svgFillFacets: false, svgShowBorders: true },
                    ];
                    _loop_1 = function (v) {
                        var baseName, svgProfilePath, pngProfilePath, svgString, imageBuffer;
                        return __generator(this, function (_k) {
                            switch (_k.label) {
                                case 0:
                                    baseName = "WFS_".concat(productName, "_").concat(v.suffix);
                                    svgProfilePath = path.join(path.dirname(svgPath), baseName + ".svg");
                                    pngProfilePath = path.join(path.dirname(svgPath), baseName + ".png");
                                    console.log("Generating WFS variant ".concat(v.suffix, " -> ").concat(baseName));
                                    return [4 /*yield*/, createSVG(facetResult, colormapResult.colorsByIndex, 3, v.svgFillFacets, v.svgShowBorders, v.svgShowLabels, 60, "#000")];
                                case 1:
                                    svgString = _k.sent();
                                    // write SVG
                                    fs.writeFileSync(svgProfilePath, svgString);
                                    return [4 /*yield*/, new Promise(function (then, reject) {
                                            svg2img(svgString, function (error, buffer) {
                                                if (error) {
                                                    reject(error);
                                                }
                                                else {
                                                    then(buffer);
                                                }
                                            });
                                        })];
                                case 2:
                                    imageBuffer = _k.sent();
                                    fs.writeFileSync(pngProfilePath, imageBuffer);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, variants_1 = variants;
                    _j.label = 15;
                case 15:
                    if (!(_i < variants_1.length)) return [3 /*break*/, 18];
                    v = variants_1[_i];
                    return [5 /*yield**/, _loop_1(v)];
                case 16:
                    _j.sent();
                    _j.label = 17;
                case 17:
                    _i++;
                    return [3 /*break*/, 15];
                case 18: return [3 /*break*/, 23];
                case 19:
                    _loop_2 = function (profile) {
                        var svgProfilePath, svgString, imageBuffer, imageBuffer;
                        return __generator(this, function (_l) {
                            switch (_l.label) {
                                case 0:
                                    console.log("Generating output for " + profile.name);
                                    if (typeof profile.filetype === "undefined") {
                                        profile.filetype = "svg";
                                    }
                                    svgProfilePath = path.join(path.dirname(svgPath), path.basename(svgPath).substr(0, path.basename(svgPath).length - path.extname(svgPath).length) + "-" + profile.name) + "." + profile.filetype;
                                    return [4 /*yield*/, createSVG(facetResult, colormapResult.colorsByIndex, profile.svgSizeMultiplier, profile.svgFillFacets, profile.svgShowBorders, profile.svgShowLabels, profile.svgFontSize, profile.svgFontColor)];
                                case 1:
                                    svgString = _l.sent();
                                    if (!(profile.filetype === "svg")) return [3 /*break*/, 2];
                                    fs.writeFileSync(svgProfilePath, svgString);
                                    return [3 /*break*/, 6];
                                case 2:
                                    if (!(profile.filetype === "png")) return [3 /*break*/, 4];
                                    return [4 /*yield*/, new Promise(function (then, reject) {
                                            svg2img(svgString, function (error, buffer) {
                                                if (error) {
                                                    reject(error);
                                                }
                                                else {
                                                    then(buffer);
                                                }
                                            });
                                        })];
                                case 3:
                                    imageBuffer = _l.sent();
                                    fs.writeFileSync(svgProfilePath, imageBuffer);
                                    return [3 /*break*/, 6];
                                case 4:
                                    if (!(profile.filetype === "jpg")) return [3 /*break*/, 6];
                                    return [4 /*yield*/, new Promise(function (then, reject) {
                                            svg2img(svgString, { format: "jpg", quality: profile.filetypeQuality }, function (error, buffer) {
                                                if (error) {
                                                    reject(error);
                                                }
                                                else {
                                                    then(buffer);
                                                }
                                            });
                                        })];
                                case 5:
                                    imageBuffer = _l.sent();
                                    fs.writeFileSync(svgProfilePath, imageBuffer);
                                    _l.label = 6;
                                case 6: return [2 /*return*/];
                            }
                        });
                    };
                    _a = 0, _b = settings.outputProfiles;
                    _j.label = 20;
                case 20:
                    if (!(_a < _b.length)) return [3 /*break*/, 23];
                    profile = _b[_a];
                    return [5 /*yield**/, _loop_2(profile)];
                case 21:
                    _j.sent();
                    _j.label = 22;
                case 22:
                    _a++;
                    return [3 /*break*/, 20];
                case 23:
                    console.log("Generating palette info");
                    palettePath = path.join(path.dirname(svgPath), path.basename(svgPath).substr(0, path.basename(svgPath).length - path.extname(svgPath).length) + ".json");
                    colorFrequency = [];
                    for (_c = 0, _d = colormapResult.colorsByIndex; _c < _d.length; _c++) {
                        color = _d[_c];
                        colorFrequency.push(0);
                    }
                    for (_e = 0, _f = facetResult.facets; _e < _f.length; _e++) {
                        facet = _f[_e];
                        if (facet !== null) {
                            colorFrequency[facet.color] += facet.pointCount;
                        }
                    }
                    colorAliasesByColor = {};
                    for (_g = 0, _h = Object.keys(settings.colorAliases); _g < _h.length; _g++) {
                        alias = _h[_g];
                        colorAliasesByColor[settings.colorAliases[alias].join(",")] = alias;
                    }
                    totalFrequency = colorFrequency.reduce(function (sum, val) { return sum + val; });
                    paletteInfo = JSON.stringify(colormapResult.colorsByIndex.map(function (color, index) {
                        return {
                            areaPercentage: colorFrequency[index] / totalFrequency,
                            color: color,
                            colorAlias: colorAliasesByColor[color.join(",")],
                            frequency: colorFrequency[index],
                            index: index,
                        };
                    }), null, 2);
                    fs.writeFileSync(palettePath, paletteInfo);
                    return [2 /*return*/];
            }
        });
    });
}
function createSVG(facetResult, colorsByIndex, sizeMultiplier, fill, stroke, addColorLabels, fontSize, fontColor, onUpdate) {
    if (fontSize === void 0) { fontSize = 60; }
    if (fontColor === void 0) { fontColor = "black"; }
    if (onUpdate === void 0) { onUpdate = null; }
    return __awaiter(this, void 0, void 0, function () {
        var svgString, xmlns, svgWidth, svgHeight, _i, _a, f, newpath, useSegments, i, svgPathString, data, i, midpointX, midpointY, svgStroke, svgFill, labelOffsetX, labelOffsetY, labelWidth, labelHeight, nrOfDigits, svgLabelString;
        return __generator(this, function (_b) {
            svgString = "";
            xmlns = "http://www.w3.org/2000/svg";
            svgWidth = sizeMultiplier * facetResult.width;
            svgHeight = sizeMultiplier * facetResult.height;
            svgString += "<?xml version=\"1.0\" standalone=\"no\"?>\n                  <svg width=\"".concat(svgWidth, "\" height=\"").concat(svgHeight, "\" xmlns=\"").concat(xmlns, "\">");
            for (_i = 0, _a = facetResult.facets; _i < _a.length; _i++) {
                f = _a[_i];
                if (f != null && f.borderSegments.length > 0) {
                    newpath = [];
                    useSegments = true;
                    if (useSegments) {
                        newpath = f.getFullPathFromBorderSegments(false);
                    }
                    else {
                        for (i = 0; i < f.borderPath.length; i++) {
                            newpath.push(new point_1.Point(f.borderPath[i].getWallX() + 0.5, f.borderPath[i].getWallY() + 0.5));
                        }
                    }
                    if (newpath[0].x !== newpath[newpath.length - 1].x || newpath[0].y !== newpath[newpath.length - 1].y) {
                        newpath.push(newpath[0]);
                    } // close loop if necessary
                    svgPathString = "";
                    data = "M ";
                    data += newpath[0].x * sizeMultiplier + " " + newpath[0].y * sizeMultiplier + " ";
                    for (i = 1; i < newpath.length; i++) {
                        midpointX = (newpath[i].x + newpath[i - 1].x) / 2;
                        midpointY = (newpath[i].y + newpath[i - 1].y) / 2;
                        data += "Q " + (midpointX * sizeMultiplier) + " " + (midpointY * sizeMultiplier) + " " + (newpath[i].x * sizeMultiplier) + " " + (newpath[i].y * sizeMultiplier) + " ";
                    }
                    svgStroke = "";
                    if (stroke) {
                        svgStroke = "#000";
                    }
                    else {
                        // make the border the same color as the fill color if there is no border stroke
                        // to not have gaps in between facets
                        if (fill) {
                            svgStroke = "rgb(".concat(colorsByIndex[f.color][0], ",").concat(colorsByIndex[f.color][1], ",").concat(colorsByIndex[f.color][2], ")");
                        }
                    }
                    svgFill = "";
                    if (fill) {
                        svgFill = "rgb(".concat(colorsByIndex[f.color][0], ",").concat(colorsByIndex[f.color][1], ",").concat(colorsByIndex[f.color][2], ")");
                    }
                    else {
                        svgFill = "none";
                    }
                    svgPathString = "<path data-facetId=\"".concat(f.id, "\" d=\"").concat(data, "\" ");
                    svgPathString += "style=\"";
                    svgPathString += "fill: ".concat(svgFill, ";");
                    if (svgStroke !== "") {
                        svgPathString += "stroke: ".concat(svgStroke, "; stroke-width:1px");
                    }
                    svgPathString += "\"";
                    svgPathString += ">";
                    svgPathString += "</path>";
                    svgString += svgPathString;
                    // add the color labels if necessary. I mean, this is the whole idea behind the paint by numbers part
                    // so I don't know why you would hide them
                    if (addColorLabels) {
                        labelOffsetX = f.labelBounds.minX * sizeMultiplier;
                        labelOffsetY = f.labelBounds.minY * sizeMultiplier;
                        labelWidth = f.labelBounds.width * sizeMultiplier;
                        labelHeight = f.labelBounds.height * sizeMultiplier;
                        nrOfDigits = (f.color + "").length;
                        svgLabelString = "<g class=\"label\" transform=\"translate(".concat(labelOffsetX, ",").concat(labelOffsetY, ")\">\n                                        <svg width=\"").concat(labelWidth, "\" height=\"").concat(labelHeight, "\" overflow=\"visible\" viewBox=\"-50 -50 100 100\" preserveAspectRatio=\"xMidYMid meet\">\n                                            <text font-family=\"Tahoma\" font-size=\"").concat((fontSize / nrOfDigits), "\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"").concat(fontColor, "\">").concat(f.color, "</text>\n                                        </svg>\n                                       </g>");
                        svgString += svgLabelString;
                    }
                }
            }
            svgString += "</svg>";
            return [2 /*return*/, svgString];
        });
    });
}
main().then(function () {
    console.log("Finished");
}).catch(function (err) {
    console.error("Error: " + err.name + " " + err.message + " " + err.stack);
});
//# sourceMappingURL=main.js.map