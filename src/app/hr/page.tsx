import { EmployeeTable } from "@/components/hr/employee-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { employeeTariff } from "@/domain/onboarding/employee-tariff";
import type { EmployeeRow } from "@/server/employees";
import { employeeRepo } from "@/server/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "HR dashboard" };

function summarize(rows: readonly EmployeeRow[]) {
	let swiss = 0;
	let withCode = 0;
	let noSourceTax = 0;
	let invalid = 0;
	for (const { employee } of rows) {
		if (employee === null) {
			invalid += 1;
			continue;
		}
		const tariff = employeeTariff(employee);
		switch (tariff.kind) {
			case "swiss":
				swiss += 1;
				break;
			case "code":
				withCode += 1;
				break;
			case "noSourceTax":
				noSourceTax += 1;
				break;
			default: {
				const unreachable: never = tariff;
				throw new Error(`Unhandled tariff: ${JSON.stringify(unreachable)}`);
			}
		}
	}
	return [
		{ label: "Employees", value: rows.length },
		{ label: "Swiss (no source tax)", value: swiss },
		{ label: "With a tariff code", value: withCode },
		{ label: "No source tax in principle", value: noSourceTax },
		{ label: "Invalid stored data", value: invalid },
	];
}

export default async function HrPage() {
	const rows = await employeeRepo.list();
	const counts = summarize(rows);
	return (
		<main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
			<h1 className="text-2xl font-semibold">HR dashboard</h1>
			<section
				aria-label="Summary"
				className="grid grid-cols-2 gap-4 md:grid-cols-5"
			>
				{counts.map(({ label, value }) => (
					<Card key={label} size="sm">
						<CardHeader>
							<CardTitle className="text-sm font-normal text-muted-foreground">
								{label}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-2xl font-semibold">
							{value}
						</CardContent>
					</Card>
				))}
			</section>
			<EmployeeTable rows={rows} />
		</main>
	);
}
