'use strict'
const fs = require('fs');
const { Controller, Tag } = require("ethernet-ip");

const plcAddress = process.argv[2] || "10.37.156.6";
const tagList = require('./tags-to-listen');

// CIP: 0x04 path segment error, 0x05 path destination unknown.
// No Logix, os dois indicam que o símbolo não existe (ou o caminho é inválido).
const MISSING_STATUS = new Set([0x04, 0x05]);

main().catch(function (err) {
	console.log(" -- Erro fatal -- ");
	console.log(err && err.stack ? err.stack : err);
	process.exit(1);
});

async function main() {
	const tags = tagList.filter(function (tag) {
		return tag.listenable && tag.tagCode;
	});

	const found = [];
	const missing = [];
	const errors = [];

	console.log(" -- Testando " + tags.length + " tags em " + plcAddress + " -- ");

	let PLC = await connect();
	let consecutiveConnErrors = 0;

	for (let i = 0; i < tags.length; i++) {
		const tag = tags[i];
		const prefix = "[" + (i + 1) + "/" + tags.length + "] " + tag.tagCode;

		let result = null;
		let lastErr = null;

		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				result = await readOne(PLC, tag.tagCode);
				lastErr = null;
				break;
			} catch (err) {
				lastErr = err;
				PLC.removeAllListeners("Read Tag");

				if (isMissing(err)) break;

				console.log(prefix + " falhou (" + formatError(err) + "). Reconectando...");
				safeDestroy(PLC);
				try {
					PLC = await connect();
				} catch (connErr) {
					lastErr = connErr;
					break;
				}
			}
		}

		if (result) {
			consecutiveConnErrors = 0;
			found.push({
				tagCode: tag.tagCode,
				machineCode: tag.machineCode,
				function: tag.function,
				type: result.type,
				value: result.value
			});
			console.log(prefix + "  OK  tipo=" + result.type + "  valor=" + result.value);
		} else if (isMissing(lastErr)) {
			consecutiveConnErrors = 0;
			missing.push({
				tagCode: tag.tagCode,
				machineCode: tag.machineCode,
				function: tag.function,
				error: formatError(lastErr)
			});
			console.log(prefix + "  NAO EXISTE  (" + formatError(lastErr) + ")");
		} else {
			consecutiveConnErrors++;
			errors.push({
				tagCode: tag.tagCode,
				machineCode: tag.machineCode,
				function: tag.function,
				error: formatError(lastErr)
			});
			console.log(prefix + "  ERRO  " + formatError(lastErr));

			if (consecutiveConnErrors >= 3) {
				console.log(" -- Parando: 3 erros de conexão seguidos -- ");
				break;
			}
		}
	}

	safeDestroy(PLC);

	console.log("\n========== RESULTADO ==========");
	console.log("Testadas:     " + (found.length + missing.length + errors.length) + " / " + tags.length);
	console.log("Existem:      " + found.length);
	console.log("Nao existem:  " + missing.length);
	console.log("Erros:        " + errors.length);

	if (missing.length) {
		console.log("\nTags que nao existem no PLC:");
		missing.forEach(function (tag) {
			console.log(" - " + tag.tagCode + "  (" + tag.machineCode + ", " + tag.function + ")");
		});
	}

	if (errors.length) {
		console.log("\nTags com erro de leitura (nao deu para concluir):");
		errors.forEach(function (tag) {
			console.log(" - " + tag.tagCode + "  " + tag.error);
		});
	}

	const report = {
		plc: plcAddress,
		date: new Date().toISOString(),
		found: found,
		missing: missing,
		errors: errors
	};
	fs.writeFileSync('tags-test-result.json', JSON.stringify(report, null, 2));
	console.log("\nRelatorio salvo em tags-test-result.json");

	process.exit(errors.length ? 1 : 0);
}

async function connect() {
	const PLC = new Controller();
	console.log(" -- Conectando no PLC (" + plcAddress + ") -- ");
	await PLC.connect(plcAddress, 0);
	console.log(" -- Conectado -- ");
	return PLC;
}

async function readOne(PLC, tagCode) {
	const tag = new Tag(tagCode);
	try {
		await PLC.readTag(tag);
		return { type: tag.type, value: tag.value };
	} catch (err) {
		// A resposta CIP foi sucesso, mas o tipo (STRING, UDT, ...) nao e atomico.
		// A tag existe; a biblioteca so nao consegue decodificar o valor.
		if (err instanceof Error && /Unrecognized Type/i.test(err.message)) {
			return { type: "unsupported", value: null };
		}
		throw err;
	} finally {
		// readTag so remove o listener no caminho de sucesso.
		PLC.removeAllListeners("Read Tag");
	}
}

function isMissing(err) {
	return !!(err && typeof err.generalStatusCode === "number" && MISSING_STATUS.has(err.generalStatusCode));
}

function formatError(err) {
	if (!err) return "erro desconhecido";
	if (typeof err.generalStatusCode === "number") {
		let text = "CIP 0x" + err.generalStatusCode.toString(16);
		if (Array.isArray(err.extendedStatus) && err.extendedStatus.length) {
			text += " ext=" + err.extendedStatus.map(function (code) {
				return "0x" + code.toString(16);
			}).join(",");
		}
		return text;
	}
	return err.message || String(err);
}

function safeDestroy(PLC) {
	try {
		PLC.destroy();
	} catch (err) {
		// conexao ja caiu
	}
}
