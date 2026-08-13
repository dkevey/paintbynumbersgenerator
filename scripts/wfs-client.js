$(function() {
    // add click handler for Generate WFS Files
    $('#btnGenerateWFS').click(async function() {
        const btn = $(this);
        const productName = $('#txtProductName').val() + '';
        const colours = parseInt($('#txtNrOfColours').val() + '', 10);
        const fileInput = $('#file')[0];

        // validation
        if (!productName || productName.trim().length === 0) {
            alert('Product Name is required');
            return;
        }
        if (!fileInput.files || fileInput.files.length === 0) {
            alert('Please select an image file');
            return;
        }
        if (isNaN(colours) || colours <= 0) {
            alert('Number of Colours must be a positive integer');
            return;
        }

        btn.prop('disabled', true).text('Processing...');

        const fd = new FormData();
        fd.append('image', fileInput.files[0]);
        fd.append('productName', productName);
        fd.append('colours', ''+colours);

        try {
            const resp = await fetch('/api/generate', { method: 'POST', body: fd });
            const data = await resp.json();
            if (!data.success) {
                alert('Generation failed: ' + (data.error || 'Unknown error'));
                btn.prop('disabled', false).text('Generate WFS Files');
                return;
            }
            // show links
            const $out = $('#svgContainer');
            $out.empty();
            const list = $('<ul></ul>');
            for (const f of data.files) {
                const li = $('<li></li>');
                const a = $('<a></a>').attr('href', f.url).text(f.name).attr('target','_blank');
                li.append(a);
                list.append(li);
            }
            $out.append('<h5>Generated files</h5>');
            $out.append(list);
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            btn.prop('disabled', false).text('Generate WFS Files');
        }
    });
});
