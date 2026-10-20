// Types of the generic question flow. No domain knowledge lives here.

export type Option<V extends string | boolean = string | boolean> = {
	readonly value: V;
	readonly label: string;
};

/** A question of the root. `visibleWhen` reads the pruned prefix: the answers of earlier questions only. */
export type Question<Root> = {
	readonly kind: "question";
	/** Dot path relative to the root. */
	readonly id: string;
	readonly label: string;
	readonly options: readonly Option[];
	readonly visibleWhen: (root: Root) => boolean;
	/** The document row that defines the question, for example "calculator-spec.md § 4.1". */
	readonly source: string;
};

/** A question inside a repeating group. `item` is the pruned prefix of the same item. */
export type ItemQuestion<Root, Item> = {
	readonly kind: "question";
	/** Dot path relative to the item. */
	readonly id: string;
	readonly label: string;
	readonly options: readonly Option[];
	readonly visibleWhen: (root: Root, item: Item) => boolean;
	readonly source: string;
};

export type RepeatingGroup<Root, Item> = {
	readonly kind: "group";
	/** Dot path of the array, for example "children.list". */
	readonly id: string;
	readonly itemLabel: string;
	readonly addLabel: string;
	readonly visibleWhen: (root: Root) => boolean;
	readonly items: readonly ItemQuestion<Root, Item>[];
};

export type FlowNode<Root, Item> = Question<Root> | RepeatingGroup<Root, Item>;

/** The nodes in asking order. All groups of one flow have the same item type. */
export type Flow<Root, Item> = readonly FlowNode<Root, Item>[];
