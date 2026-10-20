// The tariff of one employee. The dashboard and the server call this function.

import { sourceTaxModules } from "../source-tax/registry.ts";
import type { TariffResult } from "../source-tax/types.ts";
import type { TariffCode } from "../source-tax/zurich/codes.ts";
import type { Onboarding } from "./schema.ts";

export type EmployeeTariff = { kind: "swiss" } | TariffResult<TariffCode>;

export function employeeTariff(employee: Onboarding): EmployeeTariff {
	if (employee.nationality === "CH") {
		return { kind: "swiss" };
	}
	const { canton, answers } = employee.sourceTax;
	switch (canton) {
		case "ZH":
			return sourceTaxModules.ZH.compute(answers);
		default: {
			const unreachable: never = canton;
			return unreachable;
		}
	}
}
