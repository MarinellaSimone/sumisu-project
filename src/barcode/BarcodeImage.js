const { createCanvas } = require("canvas");
const JsBarcode = require("jsbarcode");

class BarcodeImage {

    static createBase64(value) {

        const canvas = createCanvas();

        JsBarcode(canvas, value, {
            format: "CODE128",
            displayValue: false,
            margin: 0,
            height: 70
        });

        return canvas.toDataURL("image/png");
    }

}

module.exports = BarcodeImage;