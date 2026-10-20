// End-to-end tests of the onboarding form and the HR dashboard (spec.md § 8).
// `reset-database.ts` makes a fresh test database before the app starts. The tests run in one worker, one after the other.

import { expect, type Page, test } from "@playwright/test";

const HAS_CHILDREN_MARRIED =
	"Does the person or the spouse or partner have biological or adopted children?";
const HAS_CHILDREN_SINGLE =
	"Does the person have biological or adopted children?";
const INCOME = "For which income do you want to find the source-tax tariff?";
const MARRIED = "Married or registered partnership";
const SINGLE = "Single, divorced, separated, widowed";

async function fillPerson(
	page: Page,
	person: { firstName: string; lastName: string; country: string },
) {
	await page.getByLabel("First name").fill(person.firstName);
	await page.getByLabel("Last name").fill(person.lastName);
	await page.getByLabel("Nationality").fill(person.country);
	await page
		.getByRole("option", { name: new RegExp(`^${person.country}`) })
		.click();
}

/** Clicks one option of one radio group, for example `answer(page, "Civil status", "Married ...")`. */
async function answer(
	scope: Page | ReturnType<Page["getByRole"]>,
	question: string,
	option: string,
) {
	const group = scope.getByRole("radiogroup", { name: question, exact: true });
	await group.getByText(option, { exact: true }).click();
	await expect(
		group.getByRole("radio", { name: option, exact: true }),
	).toBeChecked();
}

test("a Swiss employee gets no source-tax questions and shows on /hr", async ({
	page,
}) => {
	await page.goto("/onboarding");
	await fillPerson(page, {
		firstName: "Lena",
		lastName: "Swiss",
		country: "Switzerland",
	});
	await expect(page.getByRole("radiogroup")).toHaveCount(0);
	await expect(page.getByText("Swiss citizen: no source tax")).toBeVisible();

	await page.getByRole("button", { name: "Submit" }).click();
	await expect(page).toHaveURL(/\/onboarding\/done$/);

	await page.goto("/hr");
	const row = page.getByRole("row", { name: /Lena Swiss/ });
	await expect(row).toContainText("Switzerland (CH)");
	await expect(row).toContainText("No source tax (Swiss)");
});

test("married with one child gives C1Y on the preview and on /hr", async ({
	page,
}) => {
	await page.goto("/onboarding");
	await fillPerson(page, {
		firstName: "Marta",
		lastName: "Married",
		country: "Italy",
	});

	await answer(
		page,
		"For which income do you want to find the source-tax tariff?",
		"Earned income",
	);
	await answer(page, "Civil status", "Married or registered partnership");
	await answer(
		page,
		"Religious affiliation",
		"Roman Catholic, Christian Catholic, Protestant Reformed",
	);
	await answer(
		page,
		"Is the spouse or registered partner employed or in receipt of replacement income?",
		"Yes",
	);
	await answer(page, HAS_CHILDREN_MARRIED, "Yes");

	const child = page.getByRole("group", { name: "Child 1" });
	await answer(
		child,
		"Is the child a minor, or an adult in first education?",
		"Minor",
	);
	await answer(child, "Does the child live in the same household?", "Yes");
	await answer(child, "Parental authority", "Shared custody");
	await answer(child, "Common household with the other parent?", "Yes");

	await answer(page, "Is the main residence in Switzerland?", "Yes");

	await expect(page.getByRole("img", { name: "Tariff C1Y" })).toBeVisible();
	await page.getByRole("button", { name: "Submit" }).click();
	await expect(page).toHaveURL(/\/onboarding\/done$/);

	await page.goto("/hr");
	await expect(page.getByRole("row", { name: /Marta Married/ })).toContainText(
		"C1Y",
	);
});

test("a question disappears with its parent answer and is empty when it returns", async ({
	page,
}) => {
	await page.goto("/onboarding");
	await fillPerson(page, {
		firstName: "Ana",
		lastName: "Switch",
		country: "Portugal",
	});
	await answer(
		page,
		"For which income do you want to find the source-tax tariff?",
		"Earned income",
	);
	await answer(page, "Civil status", "Married or registered partnership");
	await answer(page, "Religious affiliation", "None or other");

	const spouse = page.getByRole("radiogroup", {
		name: "Is the spouse or registered partner employed or in receipt of replacement income?",
		exact: true,
	});
	await answer(
		page,
		"Is the spouse or registered partner employed or in receipt of replacement income?",
		"Yes",
	);

	await answer(page, "Civil status", "Single, divorced, separated, widowed");
	await expect(spouse).toHaveCount(0);

	await answer(page, "Civil status", "Married or registered partnership");
	await expect(spouse).toBeVisible();
	await expect(spouse.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("an empty submit marks the required fields and stays on the page", async ({
	page,
}) => {
	await page.goto("/onboarding");
	await page.getByRole("button", { name: "Submit" }).click();

	await expect(page.locator("#firstName-error")).toHaveText("Required");
	await expect(page.locator("#lastName-error")).toHaveText("Required");
	await expect(page.locator("#nationality-error")).toHaveText("Required");
	await expect(page.getByRole("status")).toHaveText("3 answers are missing");
	await expect(page).toHaveURL(/\/onboarding$/);
});

test("Liechtenstein with replacement income and daily return shows no source tax", async ({
	page,
}) => {
	await page.goto("/onboarding");
	await fillPerson(page, {
		firstName: "Sophie",
		lastName: "Frick",
		country: "Liechtenstein",
	});
	await answer(
		page,
		"For which income do you want to find the source-tax tariff?",
		"Replacement income",
	);
	await answer(
		page,
		"Is the main residence in Switzerland (during or before the replacement income)?",
		"No",
	);
	await answer(page, "Country of residence", "Liechtenstein");
	await answer(
		page,
		"Does the person return daily to the main residence in Liechtenstein (during or before the replacement income)?",
		"Yes",
	);

	const preview = page.getByLabel("Tariff preview");
	await expect(preview).toContainText("No source tax in principle");
	await expect(preview).toContainText(
		"Subject to the double taxation agreement",
	);
});

/** A single person from Italy with earned income and no church tax, up to the children question. */
async function startSingle(page: Page, lastName: string) {
	await page.goto("/onboarding");
	await fillPerson(page, { firstName: "Test", lastName, country: "Italy" });
	await answer(page, INCOME, "Earned income");
	await answer(page, "Civil status", SINGLE);
	await answer(page, "Religious affiliation", "None or other");
}

/** A child who lives in the household with sole custody: it counts for the digit and gives H. */
async function answerCountedChild(child: ReturnType<Page["getByRole"]>) {
	await answer(
		child,
		"Is the child a minor, or an adult in first education?",
		"Minor",
	);
	await answer(child, "Does the child live in the same household?", "Yes");
	await answer(child, "Parental authority", "Sole custody");
}

test("a change of the civil status clears the answers of the label variants", async ({
	page,
}) => {
	await page.goto("/onboarding");
	await fillPerson(page, {
		firstName: "Vera",
		lastName: "Variant",
		country: "Spain",
	});
	await answer(page, INCOME, "Earned income");
	await answer(page, "Civil status", MARRIED);
	await answer(page, "Religious affiliation", "None or other");
	await answer(
		page,
		"Is the spouse or registered partner employed or in receipt of replacement income?",
		"Yes",
	);
	await answer(page, HAS_CHILDREN_MARRIED, "Yes");
	await answer(
		page.getByRole("group", { name: "Child 1" }),
		"Is the child a minor, or an adult in first education?",
		"Neither",
	);
	await answer(page, "Is the main residence in Switzerland?", "Yes");

	await answer(page, "Civil status", SINGLE);

	const hasChildren = page.getByRole("radiogroup", {
		name: HAS_CHILDREN_SINGLE,
		exact: true,
	});
	await expect(hasChildren).toBeVisible();
	await expect(hasChildren.getByRole("radio", { checked: true })).toHaveCount(
		0,
	);
	await expect(page.getByRole("group", { name: "Child 1" })).toHaveCount(0);
	await expect(page.getByLabel("Tariff preview")).toContainText("Not complete");
});

test("a change of the household clears the shared custody answer of the other variant", async ({
	page,
}) => {
	await page.goto("/onboarding");
	await fillPerson(page, {
		firstName: "Sam",
		lastName: "Custody",
		country: "Spain",
	});
	await answer(page, INCOME, "Earned income");
	await answer(page, "Civil status", MARRIED);
	await answer(page, "Religious affiliation", "None or other");
	await answer(
		page,
		"Is the spouse or registered partner employed or in receipt of replacement income?",
		"Yes",
	);
	await answer(page, HAS_CHILDREN_MARRIED, "Yes");

	const child = page.getByRole("group", { name: "Child 1" });
	await answer(
		child,
		"Is the child a minor, or an adult in first education?",
		"Minor",
	);
	await answer(child, "Does the child live in the same household?", "Yes");
	await answer(child, "Parental authority", "Shared custody");

	await answer(child, "Does the child live in the same household?", "No");

	const shared = child.getByRole("radiogroup", {
		name: "Shared custody",
		exact: true,
	});
	await expect(shared).toBeVisible();
	await expect(shared.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("Remove deletes one child and the preview digit drops by one", async ({
	page,
}) => {
	await startSingle(page, "Remove");
	await answer(page, HAS_CHILDREN_SINGLE, "Yes");
	await answerCountedChild(page.getByRole("group", { name: "Child 1" }));
	await page.getByRole("button", { name: "Add another child" }).click();
	await answerCountedChild(page.getByRole("group", { name: "Child 2" }));
	await answer(page, "Is the main residence in Switzerland?", "Yes");
	await expect(page.getByRole("img", { name: "Tariff H2N" })).toBeVisible();

	await page
		.getByRole("group", { name: "Child 1" })
		.getByRole("button", { name: "Remove" })
		.click();

	await expect(page.getByRole("group", { name: "Child 2" })).toHaveCount(0);
	const child = page.getByRole("group", { name: "Child 1" });
	await expect(
		child.getByRole("radio", { name: "Minor", exact: true }),
	).toBeChecked();
	await expect(page.getByRole("img", { name: "Tariff H1N" })).toBeVisible();
});

test("hasChildren Yes, a second child, No, Yes gives one empty child", async ({
	page,
}) => {
	await startSingle(page, "Toggle");
	await answer(page, HAS_CHILDREN_SINGLE, "Yes");
	await page.getByRole("button", { name: "Add another child" }).click();
	await expect(page.getByRole("group", { name: "Child 2" })).toBeVisible();

	await answer(page, HAS_CHILDREN_SINGLE, "No");
	await expect(page.getByRole("group", { name: /^Child/ })).toHaveCount(0);
	await answer(page, HAS_CHILDREN_SINGLE, "Yes");

	await expect(page.getByRole("group", { name: /^Child/ })).toHaveCount(1);
	const child = page.getByRole("group", { name: "Child 1" });
	await expect(child.getByRole("radio", { checked: true })).toHaveCount(0);
});
