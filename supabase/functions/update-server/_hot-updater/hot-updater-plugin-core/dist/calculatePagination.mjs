//#region src/calculatePagination.ts
/**
* Calculate pagination information based on total count, limit, and offset
*/
function calculatePagination(total, options) {
	const { limit, offset } = options;
	if (total === 0) return {
		total: 0,
		hasNextPage: false,
		hasPreviousPage: false,
		currentPage: 1,
		totalPages: 0
	};
	const currentPage = Math.floor(offset / limit) + 1;
	const totalPages = Math.ceil(total / limit);
	return {
		total,
		hasNextPage: offset + limit < total,
		hasPreviousPage: offset > 0,
		currentPage,
		totalPages
	};
}
//#endregion
export { calculatePagination };
