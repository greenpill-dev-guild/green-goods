import "dotenv/config";

import { program } from "commander";

import { schemasToEas } from "./handlers/schemasToEas";

program
	.name("eas-upload-util")
	.description("Batch upload data to EAS")
	.version("0.0.1");

console.log(process.cwd());

program
	.name("eas-upload-util")
	.command("schemas-to-eas")
	.description("Upload schemas to EAS")
	.argument(
		"[file]",
		"Path to the file containing the metrics",
		"/resources/schemas.json",
	)
	.option("-f, --force <boolean>", "Force upload", false)
	.action(async (file: string, opt: { force?: boolean }) => {
		await schemasToEas(file, opt);
	});

program.parse();
