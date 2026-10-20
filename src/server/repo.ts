// The repository over the real database. Tests use a fake repository instead.

import { db } from "../prisma/db.ts";
import { createEmployeeRepo } from "./employees.ts";

export const employeeRepo = createEmployeeRepo(db);
