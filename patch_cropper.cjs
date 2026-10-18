const fs = require('fs');
let content = fs.readFileSync('src/lib/imageUtils.js', 'utf8');

const newCropLogic = `    // draw image
    ctx.drawImage(image, 0, 0);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = pixelCrop.width;
    croppedCanvas.height = pixelCrop.height;
    const croppedCtx = croppedCanvas.getContext('2d');

    // extract the cropped region using drawImage instead of getImageData/putImageData (Safari bug fix)
    croppedCtx.drawImage(
        canvas,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    // As Blob
    return new Promise((resolve, reject) => {
        croppedCanvas.toBlob((file) => {
            resolve(file);
        }, 'image/jpeg', 0.9);
    });
}
`;

content = content.replace(/    \/\/ draw image[\s\S]*?\}\n$/m, newCropLogic);

fs.writeFileSync('src/lib/imageUtils.js', content);
