const BarcodeCodec = require("./BarcodeCodec");

class LabelGenerator {

    constructor(company = "DULCIBANA s.r.l.") {
        this.company = company;
    }

    generate({
        type,
        barcode,
        date,
        quantity,
        unit,
        lot,
        image
    }) {

        if (!barcode.human) {
            barcode = BarcodeCodec.create({
                productionDate: date,
                quantity
            });
        }

        return {
            type,
            company: this.company,
            barcodeValue: barcode.value,
            barcodeText: barcode.human,
            lot,
            quantity,
            date: BarcodeCodec.formatDate(date),
            unit,
            image:image
        };
    }

}

module.exports = LabelGenerator;