const express = require("express");
const router = express.Router();
const supabase = require("../supabase");
const BarcodeCodec = require("../barcode/BarcodeCodec");
const BarcodeImage = require("../barcode/BarcodeImage");
const LabelRenderer = require("../barcode/LabelRenderer");
const { LABEL_TYPES } = require("../costants");

async function getCodiceNumerico(type, codice) {
    let table;

    if (type === LABEL_TYPES.MP || type === LABEL_TYPES.SM) {
        table = "materiali";
    } else if (type === LABEL_TYPES.PF) {
        table = "articoli_pf";
    } else {
        throw new Error(`Tipo etichetta non valido: ${type}`);
    }

    const { data, error } = await supabase
        .from(table)
        .select("codice_numerico")
        .eq("codice", codice)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new Error(
            `Codice '${codice}' non trovato nella tabella ${table}`
        );
    }

    return data.codice_numerico;
}


router.get("/generate", async (req, res) => {
    try {
        const {
            type = LABEL_TYPES.MP,
            date = new Date(),
            quantity,
            unit,
            lot,
        } = req.query;

        if (!date || !quantity) {
            return res.status(400).json({
                error: "date and quantity are required"
            });
        }

        // Recupera la tipologia da Supabase
        const { data: tipologia, error: tipologiaError } = await supabase
            .from("tipologie")
            .select("*")
            .eq("tipologia", type)
            .maybeSingle();

        if (tipologiaError) {
            console.error(tipologiaError);
            return res.status(500).json({
                error: "Errore nel recupero della tipologia"
            });
        }

        if (!tipologia) {
            return res.status(400).json({
                error: `Tipologia '${type}' non trovata`
            });
        }
        const codice = lot.split("-")[2];
        const codiceNumerico = await getCodiceNumerico(type, codice);
        
        // Create barcode data
        const barcode = BarcodeCodec.create({
            expiryDate: date,
            quantity: Number(quantity),
            codTipologia: tipologia.codice,
            codNumerico: codiceNumerico,
            codIncrementale: lot.split("-")[3]
        });

        // Generate barcode image
        const image = BarcodeImage.createBase64(
            barcode.value
        );

        const label = {
            type,
            company: "DULCIBANA s.r.l.",
            barcodeValue: barcode.value,
            barcodeText: barcode.human,
            lot,
            quantity: Number(quantity),
            date: BarcodeCodec.formatDate(date),
            image,
            unit:unit
        };

        const data = await new LabelRenderer().render(
            label.type,
            label
        );

        return res.json({
            success: true,
            data,
            label,
            tipologia
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Barcode generation failed"
        });
    }
});


module.exports = router;