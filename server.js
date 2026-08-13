const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const sanitize = require('sanitize-filename');

const app = express();
const upload = multer({ dest: os.tmpdir() });

const PORT = process.env.PORT || 3000;
const REPO_ROOT = path.resolve(__dirname);
const OUT_ROOT = path.join(REPO_ROOT, 'out');

function ensureWfsProductStructure(productFolder) {
    const pngDir = path.join(productFolder, 'PNG');
    const svgDir = path.join(productFolder, 'SVG');
    const procreateDir = path.join(productFolder, 'PROCREATE');
    const shopDir = path.join(productFolder, '_Shop');
    const shopCanvaDir = path.join(shopDir, 'Canva');
    const shopListingDir = path.join(shopDir, 'Listing images');
    const shopSocialDir = path.join(shopDir, 'Social Media');

    fs.mkdirSync(pngDir, { recursive: true });
    fs.mkdirSync(svgDir, { recursive: true });
    fs.mkdirSync(procreateDir, { recursive: true });
    fs.mkdirSync(shopCanvaDir, { recursive: true });
    fs.mkdirSync(shopListingDir, { recursive: true });
    fs.mkdirSync(shopSocialDir, { recursive: true });
}

function sanitizeProductName(productNameRaw) {
    const base = sanitize(productNameRaw || '').trim();
    const sanitized = (base || 'untitled').replace(/\s+/g, '-');
    return sanitized.replace(/[^A-Za-z0-9_-]/g, '');
}

function moveUploadedFile(source, target) {
    try {
        fs.renameSync(source, target);
    } catch (error) {
        if (error && (error.code === 'EXDEV' || error.code === 'ENOTSUP')) {
            fs.copyFileSync(source, target);
            fs.unlinkSync(source);
            return;
        }
        throw error;
    }
}

// serve existing static site
app.use(express.static(REPO_ROOT));

// expose job folders under /jobs/<job> -> maps to out/<job>
app.use('/jobs', express.static(OUT_ROOT));

app.post('/api/export-wfs', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'svgFiles', maxCount: 20 },
    { name: 'pngFiles', maxCount: 20 },
    { name: 'baseJson', maxCount: 1 }
]), async (req, res) => {
    try {
        const productNameRaw = req.body.productName || req.body.productname || req.body.name;
        const sanitized = sanitizeProductName(productNameRaw);
        if (!sanitized || sanitized === 'untitled') {
            return res.status(400).json({ success: false, error: 'Product Name is required' });
        }

        const productFolderName = `WFS_${sanitized}`;
        const productFolder = path.join(OUT_ROOT, productFolderName);
        if (fs.existsSync(productFolder)) {
            return res.status(409).json({ success: false, error: `Product folder already exists: ${productFolderName}` });
        }

        fs.mkdirSync(productFolder, { recursive: true });
        ensureWfsProductStructure(productFolder);

        const imageFile = req.files && req.files.image && req.files.image[0];
        if (!imageFile) {
            fs.rmSync(productFolder, { recursive: true, force: true });
            return res.status(400).json({ success: false, error: 'Original image is required' });
        }

        const originalExt = path.extname(imageFile.originalname || '') || '.png';
        const originalName = `WFS_${sanitized}_Original_Image${originalExt}`;
        const originalTarget = path.join(productFolder, originalName);
        moveUploadedFile(imageFile.path, originalTarget);

        const svgFiles = req.files && req.files.svgFiles ? req.files.svgFiles : [];
        const pngFiles = req.files && req.files.pngFiles ? req.files.pngFiles : [];

        for (const file of svgFiles) {
            const target = path.join(productFolder, 'SVG', file.originalname || path.basename(file.path));
            moveUploadedFile(file.path, target);
        }
        for (const file of pngFiles) {
            const target = path.join(productFolder, 'PNG', file.originalname || path.basename(file.path));
            moveUploadedFile(file.path, target);
        }

        let baseJsonSource = req.body.baseJson;
        if (!baseJsonSource && req.files && req.files.baseJson && req.files.baseJson[0]) {
            baseJsonSource = fs.readFileSync(req.files.baseJson[0].path, 'utf8');
        }

        if (!baseJsonSource) {
            const defaultBaseJson = {
                productName: sanitized,
                generatedBy: 'browser-wfs-export',
                createdAt: new Date().toISOString(),
                originalImage: originalName,
                variants: [
                    'WFS_' + sanitized + '_BW_Numbers',
                    'WFS_' + sanitized + '_BW_Outline',
                    'WFS_' + sanitized + '_Colour_Reference',
                    'WFS_' + sanitized + '_Colour_Numbers',
                    'WFS_' + sanitized + '_Colour_Numbers_Outline'
                ]
            };
            baseJsonSource = JSON.stringify(defaultBaseJson, null, 2);
        }

        const baseJsonPath = path.join(productFolder, 'base.json');
        fs.writeFileSync(baseJsonPath, typeof baseJsonSource === 'string' ? baseJsonSource : JSON.stringify(baseJsonSource, null, 2), 'utf8');

        const fileLinks = [];
        const svgDir = path.join(productFolder, 'SVG');
        const pngDir = path.join(productFolder, 'PNG');
        for (const file of fs.readdirSync(svgDir)) {
            fileLinks.push({ name: file, url: `/jobs/${productFolderName}/SVG/${encodeURIComponent(file)}` });
        }
        for (const file of fs.readdirSync(pngDir)) {
            fileLinks.push({ name: file, url: `/jobs/${productFolderName}/PNG/${encodeURIComponent(file)}` });
        }
        fileLinks.push({ name: originalName, url: `/jobs/${productFolderName}/${encodeURIComponent(originalName)}` });
        fileLinks.push({ name: 'base.json', url: `/jobs/${productFolderName}/base.json` });

        return res.json({ success: true, job: productFolderName, files: fileLinks });
    } catch (err) {
        return res.status(500).json({ success: false, error: err && err.message ? err.message : 'Unknown error' });
    }
});

app.post('/api/generate', upload.single('image'), async (req, res) => {
    try {
        const file = req.file;
        const productNameRaw = req.body.productName || req.body.productname || req.body.name;
        const coloursRaw = req.body.colours || req.body.colour || req.body.k;

        if (!productNameRaw) {
            if (file && file.path) fs.unlinkSync(file.path);
            return res.status(400).json({ success: false, error: 'Product Name is required' });
        }
        if (!file) {
            return res.status(400).json({ success: false, error: 'Image file is required' });
        }

        const colours = coloursRaw ? parseInt(coloursRaw + '', 10) : undefined;
        if (coloursRaw && (isNaN(colours) || colours <= 0 || colours > 1024)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ success: false, error: 'Number of colours must be a positive integer' });
        }

        // sanitize product name
        let sanitized = sanitize(productNameRaw).trim();
        if (!sanitized) sanitized = 'untitled';
        sanitized = sanitized.replace(/\s+/g, '-');

        const finalFolderName = `WFS_${sanitized}`;
        const finalFolder = path.join(OUT_ROOT, finalFolderName);
        if (fs.existsSync(finalFolder)) {
            return res.status(409).json({ success: false, error: `Product folder already exists: ${finalFolderName}. Please choose a different Product Name or remove the existing folder.` });
        }

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '').replace(/T/, '-').slice(0,15);
        const rand = Math.floor(Math.random() * 10000).toString(16);
        const tempJobFolderName = `.${sanitized}-${timestamp}-${rand}`;
        const jobFolder = path.join(OUT_ROOT, tempJobFolderName);
        fs.mkdirSync(jobFolder, { recursive: true });

        // determine extension from original filename
        let ext = path.extname(file.originalname || '');
        if (!ext) {
            // try to infer from mimetype
            const mt = (file.mimetype || '').split('/')[1];
            ext = mt ? ('.' + mt) : '.png';
        }
        const savedImageName = `WFS_${sanitized}_Original_Image${ext}`;
        const savedImagePath = path.join(jobFolder, savedImageName);

        // retain original image in the final product root, not in PNG
        try {
            fs.renameSync(file.path, savedImagePath);
        } catch (e) {
            fs.copyFileSync(file.path, savedImagePath);
            try { fs.unlinkSync(file.path); } catch (e2) { }
        }

        const inputPath = savedImagePath;
        const outputBaseSvg = path.join(jobFolder, 'base.svg');

        // Build CLI args array
        const args = ['src-cli/main.js', '-i', inputPath, '-o', outputBaseSvg, '-n', productNameRaw, '--wfs'];
        if (typeof colours !== 'undefined') {
            args.push('--colours', '' + colours);
        }

        const child = spawn(process.execPath, args, { cwd: REPO_ROOT });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        child.on('close', (code) => {
            if (code !== 0) {
                try { fs.rmSync(jobFolder, { recursive: true, force: true }); } catch (e) { }
                return res.status(500).json({ success: false, error: 'CLI failed', exitCode: code, stdout, stderr });
            }

            try {
                const pngDir = path.join(finalFolder, 'PNG');
                const svgDir = path.join(finalFolder, 'SVG');
                const procreateDir = path.join(finalFolder, 'PROCREATE');
                const shopDir = path.join(finalFolder, '_Shop');
                const shopCanvaDir = path.join(shopDir, 'Canva');
                const shopListingDir = path.join(shopDir, 'Listing images');
                const shopSocialDir = path.join(shopDir, 'Social Media');
                fs.mkdirSync(pngDir, { recursive: true });
                fs.mkdirSync(svgDir, { recursive: true });
                fs.mkdirSync(procreateDir, { recursive: true });
                fs.mkdirSync(shopCanvaDir, { recursive: true });
                fs.mkdirSync(shopListingDir, { recursive: true });
                fs.mkdirSync(shopSocialDir, { recursive: true });

                const allFiles = fs.readdirSync(jobFolder).filter(f => f !== '.' && f !== '..');
                for (const f of allFiles) {
                    const full = path.join(jobFolder, f);
                    if (!fs.statSync(full).isFile()) continue;
                    const lower = f.toLowerCase();
                    if (lower.endsWith('.png') && f !== savedImageName) {
                        fs.renameSync(full, path.join(pngDir, f));
                    } else if (lower.endsWith('.svg')) {
                        fs.renameSync(full, path.join(svgDir, f));
                    } else if (f === savedImageName) {
                        // keep original image in the product root
                        fs.renameSync(full, path.join(finalFolder, f));
                    } else if (f !== 'base.svg') {
                        fs.renameSync(full, path.join(finalFolder, f));
                    }
                }

                const baseSvgPath = path.join(jobFolder, 'base.svg');
                if (fs.existsSync(baseSvgPath)) {
                    fs.renameSync(baseSvgPath, path.join(finalFolder, 'base.svg'));
                }
                const baseJsonPath = path.join(jobFolder, 'base.json');
                if (fs.existsSync(baseJsonPath)) {
                    fs.renameSync(baseJsonPath, path.join(finalFolder, 'base.json'));
                }

                const pngFiles = fs.readdirSync(pngDir);
                const svgFiles = fs.readdirSync(svgDir);
                const rootFiles = fs.readdirSync(finalFolder).filter(f => f !== 'PNG' && f !== 'SVG' && f !== 'PROCREATE' && f !== '_Shop');
                const files = [];
                for (const f of svgFiles) files.push({ name: f, url: `/jobs/${finalFolderName}/SVG/${encodeURIComponent(f)}` });
                for (const f of pngFiles) files.push({ name: f, url: `/jobs/${finalFolderName}/PNG/${encodeURIComponent(f)}` });
                for (const f of rootFiles) files.push({ name: f, url: `/jobs/${finalFolderName}/${encodeURIComponent(f)}` });

                fs.rmSync(jobFolder, { recursive: true, force: true });
                return res.json({ success: true, job: finalFolderName, files, stdout, stderr });
            } catch (err) {
                try { fs.rmSync(jobFolder, { recursive: true, force: true }); } catch (e) { }
                return res.status(500).json({ success: false, error: err && err.message ? err.message : 'Unknown error while arranging output' });
            }
        });

    } catch (err) {
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
        return res.status(500).json({ success: false, error: err && err.message ? err.message : '' });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
