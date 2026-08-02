const express = require("express");
const router = express.Router();

const BarcodeCodec = require("../barcode/BarcodeCodec");
const BarcodeImage = require("../barcode/BarcodeImage");
const LabelGenerator = require("../barcode/LabelGenerator");
const LabelRenderer = require("../barcode/LabelRenderer");
const { LABEL_TYPES } = require("../costants");

router.get("/",(req,res) =>{
    return res.json({
    success: true
    });
})
router.get("/generate", async (req, res) => {
    try {
        const {
            type = LABEL_TYPES.MP,
            date = new Date(),
            quantity,
            unit,
            lot
        } = req.query;


        if (!date || !quantity) {
            return res.status(400).json({
                error: "date and quantity are required"
            });
        }


        // Create barcode data
        const barcode = BarcodeCodec.create({
            productionDate: date,
            quantity: Number(quantity)
        });


        // Generate barcode image
        const image = BarcodeImage.createBase64(
            barcode.value
        );


        // Generate label data
        const label = new LabelGenerator().generate({
            type,
            barcode,
            date,
            quantity: Number(quantity),
            unit,
            lot,
            image
        });

        const data = await new LabelRenderer().render(
            label.type,
            label
        );


        return res.json({
            success: true,
            data,
            label
        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Barcode generation failed"
        });
    }
});


module.exports = router;