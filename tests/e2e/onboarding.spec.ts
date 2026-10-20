// End-to-end tests of the onboarding form and the HR dashboard (spec.md § 8).
// `global-setup.ts` makes a fresh test database. The tests run in one worker, one after the other.

import { expect, type Page, test } from "@playwright/test";

const HAS_CHILDREN_MARRIED =
	"Does the person or the spouse or partner have biological or adopted children?";

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
