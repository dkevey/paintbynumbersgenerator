(function() {
    let zipDownloadUrl = null;

    function sanitizeProductName(value) {
        return (value || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '') || 'untitled';
    }

    function updateExportButtonState(enabled) {
        const shouldEnable = !!enabled && !!$('#txtProductName').val().trim();
        $('#btnDownloadWFSZip, #btnExportWFS').each(function() {
            $(this).prop('disabled', !shouldEnable);
            $(this).toggleClass('disabled', !shouldEnable);
        });
    }

    function clearZipDownload() {
        if (zipDownloadUrl) {
            URL.revokeObjectURL(zipDownloadUrl);
            zipDownloadUrl = null;
        }
        $('#wfsZipDownload').empty().hide();
    }

    function invalidateExportState() {
        clearZipDownload();
        if (typeof window !== 'undefined') {
            window.__wfsExportReady = false;
        }
        updateExportButtonState(false);
    }

    async function svgToPngBlob(svgElement) {
        const svgText = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = svgElement.getAttribute('width') ? parseInt(svgElement.getAttribute('width'), 10) : img.width;
                canvas.height = svgElement.getAttribute('height') ? parseInt(svgElement.getAttribute('height'), 10) : img.height;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((pngBlob) => {
                    URL.revokeObjectURL(url);
                    resolve(pngBlob);
                }, 'image/png');
            };
            img.onerror = function(err) {
                URL.revokeObjectURL(url);
                reject(err || new Error('Failed to render SVG to PNG'));
            };
            img.src = url;
        });
    }

    function blobToUint8Array(blob) {
        return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
    }

    function getOriginalExtension(fileName) {
        const match = (fileName || '').match(/(\.[A-Za-z0-9]+)$/);
        return match ? match[1] : '.png';
    }

    function createZipArchive(entries) {
        return new Promise((resolve, reject) => {
            if (!window.fflate || typeof window.fflate.zip !== 'function') {
                reject(new Error('The browser ZIP library did not load'));
                return;
            }
            window.fflate.zip(entries, { level: 6, mem: 4 }, (error, data) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    }

    function offerZipDownload(zipBlob, zipFileName) {
        clearZipDownload();
        zipDownloadUrl = URL.createObjectURL(zipBlob);

        const link = $('<a class="waves-effect waves-light btn"></a>')
            .attr('href', zipDownloadUrl)
            .attr('download', zipFileName)
            .text('Download ' + zipFileName);
        $('#wfsZipDownload')
            .append($('<span></span>').text('Your ZIP is ready. '))
            .append(link)
            .show();

        const isIpad = /iPad/.test(navigator.userAgent) ||
            (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
        if (!isIpad) {
            link.get(0).click();
        }
    }

    async function exportWfsZip() {
        const btn = $('#btnDownloadWFSZip');
        const originalText = btn.text();
        const productName = ($('#txtProductName').val() + '').trim();
        const fileInput = $('#file')[0];

        if (!productName) {
            alert('Product Name is required');
            return;
        }
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert('Please select an image file');
            return;
        }

        btn.prop('disabled', true).text('Preparing ZIP...').addClass('disabled');
        clearZipDownload();

        try {
            const gui = await new Promise((resolve) => requirejs(['gui'], resolve));
            const currentResult = gui.getProcessResult && gui.getProcessResult();
            if (!currentResult) {
                throw new Error('Please process the image before exporting WFS files');
            }

            const safeName = sanitizeProductName(productName);
            const productFolderName = `WFS_${safeName}`;
            const productRoot = productFolderName + '/';
            const settings = {
                sizeMultiplier: parseInt($('#txtSizeMultiplier').val() + '', 10) || 3,
                fontSize: parseInt($('#txtLabelFontSize').val() + '', 10) || 50,
                fontColor: ($('#txtLabelFontColor').val() + '') || '#000000'
            };
            const variants = [
                { label: 'BW_Numbers', fill: false, stroke: true, labels: true },
                { label: 'BW_Outline', fill: false, stroke: true, labels: false },
                { label: 'Colour_Reference', fill: true, stroke: false, labels: false },
                { label: 'Colour_Numbers', fill: true, stroke: false, labels: true },
                { label: 'Colour_Numbers_Outline', fill: true, stroke: true, labels: true }
            ];
            const empty = new Uint8Array(0);
            const entries = {};

            [
                productRoot,
                productRoot + '_Shop/',
                productRoot + '_Shop/Canva/',
                productRoot + '_Shop/Listing images/',
                productRoot + '_Shop/Social Media/',
                productRoot + 'PNG/',
                productRoot + 'PROCREATE/',
                productRoot + 'SVG/'
            ].forEach((directory) => {
                entries[directory] = [empty, { level: 0 }];
            });

            const originalFile = fileInput.files[0];
            const originalName = `${productFolderName}_Original_Image${getOriginalExtension(originalFile.name)}`;
            entries[productRoot + originalName] = [await blobToUint8Array(originalFile), { level: 0 }];

            btn.text('Creating artwork...');
            const svgs = await gui.createWfsExportSvgs(settings.sizeMultiplier, settings.fontSize, settings.fontColor);
            for (let i = 0; i < svgs.length; i++) {
                const variant = svgs[i];
                const baseFileName = `${productFolderName}_${variant.label}`;
                const svgText = new XMLSerializer().serializeToString(variant.svg);
                entries[productRoot + 'SVG/' + baseFileName + '.svg'] = [window.fflate.strToU8(svgText), { level: 6 }];

                btn.text(`Creating PNG ${i + 1} of ${svgs.length}...`);
                const pngBlob = await svgToPngBlob(variant.svg);
                if (!pngBlob) {
                    throw new Error('Failed to create ' + baseFileName + '.png');
                }
                entries[productRoot + 'PNG/' + baseFileName + '.png'] = [await blobToUint8Array(pngBlob), { level: 0 }];
            }

            btn.text('Creating colour palette...');
            const palettePngBlob = await gui.createPalettePngBlob();
            entries[productRoot + 'PNG/' + productFolderName + '_Colour_Palette.png'] = [await blobToUint8Array(palettePngBlob), { level: 0 }];

            const baseJson = {
                productName: productName,
                sanitizedProductName: safeName,
                generatedBy: 'browser-zip-export',
                createdAt: new Date().toISOString(),
                originalImage: originalName,
                palette: currentResult.colorsByIndex.map((color) => ({ r: color[0], g: color[1], b: color[2] })),
                numberOfColors: parseInt($('#txtNrOfClusters').val() + '', 10) || 30,
                variants: variants.map((variant) => ({
                    name: `${productFolderName}_${variant.label}`,
                    fill: variant.fill,
                    stroke: variant.stroke,
                    labels: variant.labels
                }))
            };
            entries[productRoot + 'base.json'] = [window.fflate.strToU8(JSON.stringify(baseJson, null, 2)), { level: 6 }];

            btn.text('Building ZIP...');
            const zipData = await createZipArchive(entries);
            offerZipDownload(new Blob([zipData], { type: 'application/zip' }), productFolderName + '.zip');
        } catch (error) {
            alert('Error exporting WFS ZIP: ' + (error && error.message ? error.message : error));
        } finally {
            btn.prop('disabled', false).text(originalText).removeClass('disabled');
        }
    }

    async function exportWfsFiles() {
        const btn = $('#btnExportWFS');
        const originalText = btn.text();
        btn.prop('disabled', true).text('Exporting...').addClass('disabled');

        const productName = $('#txtProductName').val() + '';
        const fileInput = $('#file')[0];
        const settings = {
            sizeMultiplier: parseInt($('#txtSizeMultiplier').val() + '', 10) || 3,
            fontSize: parseInt($('#txtLabelFontSize').val() + '', 10) || 50,
            fontColor: ($('#txtLabelFontColor').val() + '') || '#000000'
        };

        if (!productName || !productName.trim()) {
            alert('Product Name is required');
            btn.prop('disabled', false).text(originalText).removeClass('disabled');
            return;
        }
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert('Please select an image file');
            btn.prop('disabled', false).text(originalText).removeClass('disabled');
            return;
        }

        try {
            const gui = await new Promise((resolve) => requirejs(['gui'], resolve));
            const currentResult = gui.getProcessResult && gui.getProcessResult();
            if (!currentResult) {
                alert('Please process the image before exporting WFS files');
                btn.prop('disabled', false).text(originalText).removeClass('disabled');
                return;
            }

            const fd = new FormData();
            fd.append('image', fileInput.files[0]);
            fd.append('productName', productName);

            const safeName = sanitizeProductName(productName);
            const baseJson = {
                productName: productName.trim(),
                sanitizedProductName: safeName,
                generatedBy: 'browser-export',
                createdAt: new Date().toISOString(),
                palette: currentResult.colorsByIndex.map((color) => ({ r: color[0], g: color[1], b: color[2] })),
                numberOfColors: parseInt($('#txtNrOfClusters').val() + '', 10) || 30,
                variants: []
            };
            fd.append('baseJson', JSON.stringify(baseJson, null, 2));

            // ask gui to create the five WFS SVG variants from the processed result
            const svgs = await gui.createWfsExportSvgs(settings.sizeMultiplier, settings.fontSize, settings.fontColor);

            for (const v of svgs) {
                const svgFileName = `WFS_${safeName}_${v.label}.svg`;
                const pngFileName = `WFS_${safeName}_${v.label}.png`;
                const svgBlob = new Blob([new XMLSerializer().serializeToString(v.svg)], { type: 'image/svg+xml;charset=utf-8' });
                fd.append('svgFiles', svgBlob, svgFileName);
                const pngBlob = await svgToPngBlob(v.svg);
                fd.append('pngFiles', pngBlob, pngFileName);
                baseJson.variants.push({ name: `WFS_${safeName}_${v.label}`, fill: false, stroke: false, labels: false });
            }

            const palettePngBlob = await gui.createPalettePngBlob();
            fd.append('pngFiles', palettePngBlob, `WFS_${safeName}_Colour_Palette.png`);

            // replace baseJson with updated variants
            fd.set('baseJson', JSON.stringify(baseJson, null, 2));

            const response = await fetch('/api/export-wfs', { method: 'POST', body: fd });
            const data = await response.json();
            if (!data.success) {
                alert('WFS export failed: ' + (data.error || 'Unknown error'));
                btn.prop('disabled', false).text(originalText).removeClass('disabled');
                return;
            }

            const $out = $('#svgContainer');
            $out.empty();
            const list = $('<ul></ul>');
            for (const f of data.files) {
                const li = $('<li></li>');
                const a = $('<a></a>').attr('href', f.url).text(f.name).attr('target', '_blank');
                li.append(a);
                list.append(li);
            }
            $out.append('<h5>Generated WFS files</h5>');
            $out.append(list);

            alert('WFS export completed successfully: ' + data.job);
        } catch (error) {
            alert('Error exporting WFS files: ' + (error && error.message ? error.message : error));
        } finally {
            btn.prop('disabled', false).text(originalText).removeClass('disabled');
        }
    }

    $(function() {
        $('#btnDownloadWFSZip').click(exportWfsZip);
        $('#btnExportWFS').click(exportWfsFiles);
        $('#file, #txtProductName, #txtNrOfClusters, #txtClusterPrecision, #txtRandomSeed, #txtResizeWidth, #txtResizeHeight, #chkResizeImage, #optColorSpaceRGB, #optColorSpaceHSL, #optColorSpaceLAB, #txtRemoveFacetsSmallerThan, #txtMaximumNumberOfFacets, #txtNrOfTimesToHalveBorderSegments, #txtNarrowPixelStripCleanupRuns, #txtSizeMultiplier, #txtLabelFontSize, #txtLabelFontColor, #chkShowLabels, #chkFillFacets, #chkShowBorders').on('change input', function() {
            invalidateExportState();
        });

        updateExportButtonState(false);
    });
})();
