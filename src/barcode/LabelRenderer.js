const ejs = require("ejs");
const path = require("path");

class LabelRenderer {

    async render(type, data) {

        const template = path.join(
            __dirname,
            "../../views/barcodes",
            `${type}.ejs`
        );

        return ejs.renderFile(template, data);
    }
}

module.exports = LabelRenderer;