const FIXED_GTIN = "05089217109800";

class BarcodeCodec {
    static formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");

        return `${y}${m}${d}`;
    }

    static create({
        productionDate,
        expiryDate = productionDate,
        quantity
    }) {
        const prod = this.formatDate(productionDate);
        const exp = this.formatDate(expiryDate);

        const encoded =
            `01${FIXED_GTIN}` +
            `10${prod}` +
            `17${exp}` +
            `37${quantity}`;

        const human =
            `(01) ${FIXED_GTIN} ` +
            `(10) ${prod} ` +
            `(17) ${exp} ` +
            `(37) ${quantity}`;

        return {
            value: encoded,
            human,
            gtin: FIXED_GTIN,
            productionDate: prod,
            expiryDate: exp,
            quantity
        };
    }

    static parse(barcode) {

        const gtin = barcode.substring(2, 16);
        const lot = barcode.substring(18, 26);
        const expiry = barcode.substring(28, 36);
        const quantity = Number(barcode.substring(38));

        return {
            gtin,
            lot,
            expiry,
            quantity
        };
    }
}

module.exports = BarcodeCodec;