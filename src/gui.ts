/**
 * Module that provides function the GUI uses and updates the DOM accordingly
 */

import { CancellationToken, IMap, RGB } from "./common";
import { GUIProcessManager, ProcessResult } from "./guiprocessmanager";
import { ClusteringColorSpace, Settings } from "./settings";

declare function saveSvgAsPng(el: Node, filename: string): void;

let processResult: ProcessResult | null = null;
let cancellationToken: CancellationToken = new CancellationToken();

function updateWfsExportState(enabled: boolean) {
    if (typeof window !== "undefined") {
        (window as any).__wfsExportReady = !!enabled;
    }
    const exportButtonIds = ["btnDownloadWFSZip", "btnExportWFS"];
    for (const buttonId of exportButtonIds) {
        const exportBtn = document.getElementById(buttonId) as HTMLButtonElement | null;
        if (exportBtn) {
            exportBtn.disabled = !enabled;
            exportBtn.classList.toggle("disabled", !enabled);
        }
    }
}

const timers: IMap<Date> = {};
export function time(name: string) {
    console.time(name);
    timers[name] = new Date();
}

export function timeEnd(name: string) {
    console.timeEnd(name);
    const ms = new Date().getTime() - timers[name].getTime();
    log(name + ": " + ms + "ms");
    delete timers[name];
}

export function log(str: string) {
    $("#log").append("<br/><span>" + str + "</span>");
}

export function parseSettings(): Settings {
    const settings = new Settings();

    if ($("#optColorSpaceRGB").prop("checked")) {
        settings.kMeansClusteringColorSpace = ClusteringColorSpace.RGB;
    } else if ($("#optColorSpaceHSL").prop("checked")) {
        settings.kMeansClusteringColorSpace = ClusteringColorSpace.HSL;
    } else if ($("#optColorSpaceRGB").prop("checked")) {
        settings.kMeansClusteringColorSpace = ClusteringColorSpace.LAB;
    }

    if ($("#optFacetRemovalLargestToSmallest").prop("checked")) {
        settings.removeFacetsFromLargeToSmall = true;
    } else {
        settings.removeFacetsFromLargeToSmall = false;
    }

    settings.randomSeed = parseInt($("#txtRandomSeed").val() + "");
    settings.kMeansNrOfClusters = parseInt($("#txtNrOfClusters").val() + "");
    settings.kMeansMinDeltaDifference = parseFloat($("#txtClusterPrecision").val() + "");

    settings.removeFacetsSmallerThanNrOfPoints = parseInt($("#txtRemoveFacetsSmallerThan").val() + "");
    settings.maximumNumberOfFacets = parseInt($("#txtMaximumNumberOfFacets").val() + "");

    settings.nrOfTimesToHalveBorderSegments = parseInt($("#txtNrOfTimesToHalveBorderSegments").val() + "");

    settings.narrowPixelStripCleanupRuns = parseInt($("#txtNarrowPixelStripCleanupRuns").val() + "");

    settings.resizeImageIfTooLarge = $("#chkResizeImage").prop("checked");
    settings.resizeImageWidth = parseInt($("#txtResizeWidth").val() + "");
    settings.resizeImageHeight = parseInt($("#txtResizeHeight").val() + "");

    const restrictedColorLines = ($("#txtKMeansColorRestrictions").val() + "").split("\n");
    for (const line of restrictedColorLines) {
        const tline = line.trim();
        if (tline.indexOf("//") === 0) {
            // comment, skip
        } else {
            const rgbparts = tline.split(",");
            if (rgbparts.length === 3) {
                let red = parseInt(rgbparts[0]);
                let green = parseInt(rgbparts[1]);
                let blue = parseInt(rgbparts[2]);
                if (red < 0) red = 0;
                if (red > 255) red = 255;
                if (green < 0) green = 0;
                if (green > 255) green = 255;
                if (blue < 0) blue = 0;
                if (blue > 255) blue = 255;

                if (!isNaN(red) && !isNaN(green) && !isNaN(blue)) {
                    settings.kMeansColorRestrictions.push([red, green, blue]);
                }
            }
        }
    }

    return settings;
}

export function getProcessResult(): ProcessResult | null {
    return processResult;
}

export async function createWfsExportSvgs(sizeMultiplier: number, fontSize: number, fontColor: string) {
    if (processResult == null) {
        throw new Error('No processed result available');
    }

    const variants = [
        { label: 'BW_Numbers', fill: false, stroke: true, labels: true },
        { label: 'BW_Outline', fill: false, stroke: true, labels: false },
        { label: 'Colour_Reference', fill: true, stroke: false, labels: false },
        { label: 'Colour_Numbers', fill: true, stroke: false, labels: true },
        { label: 'Colour_Numbers_Outline', fill: true, stroke: true, labels: true }
    ];

    const result: { label: string; svg: SVGElement }[] = [];
    for (const v of variants) {
        // Reuse the same processed facet result and colorsByIndex for each variant
        const svgEl = await GUIProcessManager.createSVG(processResult.facetResult, processResult.colorsByIndex, sizeMultiplier, v.fill, v.stroke, v.labels, fontSize, fontColor);
        result.push({ label: v.label, svg: svgEl });
    }

    return result;
}

export async function process() {
    try {
        updateWfsExportState(false); // disable export while processing
        const settings: Settings = parseSettings();
        // cancel old process & create new
        cancellationToken.isCancelled = true;
        cancellationToken = new CancellationToken();
        processResult = await GUIProcessManager.process(settings, cancellationToken);
        updateWfsExportState(true);
        await updateOutput();
        const tabsOutput = M.Tabs.getInstance(document.getElementById("tabsOutput")!);
        tabsOutput.select("output-pane");
    } catch (e) {
        const err = e as Error;
        updateWfsExportState(false);
        log("Error: " + err.message + " at " + err.stack);
    }
}

export async function updateOutput() {

    if (processResult != null) {
        const showLabels = $("#chkShowLabels").prop("checked");
        const fill = $("#chkFillFacets").prop("checked");
        const stroke = $("#chkShowBorders").prop("checked");

        const sizeMultiplier = parseInt($("#txtSizeMultiplier").val() + "");
        const fontSize = parseInt($("#txtLabelFontSize").val() + "");

        const fontColor = $("#txtLabelFontColor").val() + "";

        $("#statusSVGGenerate").css("width", "0%");

        $(".status.SVGGenerate").removeClass("complete");
        $(".status.SVGGenerate").addClass("active");

        const svg = await GUIProcessManager.createSVG(processResult.facetResult, processResult.colorsByIndex, sizeMultiplier, fill, stroke, showLabels, fontSize, fontColor, (progress) => {
            if (cancellationToken.isCancelled) { throw new Error("Cancelled"); }
            $("#statusSVGGenerate").css("width", Math.round(progress * 100) + "%");
        });
        $("#svgContainer").empty().append(svg);
        $("#palette").empty().append(createPaletteHtml(processResult.colorsByIndex));
        ($("#palette .color") as any).tooltip();
        $(".status").removeClass("active");
        $(".status.SVGGenerate").addClass("complete");
    }
}

function createPaletteHtml(colorsByIndex: RGB[]) {
    let html = "";
    for (let c: number = 0; c < colorsByIndex.length; c++) {
        const style = "background-color: " + `rgb(${colorsByIndex[c][0]},${colorsByIndex[c][1]},${colorsByIndex[c][2]})`;
        html += `<div class="color" class="tooltipped" style="${style}" data-tooltip="${colorsByIndex[c][0]},${colorsByIndex[c][1]},${colorsByIndex[c][2]}">${c}</div>`;
    }
    return $(html);
}

function rgbToHex(color: RGB): string {
    return "#" + color.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function drawRoundedRectangle(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawCenteredTextWithLetterSpacing(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, letterSpacing: number) {
    const characters = Array.from(text);
    const textWidth = characters.reduce((width, character) => width + ctx.measureText(character).width, 0);
    const totalWidth = textWidth + Math.max(0, characters.length - 1) * letterSpacing;
    let x = centerX - totalWidth / 2;

    ctx.textAlign = "left";
    for (const character of characters) {
        ctx.fillText(character, x, y);
        x += ctx.measureText(character).width + letterSpacing;
    }
    ctx.textAlign = "center";
}

function loadPaletteLogo(): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const logo = new Image();
        logo.onload = () => resolve(logo);
        logo.onerror = () => reject(new Error("Unable to load the Wattle Fern Studio palette logo"));
        logo.src = "assets/WFS-Colour-Palette.svg";
    });
}

async function createPaletteCanvas(colorsByIndex: RGB[]): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");

    const nrOfItemsPerRow = 5;
    const nrRows = Math.ceil(colorsByIndex.length / nrOfItemsPerRow);
    const canvasWidth = 1200;
    const headerHeight = 210;
    const footerHeight = 190;
    const rowHeight = 235;
    const swatchSize = 150;
    const columnGap = 50;
    const paletteWidth = nrOfItemsPerRow * swatchSize + (nrOfItemsPerRow - 1) * columnGap;
    const paletteLeft = (canvasWidth - paletteWidth) / 2;

    canvas.width = canvasWidth;
    canvas.height = headerHeight + nrRows * rowHeight + footerHeight;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#cfbaab";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#5E3F24";
    ctx.font = "72px Roboto, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(94, 63, 36, 0.35)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    drawCenteredTextWithLetterSpacing(ctx, "Colour Palette", canvas.width / 2, 105, 3);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    for (let i = 0; i < colorsByIndex.length; i++) {
        const color = colorsByIndex[i];

        const x = paletteLeft + (i % nrOfItemsPerRow) * (swatchSize + columnGap);
        const y = headerHeight + Math.floor(i / nrOfItemsPerRow) * rowHeight;

        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        drawRoundedRectangle(ctx, x, y, swatchSize, swatchSize, 22);
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.font = "bold 38px Arial, sans-serif";
        ctx.fillText(i + "", x + swatchSize / 2, y + swatchSize / 2);

        ctx.font = "22px Arial, sans-serif";
        ctx.fillStyle = "#161616";
        ctx.fillText(rgbToHex(color), x + swatchSize / 2, y + swatchSize + 35);
    }

    const logo = await loadPaletteLogo();
    const logoWidth = 560;
    const logoHeight = logoWidth * logo.naturalHeight / logo.naturalWidth;
    const logoY = canvas.height - footerHeight + (footerHeight - logoHeight) / 2;
    ctx.drawImage(logo, (canvas.width - logoWidth) / 2, logoY, logoWidth, logoHeight);

    return canvas;
}

export async function createPalettePngBlob(): Promise<Blob> {
    if (processResult == null) {
        throw new Error("No processed result available");
    }

    const canvas = await createPaletteCanvas(processResult.colorsByIndex);

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Failed to generate palette PNG"));
            }
        }, "image/png");
    });
}

export async function downloadPalettePng() {
    try {
        const blob = await createPalettePngBlob();
        const dataURL = URL.createObjectURL(blob);
        const dl = document.createElement("a");
        document.body.appendChild(dl);
        dl.setAttribute("href", dataURL);
        dl.setAttribute("download", "palette.png");
        dl.click();
        setTimeout(() => URL.revokeObjectURL(dataURL), 0);
        dl.remove();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert("Unable to create palette PNG: " + message);
    }
}

export function downloadPNG() {
    if ($("#svgContainer svg").length > 0) {
        saveSvgAsPng($("#svgContainer svg").get(0), "paintbynumbers.png");
    }
}

export function downloadSVG() {
    if ($("#svgContainer svg").length > 0) {
        const svgEl = $("#svgContainer svg").get(0) as any;

        svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const svgData = svgEl.outerHTML;
        const preface = '<?xml version="1.0" standalone="no"?>\r\n';
        const svgBlob = new Blob([preface, svgData], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = svgUrl;
        downloadLink.download = "paintbynumbers.svg";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        /*
        var svgAsXML = (new XMLSerializer).serializeToString(<any>$("#svgContainer svg").get(0));
        let dataURL = "data:image/svg+xml," + encodeURIComponent(svgAsXML);
        var dl = document.createElement("a");
        document.body.appendChild(dl);
        dl.setAttribute("href", dataURL);
        dl.setAttribute("download", "paintbynumbers.svg");
        dl.click();
        */
    }
}

export function loadExample(imgId: string) {
    // load image
    const img = document.getElementById(imgId) as HTMLImageElement;
    const c = document.getElementById("canvas") as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
}
