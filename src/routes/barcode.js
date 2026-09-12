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
        .select("codice_numerico, descrizione")
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

    return data;
}


router.get("/generate", async (req, res) => {
    try {
        const {
            type = LABEL_TYPES.MP,
            date = new Date(),
            quantity,
            unit,
            lot,
            foodContactSymbol = "false",
            foodContact20Pap = "false",
            foodContact21Pap = "false",
            foodContact22Pap = "false",
            foodContact81 = "false",
            foodContact4Ldpe = "false",
            foodContactText = "false",
            foodContactMunicipality = "false",
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
        const codiceMateriale = await getCodiceNumerico(type, codice);
        
        // Create barcode data
        const barcode = BarcodeCodec.create({
            expiryDate: date,
            quantity: Number(quantity),
            codTipologia: tipologia.codice,
            codNumerico: codiceMateriale.codice_numerico,
            codIncrementale: lot.split("-")[3]
        });

        // Generate barcode image
        const image = BarcodeImage.createBase64(
            barcode.value
        );

        const label = {
            type,
            company: "DULCIBANA s.r.l.",
            descrizione: codiceMateriale.descrizione,
            barcodeValue: barcode.value,
            barcodeText: barcode.human,
            lot,
            quantity: Number(quantity),
            date: BarcodeCodec.formatDate(date),
            image,
            unit:unit
            ,foodContactSymbol: foodContactSymbol === "true"
            ,foodContact20Pap: foodContact20Pap === "true"
            ,foodContact21Pap: foodContact21Pap === "true"
            ,foodContact22Pap: foodContact22Pap === "true"
            ,foodContact81: foodContact81 === "true"
            ,foodContact4Ldpe: foodContact4Ldpe === "true"
            ,foodContactText: foodContactText === "true"
            ,foodContactMunicipality: foodContactMunicipality === "true"
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