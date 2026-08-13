(function() {
    function sanitizeProductName(value) {
        return (value || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '') || 'untitled';
    }

    function updateExportButtonState(enabled) {
        const btn = $('#btnExportWFS');
        const shouldEnable = !!enabled && !!$('#txtProductName').val().trim();
        btn.prop('disabled', !shouldEnable);
        btn.toggleClass('disabled', !shouldEnable);
    }

    function invalidateExportState() {
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
        $('#btnExportWFS').click(exportWfsFiles);
        $('#file, #txtProductName, #txtNrOfClusters, #txtClusterPrecision, #txtRandomSeed, #txtResizeWidth, #txtResizeHeight, #chkResizeImage, #optColorSpaceRGB, #optColorSpaceHSL, #optColorSpaceLAB, #txtRemoveFacetsSmallerThan, #txtMaximumNumberOfFacets, #txtNrOfTimesToHalveBorderSegments, #txtNarrowPixelStripCleanupRuns, #txtSizeMultiplier, #txtLabelFontSize, #txtLabelFontColor, #chkShowLabels, #chkFillFacets, #chkShowBorders').on('change input', function() {
            invalidateExportState();
        });

        updateExportButtonState(false);
    });
})();
