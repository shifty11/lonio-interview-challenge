import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { countryName } from "@/domain/onboarding/countries";
import { employeeTariff } from "@/domain/onboarding/employee-tariff";
import { describeTariffCode } from "@/domain/source-tax/zurich/meaning";
import type { EmployeeRow } from "@/server/employees";
import { formatAdded } from "@/server/format";

type TariffCells = { tariff: React.ReactNode; meaning: string; remark: string };

function tariffCells(row: EmployeeRow): TariffCells {
	const { employee } = row;
	if (employee === null) {
		return {
			tariff: <Badge variant="destructive">Invalid stored data</Badge>,
			meaning: "",
			remark: "",
		};
	}
	const tariff = employeeTariff(employee);
	switch (tariff.kind) {
		case "swiss":
			return { tariff: "No source tax (Swiss)", meaning: "", remark: "" };
		case "code":
			return {
				tariff: <Badge className="font-mono">{tariff.code}</Badge>,
				meaning: describeTariffCode(tariff.code),
				remark: tariff.remark ?? "",
			};
		case "noSourceTax":
			return {
				tariff: tariff.text,
				meaning: "",
				remark: tariff.remark ?? "",
			};
		default: {
			const unreachable: never = tariff;
			return unreachable;
		}
	}
}

export function EmployeeTable({ rows }: { rows: readonly EmployeeRow[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Nationality</TableHead>
					<TableHead>ZH tariff</TableHead>
					<TableHead>Meaning</TableHead>
					<TableHead>Remark</TableHead>
					<TableHead>Added</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.length === 0 ? (
					<TableRow>
						<TableCell colSpan={6} className="text-muted-foreground">
							No employee has completed the form yet.
						</TableCell>
					</TableRow>
				) : (
					rows.map((row) => {
						const cells = tariffCells(row);
						return (
							<TableRow key={row.id}>
								<TableCell className="font-medium">
									{row.firstName} {row.lastName}
								</TableCell>
								<TableCell>
									{countryName(row.nationality)} ({row.nationality})
								</TableCell>
								<TableCell>{cells.tariff}</TableCell>
								<TableCell className="whitespace-normal">
									{cells.meaning}
								</TableCell>
								<TableCell className="whitespace-normal">
									{cells.remark}
								</TableCell>
								<TableCell>{formatAdded(row.createdAt)}</TableCell>
							</TableRow>
						);
					})
				)}
			</TableBody>
		</Table>
	);
}
