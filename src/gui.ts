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
    const exportButtonIds = ["btnDownloadWFSZip", "btnExportWFS", "btnDownloadListingImage"];
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
        await updateListingImagePreview();
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

function drawTextWithLetterSpacing(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, letterSpacing: number) {
    const previousTextAlign = ctx.textAlign;
    ctx.textAlign = "left";
    for (const character of Array.from(text)) {
        ctx.fillText(character, x, y);
        x += ctx.measureText(character).width + letterSpacing;
    }
    ctx.textAlign = previousTextAlign;
}

function loadPaletteLogo(): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const logo = new Image();
        logo.onload = () => resolve(logo);
        logo.onerror = () => reject(new Error("Unable to load the Wattle Fern Studio palette logo"));
        logo.src = "assets/WFS-Colour-Palette.svg";
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load listing image asset: " + src));
        image.src = src;
    });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Failed to generate PNG"));
            }
        }, "image/png");
    });
}

function drawListingTick(ctx: CanvasRenderingContext2D, tick: HTMLImageElement, text: string, y: number) {
    ctx.drawImage(tick, 338, y - 35, 63, 59);
    ctx.fillStyle = "#5E3F24";
    ctx.font = "36px 'Raleway', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 435, y);
}

function drawBonusBurst(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, outerRadius: number, innerRadius: number) {
    const pointCount = 40;
    ctx.beginPath();
    for (let i = 0; i < pointCount; i++) {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / pointCount;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.fillStyle = "#B49D8B";
    ctx.fill();
}

function drawArtworkInIpadScreen(ctx: CanvasRenderingContext2D, artwork: HTMLCanvasElement, ipadX: number, ipadY: number) {
    const topLeft = { x: ipadX + 271, y: ipadY + 71 };
    const topRight = { x: ipadX + 1186, y: ipadY + 174 };
    const bottomRight = { x: ipadX + 1114, y: ipadY + 831 };
    const bottomLeft = { x: ipadX + 202, y: ipadY + 707 };
    const screenRatio = 895 / 621;
    const artworkRatio = artwork.width / artwork.height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = artwork.width;
    let sourceHeight = artwork.height;

    if (artworkRatio > screenRatio) {
        sourceWidth = artwork.height * screenRatio;
        sourceX = (artwork.width - sourceWidth) / 2;
    } else {
        sourceHeight = artwork.width / screenRatio;
        sourceY = (artwork.height - sourceHeight) / 2;
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(
        (topRight.x - topLeft.x) / sourceWidth,
        (topRight.y - topLeft.y) / sourceWidth,
        (bottomLeft.x - topLeft.x) / sourceHeight,
        (bottomLeft.y - topLeft.y) / sourceHeight,
        topLeft.x,
        topLeft.y
    );
    ctx.drawImage(artwork, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    ctx.restore();
}

/*
 * HOW TO POSITION ELEMENTS IN THE 2000 x 1500 LISTING IMAGE
 *
 * Canvas positions start at the top-left corner: x = 0, y = 0.
 * - Move right: increase x.       Example: x 400 -> 420 moves right 20 px.
 * - Move left: decrease x.        Example: x 400 -> 380 moves left 20 px.
 * - Move down: increase y.        Example: y 600 -> 630 moves down 30 px.
 * - Move up: decrease y.          Example: y 600 -> 570 moves up 30 px.
 *
 * TEXT: ctx.fillText("Text", x, y)
 * Example: ctx.fillText("Bonus", 430, 1215);
 * Change 430 to 450 to move it right 20 px, or change 1215 to 1255 to move it
 * down 40 px. The active ctx.textAlign setting determines whether x refers to
 * the text's left edge or centre.
 *
 * IMAGES: ctx.drawImage(image, x, y, width, height)
 * Example: ctx.drawImage(brush, 102, 1164, 418, 297);
 * Change x/y to move it. To enlarge it by 10%, multiply both width and height
 * by 1.10 (418 x 297 becomes approximately 460 x 327). Changing both by the
 * same percentage prevents distortion.
 *
 * CHECKLIST ROWS: drawListingTick(ctx, tick, "Text", y)
 * Only the final value controls the row's vertical position. For example,
 * changing 505 to 525 moves that complete tick-and-text row down 20 px.
 *
 * BONUS BURST: drawBonusBurst(ctx, centreX, centreY, outerRadius, innerRadius)
 * Increase/decrease centreX or centreY to move it. Increase both radius values
 * by the same percentage to enlarge it without changing the point proportions.
 * The Bonus text, brush and Procreate text are separate elements; move all of
 * their x or y values by the same amount when moving the whole bonus group.
 *
 * IPAD: ipadX and ipadY move the complete iPad. Example: ipadX 760 -> 780
 * moves it right 20 px. The four corner values in drawArtworkInIpadScreen
 * control only the generated artwork inside the screen. Apply the same x or y
 * adjustment to all four corners to move it without changing its rotation.
 */
export async function createListingImagePngBlob(): Promise<Blob> {
    if (processResult == null) {
        throw new Error("No processed result available");
    }

    const colourCount = parseInt($("#txtNrOfClusters").val() + "", 10) || processResult.colorsByIndex.length;
    const artwork = document.getElementById("cReduction") as HTMLCanvasElement;
    if (!artwork || artwork.width === 0 || artwork.height === 0) {
        throw new Error("Finished colour artwork is not available");
    }
    await Promise.all([
        document.fonts.load("86px 'Eyesome Script'"),
        document.fonts.load("104px 'Roboto'"),
        document.fonts.load("36px 'Raleway'"),
        document.fonts.load("700 34px 'Raleway'")
    ]);
    const [ipad, tick, logos, brush] = await Promise.all([
        loadImage("assets/ipad-procreate-toolbar.svg"),
        loadImage("assets/tick.svg"),
        loadImage("assets/logos.svg"),
        // Avoid reusing a cached copy while the brush artwork is being refined locally.
        loadImage("assets/brush.png?v=" + Date.now())
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = 2000;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#CFBAAB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.moveTo(0, 48);
    ctx.lineTo(710, 48);
    ctx.lineTo(760, 128);
    ctx.lineTo(710, 208);
    ctx.lineTo(0, 208);
    ctx.closePath();
    ctx.fillStyle = "#B49D8B";
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "86px 'Eyesome Script', 'Brush Script MT', 'Segoe Script', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Digital", 460, 127);

    ctx.fillStyle = "#5E3F24";
    ctx.font = "104px 'Roboto', Arial, sans-serif";
    ctx.shadowColor = "rgba(94, 63, 36, 0.25)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    drawCenteredTextWithLetterSpacing(ctx, "Paint by Number", 755, 355, 6);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    drawListingTick(ctx, tick, "Numbered template file", 505);
    drawListingTick(ctx, tick, colourCount + "-colour palette", 590);
    drawListingTick(ctx, tick, "Reference image", 675);
    drawListingTick(ctx, tick, "Quick start guide", 760);
    ctx.drawImage(logos, 430, 810, 310, 204);

    drawBonusBurst(ctx, 430, 1370, 320, 280);
    ctx.fillStyle = "white";
    ctx.font = "82px 'Eyesome Script', 'Brush Script MT', 'Segoe Script', cursive";
    ctx.textAlign = "center";
    ctx.fillText("Bonus", 430, 1205);
    ctx.drawImage(brush, 232, 1195, 418, 297);
    ctx.font = "700 34px 'Raleway', Arial, sans-serif";
    ctx.textAlign = "left";
    drawTextWithLetterSpacing(ctx, "Procreate", 445, 1330, 2);
    drawTextWithLetterSpacing(ctx, "brushes", 485, 1385, 2);

    const ipadX = 760;
    const ipadY = 545;
    // TODO: Replace this finished colour artwork with an automatically generated partially coloured preview.
    drawArtworkInIpadScreen(ctx, artwork, ipadX, ipadY);
    ctx.drawImage(ipad, ipadX, ipadY, 1231, 874);

    return canvasToPngBlob(canvas);
}

async function showListingImagePreview(blob: Blob) {
    const preview = document.getElementById("listingImagePreview") as HTMLImageElement;
    const previousPreviewUrl = preview.dataset.objectUrl;
    if (previousPreviewUrl) {
        URL.revokeObjectURL(previousPreviewUrl);
    }
    const url = URL.createObjectURL(blob);
    preview.src = url;
    preview.dataset.objectUrl = url;
    preview.style.display = "block";
}

export async function updateListingImagePreview() {
    try {
        const blob = await createListingImagePngBlob();
        await showListingImagePreview(blob);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Unable to update listing image preview", err);
        log("Unable to update listing image preview: " + message);
    }
}

export async function downloadListingImagePng() {
    try {
        log("Creating listing image...");
        const blob = await createListingImagePngBlob();
        await showListingImagePreview(blob);
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        document.body.appendChild(link);
        link.href = downloadUrl;
        link.download = "1-Paint-by-number.png";
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);
        log("Listing image created: 1-Paint-by-number.png");
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Unable to create listing image", err);
        log("Unable to create listing image: " + message);
        alert("Unable to create listing image: " + message);
    }
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
